// The saved photo must be as good as the one picked: the same resolution,
// no visible loss, and its metadata (date taken, camera, place) kept.
import { expect, type Page } from "@playwright/test"
import exifr from "exifr"
import { readFile } from "node:fs/promises"
import { exifDate } from "../../src/lib/exif"
import { addPhotos, fixture, test, useFileDownloads, visit } from "./helpers"

/** Adds one photo, saves it as a plain download and returns the saved file's bytes. */
async function saveOne(page: Page, name: string, before?: (page: Page) => Promise<void>) {
  await useFileDownloads(page)
  await visit(page)
  await addPhotos(page, [fixture(name)])
  if (before) await before(page)
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-save-all]").click()])
  return readFile(await download.path())
}

/** Width and height from the JPEG's frame header (what the file really holds). */
function jpegSize(jpeg: Buffer) {
  let at = 2
  while (at < jpeg.length) {
    const marker = jpeg[at + 1]
    if (marker >= 0xc0 && marker <= 0xc3) return { width: jpeg.readUInt16BE(at + 7), height: jpeg.readUInt16BE(at + 5) }
    at += 2 + jpeg.readUInt16BE(at + 2)
  }
  throw new Error("no frame header")
}

const tags = (jpeg: Buffer) => exifr.parse(jpeg, { tiff: true, exif: true, gps: true, translateValues: false })

