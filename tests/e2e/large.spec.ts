// A big, heavy photo (6000×6000 = 36 MP, many MB) must come out whole: full
// size, the date on it, the rest unchanged, the EXIF kept. Generated at test
// time (texture that compresses badly, camera EXIF from a fixture) so no
// heavy file lives in the repository.
import { expect, type Page } from "@playwright/test"
import exifr from "exifr"
import { readFile, writeFile } from "node:fs/promises"
import { exifSegment, fitExif, insertExif } from "../../src/lib/exif"
import { addPhotos, fixture, test, useFileDownloads, visit } from "./helpers"

const SIZE = 6000

test.describe.configure({ timeout: 180_000 })

async function makeBigPhoto(page: Page, path: string) {
  const base64 = await page.evaluate(async (size) => {
    const canvas = new OffscreenCanvas(size, size)
    const context = canvas.getContext("2d")!
    const gradient = context.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, "#3a6ea5")
    gradient.addColorStop(1, "#c8a165")
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    // Noise in 1000-px tiles: real-photo texture, many MB as a JPEG.
    const tile = context.createImageData(1000, 1000)
    let seed = 7
    for (let i = 0; i < tile.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      tile.data[i] = seed % 160
      tile.data[i + 1] = (seed >> 8) % 160
      tile.data[i + 2] = (seed >> 16) % 160
      tile.data[i + 3] = 110
    }
    const tileBitmap = await createImageBitmap(tile)
    for (let y = 0; y < size; y += 1000) for (let x = 0; x < size; x += 1000) context.drawImage(tileBitmap, x, y)
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.95 })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ""
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(binary)
  }, SIZE)
  // The camera EXIF of a real fixture, sized to this photo.
  const camera = exifSegment(new Uint8Array(await readFile(fixture("exif-full.jpg"))))!
  const jpeg = insertExif(new Uint8Array(Buffer.from(base64, "base64")), fitExif(camera, { width: SIZE, height: SIZE })!)
  await writeFile(path, jpeg)
  return Buffer.from(jpeg)
}

function jpegSize(jpeg: Buffer) {
  let at = 2
  while (at < jpeg.length) {
    const marker = jpeg[at + 1]
    if (marker >= 0xc0 && marker <= 0xc3) return { width: jpeg.readUInt16BE(at + 7), height: jpeg.readUInt16BE(at + 5) }
    at += 2 + jpeg.readUInt16BE(at + 2)
  }
  throw new Error("no frame header")
}

test("a 6000×6000 photo of many MB comes out whole, with the date, and its EXIF", async ({ page }, testInfo) => {
  await useFileDownloads(page)
  await page.addInitScript(() =>
    localStorage.setItem("datestamp:options", JSON.stringify({ style: "retro", format: "retro", position: "bottom-right", size: 4 })),
  )
  await visit(page)
  const path = testInfo.outputPath("big-6000.jpg")
  const original = await makeBigPhoto(page, path)
  expect(original.length).toBeGreaterThan(8_000_000)

  const started = Date.now()
  await addPhotos(page, [path])
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.locator("[data-save-all]").click()])
  const saved = await readFile(await download.path())
  const seconds = (Date.now() - started) / 1000
  testInfo.annotations.push({ type: "timing", description: `added and saved in ${seconds.toFixed(1)} s, ${(saved.length / 1e6).toFixed(1)} MB` })

  // Whole: the full size, not scaled down.
  expect(jpegSize(saved)).toEqual({ width: SIZE, height: SIZE })

  // The EXIF survives, with the right size.
  const exif = await exifr.parse(saved, { tiff: true, exif: true, gps: true })
  expect(exif.Make).toBe("TestCam")
  expect(exif.latitude).toBeCloseTo(50.0614, 3)
  expect([exif.ExifImageWidth, exif.ExifImageHeight]).toEqual([SIZE, SIZE])

  // The date is in the corner, and the rest is the original (sampled, 36 MP is a lot).
  const check = await page.evaluate(
    async ([a, b]) => {
      const decode = async (base64: string) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${base64}`)).blob())
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext("2d")!
        context.drawImage(bitmap, 0, 0)
        return context
      }
      const [before, after] = await Promise.all([decode(a), decode(b)])
      const size = after.canvas.width
      // Top 70 %: every 7th pixel.
      const top = Math.floor(size * 0.7)
      const x = before.getImageData(0, 0, size, top).data
      const y = after.getImageData(0, 0, size, top).data
      let sum = 0
      let count = 0
      for (let i = 0; i < x.length; i += 4 * 7) {
        for (let c = 0; c < 3; c++) sum += (x[i + c] - y[i + c]) ** 2
        count += 3
      }
      const psnr = 10 * Math.log10(255 ** 2 / (sum / count))
      // Bottom-right corner: orange retro digits that were not there before.
      const cx = Math.floor(size * 0.6)
      const cy = Math.floor(size * 0.85)
      const c0 = before.getImageData(cx, cy, size - cx, size - cy).data
      const c1 = after.getImageData(cx, cy, size - cx, size - cy).data
      const orange = (d: Uint8ClampedArray, i: number) => d[i] > 200 && d[i + 1] > 90 && d[i + 1] < 180 && d[i + 2] < 90
      let digits = 0
      for (let i = 0; i < c1.length; i += 4) if (orange(c1, i) && !orange(c0, i)) digits++
      return { psnr, digits }
    },
    [original.toString("base64"), saved.toString("base64")],
  )
  // Pure per-pixel noise is the worst case for re-encoding any JPEG, so the
  // bar is 38 dB here (still invisible to the eye); a real photo keeps the
  // 40 dB of tests/e2e/quality.spec.ts.
  expect(check.psnr).toBeGreaterThanOrEqual(38)
  expect(check.digits).toBeGreaterThan(5000)
})
