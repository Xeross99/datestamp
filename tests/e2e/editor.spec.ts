import { expect } from "@playwright/test"
import JSZip from "jszip"
import { readFile } from "node:fs/promises"
import { addPhotos, fixture, PHOTOS, test, useFileDownloads, visit } from "./helpers"

test.describe("adding photos", () => {
  test("reads the EXIF date, or falls back to the file's date", async ({ page }) => {
    await visit(page)
    await addPhotos(page)

    const first = page.locator(".photo").first()
    await expect(first.locator("[data-source]")).toHaveText("EXIF")
    await expect(first.locator('input[type="datetime-local"]')).toHaveValue("1998-07-14T18:30")
    await expect(page.locator(".photo").nth(1).locator("[data-source]")).toHaveText("data pliku")
    // The date under the thumbnail, in the page's format.
    await expect(first.locator("[data-date-label]")).toHaveText("14.07.1998")
  })

  test("shows progress and finishes it", async ({ page }) => {
    await visit(page)
    await addPhotos(page)
    const progress = page.locator("[data-progress]")
    await expect(progress).toHaveAttribute("data-open", "")
    await expect(progress).toHaveAttribute("data-finished", "")
    await expect(progress.locator("[data-progress-count]")).toHaveText("3 / 3")
    // It closes by itself, animated down to no height, and is inert then.
    await expect(progress).not.toHaveAttribute("data-open", /.*/, { timeout: 5000 })
    await expect.poll(() => progress.evaluate((element) => element.getBoundingClientRect().height)).toBe(0)
    await expect(progress).toHaveJSProperty("inert", true)
  })

  test("takes a photo dropped anywhere on the page", async ({ page }) => {
    await visit(page)
    const bytes = (await readFile(PHOTOS[0])).toString("base64")
    await page.evaluate(async (base64) => {
      const blob = await (await fetch(`data:image/jpeg;base64,${base64}`)).blob()
      const transfer = new DataTransfer()
      transfer.items.add(new File([blob], "dropped.jpg", { type: "image/jpeg" }))
      const footer = document.querySelector("footer")!
      for (const type of ["dragenter", "dragover", "drop"])
        footer.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }))
    }, bytes)
    await expect(page.locator('.photo[data-state="ready"]')).toHaveCount(1)
  })

  test("says so when a file is not a photo", async ({ page }) => {
    await visit(page)
    await page.locator("[data-input]").setInputFiles(fixture("not-a-photo.txt"))
    await expect(page.getByText("Ta przeglądarka nie otworzy pliku not-a-photo.txt", { exact: false })).toBeVisible()
    await expect(page.locator(".photo")).toHaveCount(0)
  })

  test("removes one photo and clears all", async ({ page }) => {
    await visit(page)
    await addPhotos(page)
    await page.locator(".photo").first().locator("[data-remove]").click()
    await expect(page.locator(".photo")).toHaveCount(2)
    await page.locator("[data-clear]").click()
    await expect(page.locator(".photo")).toHaveCount(0)
    await expect(page.locator("[data-dropzone]")).toBeVisible()
    await expect(page.locator("[data-save-all]")).toBeDisabled()
  })
})