test.describe("the saved photo", () => {
  test("keeps the full resolution", async ({ page }) => {
    const saved = await saveOne(page, "exif-full.jpg")
    expect(jpegSize(saved)).toEqual({ width: 1600, height: 1200 })
  })

  test("looks the same as the original outside the date (PSNR ≥ 40 dB)", async ({ page }) => {
    const saved = await saveOne(page, "exif-full.jpg")
    const original = await readFile(fixture("exif-full.jpg"))
    // Compare the pixels in the browser, which decodes JPEG. The date sits in
    // the bottom-right corner, so only the top 70 % of the photo counts.
    const psnr = await page.evaluate(
      async ([a, b]) => {
        const pixels = async (base64: string) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${base64}`)).blob())
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          const context = canvas.getContext("2d")!
          context.drawImage(bitmap, 0, 0)
          return context.getImageData(0, 0, bitmap.width, Math.floor(bitmap.height * 0.7)).data
        }
        const [x, y] = await Promise.all([pixels(a), pixels(b)])
        let sum = 0
        let count = 0
        for (let i = 0; i < x.length; i += 4) {
          for (let c = 0; c < 3; c++) sum += (x[i + c] - y[i + c]) ** 2
          count += 3
        }
        return 10 * Math.log10(255 ** 2 / (sum / count))
      },
      [original.toString("base64"), saved.toString("base64")],
    )
    expect(psnr).toBeGreaterThanOrEqual(40)
  })

  test("has the date on it: the corner changed, in the date's colour, and only the corner", async ({ page }) => {
    // Retro: orange digits in the bottom-right corner are easy to count.
    await page.addInitScript(() =>
      localStorage.setItem("datestamp:options", JSON.stringify({ style: "retro", format: "retro", position: "bottom-right", size: 6 })),
    )
    const saved = await saveOne(page, "exif-full.jpg")
    const original = await readFile(fixture("exif-full.jpg"))
    const result = await page.evaluate(
      async ([a, b]) => {
        const pixels = async (base64: string) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${base64}`)).blob())
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
          const context = canvas.getContext("2d")!
          context.drawImage(bitmap, 0, 0)
          return context.getImageData(0, 0, bitmap.width, bitmap.height)
        }
        const [before, after] = await Promise.all([pixels(a), pixels(b)])
        const { width, height } = after
        // Count clearly orange pixels (the retro colour) and changed pixels per region.
        const orange = (data: Uint8ClampedArray, i: number) => data[i] > 200 && data[i + 1] > 90 && data[i + 1] < 180 && data[i + 2] < 90
        let cornerOrange = 0
        let elsewhereOrange = 0
        let cornerChanged = 0
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            const inCorner = x > width * 0.6 && y > height * 0.8
            const isOrange = orange(after.data, i) && !orange(before.data, i)
            if (inCorner) {
              if (isOrange) cornerOrange++
              if (Math.abs(after.data[i] - before.data[i]) + Math.abs(after.data[i + 1] - before.data[i + 1]) > 60) cornerChanged++
            } else if (isOrange) elsewhereOrange++
          }
        }
        return { cornerOrange, elsewhereOrange, cornerChanged }
      },
      [original.toString("base64"), saved.toString("base64")],
    )
    expect(result.cornerOrange).toBeGreaterThan(500)
    expect(result.cornerChanged).toBeGreaterThan(500)
    expect(result.elsewhereOrange).toBeLessThan(50)
  })

  test("is saved as a new file next to the original's name, never replacing it", async ({ page }) => {
    const before = await readFile(fixture("exif-full.jpg"))
    await useFileDownloads(page)
    await visit(page)
    await addPhotos(page, [fixture("exif-full.jpg")])
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-save-all]").click()])
    expect(download.suggestedFilename()).toBe("exif-full-date.jpg")
    // The picked file itself is untouched, byte for byte (the browser only ever reads it).
    expect((await readFile(fixture("exif-full.jpg"))).equals(before)).toBe(true)
    expect((await readFile(await download.path())).equals(before)).toBe(false)
  })

  test("keeps the EXIF: date taken, camera, lens and GPS", async ({ page }) => {
    const saved = await saveOne(page, "exif-full.jpg")
    const exif = await tags(saved)
    expect(exifDate(exif.DateTimeOriginal)).toBe("2019:08:03 12:34:56")
    expect(exif.Make).toBe("TestCam")
    expect(exif.Model).toBe("X100")
    expect(exif.LensModel).toBe("23mm F2")
    expect(exif.latitude).toBeCloseTo(50.0614, 3)
    expect(exif.longitude).toBeCloseTo(19.9366, 3)
    expect(exif.ExifImageWidth).toBe(1600)
  })

  test("carries a date changed under the thumbnail into the EXIF", async ({ page }) => {
    const saved = await saveOne(page, "exif-full.jpg", async (page) => {
      await page.locator(".photo-date summary").click()
      await page.locator('.photo-date input[type="datetime-local"]').fill("2001-02-03T04:05")
    })
    expect(exifDate((await tags(saved)).DateTimeOriginal)).toBe("2001:02:03 04:05:00")
  })

  test("gives a photo without EXIF the date it was stamped with", async ({ page }) => {
    let shown = ""
    const saved = await saveOne(page, "no-exif-square.jpg", async (page) => {
      shown = await page.locator('.photo-date input[type="datetime-local"]').inputValue()
    })
    // The input shows minutes; the EXIF keeps the file date's seconds too.
    expect(exifDate((await tags(saved)).DateTimeOriginal).slice(0, 16)).toBe(shown.replace("-", ":").replace("-", ":").replace("T", " "))
  })

  test("turns a sideways photo upright, and says so in the EXIF", async ({ page }) => {
    // Stored 800×600 with Orientation 6 (rotate 90°): shown 600×800.
    const saved = await saveOne(page, "rotated.jpg")
    expect(jpegSize(saved)).toEqual({ width: 600, height: 800 })
    const exif = await tags(saved)
    expect(exif.Orientation).toBe(1)
    expect(exifDate(exif.DateTimeOriginal)).toBe("2020:01:02 03:04:05")
  })

  test("keeps the EXIF in the ZIP too", async ({ page }) => {
    await useFileDownloads(page)
    await visit(page)
    await addPhotos(page, [fixture("exif-full.jpg"), fixture("rotated.jpg")])
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-zip]").click()])
    const { default: JSZip } = await import("jszip")
    const zip = await JSZip.loadAsync(await readFile(await download.path()))
    const photo = await zip.file("exif-full-date.jpg")!.async("nodebuffer")
    expect((await tags(photo)).Make).toBe("TestCam")
  })
})
