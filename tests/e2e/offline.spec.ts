import { expect } from "@playwright/test"
import { strings } from "../../src/i18n"
import { addPhotos, fixture, test } from "./helpers"

test.describe("offline (PWA)", () => {
  test.use({ serviceWorkers: "allow" })

  test("after one visit the editor opens and works without a network, in every language", async ({ page, context }) => {
    await page.goto("/pl/")
    // Installed and in control of the page: the files are kept.
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

    await context.setOffline(true)
    await page.reload()
    await expect(page.locator("h1")).toHaveText(strings.pl.home.h1)
    await addPhotos(page, [fixture("exif-landscape.jpg")])

    // Another language's home page was kept too, without a visit.
    await page.goto("/de/")
    await expect(page.locator("html")).toHaveAttribute("lang", "de")
    // A page never visited falls back to its language's home page.
    await page.goto("/de/datenschutz/")
    await expect(page.locator("h1")).toHaveText(strings.de.home.h1)
  })

  test("the manifest lets the site be installed", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json()
    expect(manifest).toMatchObject({ display: "standalone", start_url: "./" })
    expect((await request.get("/sw.js")).status()).toBe(200)
  })
})