test.describe("saving", () => {
  test("downloads every photo as its own full-size JPEG and marks it done", async ({ page }) => {
    await useFileDownloads(page)
    await visit(page)
    await addPhotos(page)
    await expect(page.locator("[data-save-all]")).toHaveText("Pobierz wszystkie")

    const downloads: string[] = []
    page.on("download", (download) => downloads.push(download.suggestedFilename()))
    await page.locator("[data-save-all]").click()

    await expect(page.locator('.photo[data-state="done"]')).toHaveCount(3)
    await expect(page.locator("[data-progress]")).toHaveAttribute("data-finished", "")
    await expect.poll(() => downloads.sort()).toEqual(["exif-landscape-date.jpg", "no-exif-portrait-date.jpg", "no-exif-square-date.jpg"])
  })

  test("exports at the photo's own size", async ({ page }) => {
    await useFileDownloads(page)
    await visit(page)
    await addPhotos(page, [PHOTOS[0]])
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-save-all]").click()])
    const jpeg = await readFile(await download.path())
    const size = await page.evaluate(async (base64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${base64}`)).blob())
      return [bitmap.width, bitmap.height]
    }, jpeg.toString("base64"))
    expect(size).toEqual([1200, 800])
  })

  test("packs a ZIP on request, with one file per photo", async ({ page }) => {
    await useFileDownloads(page)
    await visit(page)
    await addPhotos(page)
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-zip]").click()])
    expect(download.suggestedFilename()).toBe("datestamp.zip")
    const zip = await JSZip.loadAsync(await readFile(await download.path()))
    expect(Object.keys(zip.files).sort()).toEqual(["exif-landscape-date.jpg", "no-exif-portrait-date.jpg", "no-exif-square-date.jpg"])
  })

  test("a changed option makes done photos ready again", async ({ page }) => {
    await useFileDownloads(page)
    await visit(page)
    await addPhotos(page, [PHOTOS[0]])
    await Promise.all([page.waitForEvent("download"), page.locator("[data-save-all]").click()])
    await expect(page.locator('.photo[data-state="done"]')).toHaveCount(1)
    await page.locator('label:has(input[name="style"][value="label"])').click()
    await expect(page.locator('.photo[data-state="ready"]')).toHaveCount(1)
  })
})

test.describe("options", () => {
  test("a style tile and a corner are picked and remembered", async ({ page }) => {
    await visit(page)
    await page.locator('label:has(input[name="style"][value="classic"])').click()
    await page.locator('label:has(input[name="position"][value="top-left"])').click()
    await expect(page.locator("[data-position-label]")).toHaveText("Lewa góra")
    // The position picker shows the date in the picked style.
    await expect(page.locator("[data-stamp-live]").first()).toHaveAttribute("data-style", "classic")
    await page.reload()
    await expect(page.locator('input[name="style"][value="classic"]')).toBeChecked()
    await expect(page.locator('input[name="position"][value="top-left"]')).toBeChecked()
  })

  test("the sample dates follow the format", async ({ page }) => {
    await visit(page)
    await page.locator("#select-format button").click()
    await page.locator('#select-format el-option[value="iso"]').click()
    await expect(page.locator("[data-stamp-sample]").first()).toHaveText("2026-07-14")
  })

  test("the settings are locked while saving", async ({ page }) => {
    await useFileDownloads(page)
    await visit(page)
    await addPhotos(page)
    await page.locator("[data-save-all]").click()
    await expect(page.locator("[data-options]")).toHaveAttribute("disabled", "")
    await expect(page.locator('input[name="style"][value="label"]')).toBeDisabled()
    await expect(page.locator("[data-save-hint]")).toHaveText("Ustawienia są zablokowane do końca zapisu.")
    await expect(page.locator('.photo[data-state="done"]')).toHaveCount(3)
    await expect(page.locator("[data-options]")).not.toHaveAttribute("disabled", /.*/)
    await expect(page.locator("[data-save-hint]")).toHaveText("Gotowe zdjęcia mają zieloną ramkę.")
  })

  test("offers the page's language's date format first, and remembers a pick", async ({ page }) => {
    await visit(page, "/pl/")
    await expect(page.locator("#select-format el-selectedcontent")).toHaveText("14.07.2026")

    await page.locator("#select-format button").click()
    await page.locator('#select-format el-option[value="iso"]').click()
    await page.reload()
    await expect(page.locator("#select-format el-selectedcontent")).toHaveText("2026-07-14")
  })

  test("English pages offer both day-first and month-first", async ({ page }) => {
    await visit(page, "/")
    const options = page.locator("#select-format el-option")
    await expect(options.first()).toHaveAttribute("value", "dmy-slash")
    await expect(page.locator('#select-format el-option[value="mdy"]')).toHaveCount(1)
  })
})

test("with a mouse a long album scrolls inside the editor; on a touch screen the page scrolls", async ({ page, isMobile }) => {
  await visit(page)
  const photo = await readFile(fixture("no-exif-square.jpg"))
  const files = Array.from({ length: 16 }, (_, i) => ({ name: `photo-${i}.jpg`, mimeType: "image/jpeg", buffer: photo }))
  await page.locator("[data-input]").setInputFiles(files)
  await expect(page.locator('.photo[data-state="ready"]')).toHaveCount(16)
  const grid = page.locator("[data-photos]")
  if (isMobile) {
    await expect(grid).toHaveCSS("overflow-y", "visible")
  } else {
    await expect(grid).toHaveCSS("overflow-y", "auto")
    expect((await grid.boundingBox())!.height).toBeLessThanOrEqual(388 + 1)
    expect(await grid.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  }
  await expect(page.locator(".photo [data-remove]").first()).toHaveCSS("cursor", "pointer")
})
