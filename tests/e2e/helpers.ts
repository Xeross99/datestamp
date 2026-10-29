import { test as base, expect, type Page } from "@playwright/test"
import path from "node:path"

export const fixture = (name: string) => path.join(import.meta.dirname, "..", "fixtures", name)

export const PHOTOS = ["exif-landscape.jpg", "no-exif-portrait.jpg", "no-exif-square.jpg"].map(fixture)

/** A fresh visit: no remembered options or theme. */
export async function visit(page: Page, path = "/pl/") {
  await page.goto(path)
  // Everything but the cookie choice, which the test fixture sets.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) if (key !== "datestamp:consent") localStorage.removeItem(key)
  })
  await page.reload()
}

/** Picks photos with the file input and waits until every card is ready. */
export async function addPhotos(page: Page, files = PHOTOS) {
  await page.locator("[data-input]").setInputFiles(files)
  await expect(page.locator(".photo")).toHaveCount(files.length)
  await expect(page.locator('.photo[data-state="ready"]')).toHaveCount(files.length)
}

/** Forces the "every photo downloads as a file" mode (no folder picker, no share sheet). */
export async function useFileDownloads(page: Page) {
  await page.addInitScript(() => {
    delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker
    Object.defineProperty(navigator, "canShare", { value: undefined })
  })
}

/**
 * Every test: no requests to Google's ad servers, and the cookie choice
 * already made (rejected), so the banner does not cover the page. A test
 * about the banner sets `consent: null`.
 */
export const test = base.extend<{ consent: { analytics: boolean; ads: boolean } | null }>({
  consent: [{ analytics: false, ads: false }, { option: true }],
  page: async ({ page, consent }, use) => {
    await page.route(/googlesyndication|doubleclick|googleadservices|googletagmanager|google-analytics/, (route) => route.abort())
    if (consent) {
      await page.addInitScript((value) => {
        if (!localStorage.getItem("datestamp:consent")) localStorage.setItem("datestamp:consent", value)
      }, JSON.stringify({ ...consent, at: "2026-10-29T00:00:00.000Z" }))
    }
    await use(page)
  },
})
