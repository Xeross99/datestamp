import { expect } from "@playwright/test"
import { locales, pages, pathOf, strings } from "../../src/i18n"
import { test, visit } from "./helpers"

for (const locale of locales) {
  test(`${locale}: home page has its language, title and hreflang alternates`, async ({ page }) => {
    await page.goto(pathOf("home", locale))
    await expect(page.locator("html")).toHaveAttribute("lang", locale)
    await expect(page).toHaveTitle(strings[locale].home.title)
    await expect(page.locator("h1")).toHaveText(strings[locale].home.h1)
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(locales.length + 1)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${pathOf("home", locale)}$`))
  })
}

test("every page in every locale answers", async ({ request }) => {
  for (const locale of locales) {
    for (const page of pages) {
      const response = await request.get(pathOf(page, locale))
      expect(response.status(), pathOf(page, locale)).toBe(200)
    }
  }
})

test("the language menu keeps the page and switches the language", async ({ page }) => {
  await page.goto(pathOf("iphone", "pl"))
  await page.locator("header summary").click()
  await page.locator('header a[hreflang="de"]').click()
  await expect(page).toHaveURL(new RegExp(`${pathOf("iphone", "de")}$`))
  await expect(page.locator("html")).toHaveAttribute("lang", "de")
})

test("the theme switch applies and remembers a theme, and system forgets it", async ({ page }) => {
  await visit(page)
  await page.locator('header [data-theme-choice="dark"]').click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  await expect(page.locator('header [data-theme-choice="dark"]')).toHaveAttribute("aria-pressed", "true")

  await page.locator('header [data-theme-choice="system"]').click()
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/)
  await page.reload()
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/)
})

test("no horizontal scrolling", async ({ page }) => {
  await page.goto("/pl/")
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflows).toBe(false)
})

test("sitemap and ads.txt are published", async ({ request }) => {
  expect((await request.get("/sitemap-index.xml")).status()).toBe(200)
  expect((await request.get("/ads.txt")).status()).toBe(200)
})

test("share picture, description and icons are set", async ({ page, request }) => {
  await page.goto(pathOf("home", "pl"))
  const image = await page.locator('meta[property="og:image"]').getAttribute("content")
  expect(image).toMatch(/\/og\/pl\.png$/)
  expect((await request.get(new URL(image!).pathname)).headers()["content-type"]).toContain("image/png")
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "pl_PL")
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", strings.pl.home.description)
  for (const icon of ["/favicon.svg", "/favicon-32.png", "/apple-touch-icon.png", "/icon-512.png", "/icon-maskable-512.png"]) {
    expect((await request.get(icon)).status(), icon).toBe(200)
  }
})

test("JSON-LD is one valid graph with the site, the app and the page", async ({ page }) => {
  for (const [path, extra] of [[pathOf("home", "pl"), "FAQPage"], [pathOf("iphone", "pl"), "HowTo"]] as const) {
    await page.goto(path)
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(blocks).toHaveLength(1)
    const graph = JSON.parse(blocks[0])["@graph"] as { "@type": string }[]
    expect(graph.map((node) => node["@type"])).toEqual(["WebSite", "WebApplication", "WebPage", extra])
  }
})

test("robots.txt welcomes crawlers and llms.txt describes the site", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text()
  expect(robots).toContain("Allow: /")
  expect(robots).toContain("ClaudeBot")
  expect(robots).toMatch(/Sitemap: .*sitemap-index\.xml/)
  const llms = await (await request.get("/llms.txt")).text()
  expect(llms.startsWith("# DateStamp")).toBe(true)
  for (const locale of locales) expect(llms).toContain(pathOf("home", locale))
})

test("the navbar links the page's sections; on a phone they are in a menu that closes itself", async ({ page, isMobile }) => {
  await page.goto(pathOf("home", "pl"))
  if (!isMobile) {
    await expect(page.locator('header nav > ul a[aria-current="page"]')).toHaveText(strings.pl.nav.editor)
    await page.locator("header nav").getByRole("link", { name: strings.pl.nav.faq }).click()
    await expect(page).toHaveURL(/#faq$/)
    // The heading it landed on lights up, and the underline has moved under "FAQ".
    await expect(page.locator("#faq")).toHaveClass(/is-target/)
    const underline = page.locator("[data-nav-indicator]")
    const faqLink = page.locator("header nav").getByRole("link", { name: strings.pl.nav.faq })
    await expect
      .poll(async () => {
        const [line, link] = await Promise.all([underline.boundingBox(), faqLink.boundingBox()])
        return Math.round(line!.x + line!.width / 2) - Math.round(link!.x + link!.width / 2)
      })
      .toBeLessThanOrEqual(1)
    return
  }
  await page.getByRole("button", { name: strings.pl.nav.menu }).click()
  // The <dialog> itself has no size (its sheet is fixed), so look at its links.
  const faqLink = page.locator("#mobile-menu").getByRole("link", { name: strings.pl.nav.faq })
  await expect(faqLink).toBeVisible()
  await faqLink.click()
  await expect(page).toHaveURL(/#faq$/)
  await expect(faqLink).toBeHidden()
})

test.describe("cookie banner", () => {
  test.use({ consent: null })

  // The AdSense flags live on the adsbygoogle array, which evaluate() would copy without them.
  const ads = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const queue = (window as unknown as { adsbygoogle: { pauseAdRequests?: number; requestNonPersonalizedAds?: number } }).adsbygoogle
      return { pauseAdRequests: queue.pauseAdRequests, requestNonPersonalizedAds: queue.requestNonPersonalizedAds }
    })
  const gaLoaded = (page: import("@playwright/test").Page) => page.locator('script[src*="googletagmanager.com/gtag/js"]').count()

  test("asks first: no ad requests and no Google Analytics until a choice", async ({ page }) => {
    await page.goto(pathOf("home", "pl"))
    await expect(page.locator("[data-consent]")).toHaveAttribute("data-open", "")
    expect((await ads(page)).pauseAdRequests).toBe(1)
    expect(await gaLoaded(page)).toBe(0)
  })

  test("reject all: non-personalised ads, no Google Analytics, remembered", async ({ page }) => {
    await page.goto(pathOf("home", "pl"))
    const banner = page.locator("[data-consent]")
    await banner.getByRole("button", { name: strings.pl.consent.reject }).click()
    await expect(banner).not.toHaveAttribute("data-open", /.*/)
    expect(await ads(page)).toMatchObject({ pauseAdRequests: 0, requestNonPersonalizedAds: 1 })
    expect(await gaLoaded(page)).toBe(0)

    await page.reload()
    await expect(banner).not.toHaveAttribute("data-open", /.*/)
    expect((await ads(page)).requestNonPersonalizedAds).toBe(1)
    expect(await gaLoaded(page)).toBe(0)
  })

  test("customize: statistics yes, ads no; cookie settings shows the choice again", async ({ page }) => {
    await page.goto(pathOf("home", "pl"))
    const banner = page.locator("[data-consent]")
    await banner.getByRole("button", { name: strings.pl.consent.customize }).click()
    await expect(banner.getByRole("switch", { name: new RegExp(strings.pl.consent.necessary.title) })).toBeDisabled()
    await banner.getByRole("switch", { name: new RegExp(strings.pl.consent.analytics.title) }).check()
    await banner.getByRole("button", { name: strings.pl.consent.save }).click()
    await expect(banner).not.toHaveAttribute("data-open", /.*/)
    expect(await gaLoaded(page)).toBe(1)
    expect((await ads(page)).requestNonPersonalizedAds).toBe(1)

    // Loaded early on the next page, before anything else.
    await page.reload()
    expect(await gaLoaded(page)).toBe(1)

    await page.getByRole("button", { name: strings.pl.consent.settings }).click()
    await expect(banner).toHaveAttribute("data-open", "")
    await expect(banner.getByRole("switch", { name: new RegExp(strings.pl.consent.analytics.title) })).toBeChecked()
    await expect(banner.getByRole("switch", { name: new RegExp(strings.pl.consent.ads.title) })).not.toBeChecked()
    await banner.getByRole("button", { name: strings.pl.consent.accept }).click()
    expect((await ads(page)).requestNonPersonalizedAds).toBe(0)
  })
})

test("the examples show the three sample photos, credited", async ({ page, request }) => {
  const { samples } = await import("../../src/lib/samples")
  await page.goto(pathOf("home", "pl"))
  const images = page.locator('#examples ~ div img')
  await expect(images).toHaveCount(3)
  for (const [index, { key }] of samples.entries()) {
    await expect(images.nth(index)).toHaveAttribute("src", new RegExp(`/samples/${key}\\.webp$`))
    expect((await request.get(`/samples/${key}.webp`)).status(), key).toBe(200)
  }
  await expect(page.getByRole("link", { name: "Kamil Krzysteczko" })).toBeVisible()
})

test("on the home page the inline ad sits after the examples, before the FAQ, away from the editor", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the inline ad shows only on screens without rails")
  await page.goto(pathOf("home", "pl"))
  const ad = page.locator(".ad-inline")
  await expect(ad).toBeVisible()
  const top = async (selector: string) => (await page.locator(selector).boundingBox())!.y
  const adTop = await top(".ad-inline")
  expect(adTop).toBeGreaterThan(await top("#examples"))
  expect(adTop).toBeLessThan(await top("#faq"))
})

test("a missing address shows the 404 page in the language of its path, not indexed and without ads", async ({ page }) => {
  const response = await page.goto("/pl/nie-ma-takiej-strony/")
  expect(response?.status()).toBe(404)
  await expect(page.locator("html")).toHaveAttribute("lang", "pl")
  await expect(page).toHaveTitle(strings.pl.notFound.title)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(strings.pl.notFound.h1)
  await expect(page.getByRole("link", { name: strings.pl.notFound.cta })).toHaveAttribute("href", /\/pl\/$/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex")
  await expect(page.locator('link[rel="canonical"], script[type="application/ld+json"], ins.adsbygoogle')).toHaveCount(0)
})

test("without ads (a build with no AdSense ids renders no rails) the content keeps its full width", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rails exist only on wide screens")
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(pathOf("home", "pl"))
  await page.evaluate(() => document.querySelectorAll(".ad-rail").forEach((rail) => rail.remove()))
  const box = await page.locator(".page-content").boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(940)
  // and centred
  expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThanOrEqual(10)
})
