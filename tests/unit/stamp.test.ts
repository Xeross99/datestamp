import { describe, expect, it } from "vitest"
import { fitPixels, formatDate, MAX_EXPORT_PIXELS, maxExportPixels, SAFE_EXPORT_PIXELS, type DateFormat } from "../../src/lib/stamp"

const date = new Date(2026, 6, 4, 9, 5) // 4 July 2026, 09:05

describe("formatDate", () => {
  it.each<[DateFormat, string]>([
    ["retro", "'26 7 4"],
    ["dmy", "04.07.2026"],
    ["dmy-time", "04.07.2026 09:05"],
    ["dmy-slash", "04/07/2026"],
    ["dmy-slash-time", "04/07/2026 09:05"],
    ["dmy-dash", "04-07-2026"],
    ["dmy-dash-time", "04-07-2026 09:05"],
    ["mdy", "07/04/2026"],
    ["iso", "2026-07-04"],
  ])("%s → %s", (format, expected) => {
    expect(formatDate(date, format)).toBe(expected)
  })

  it("pads the year in the retro format", () => {
    expect(formatDate(new Date(2005, 0, 1), "retro")).toBe("'05 1 1")
  })
})

describe("fitPixels", () => {
  it("never upscales", () => {
    expect(fitPixels(800, 600, MAX_EXPORT_PIXELS)).toEqual({ width: 800, height: 600 })
  })

  it("scales a 48 MP photo under the iOS canvas limit, keeping its shape", () => {
    const { width, height } = fitPixels(8064, 6048, SAFE_EXPORT_PIXELS)
    expect(width * height).toBeLessThanOrEqual(SAFE_EXPORT_PIXELS)
    expect(width / height).toBeCloseTo(8064 / 6048, 2)
  })
})

describe("maxExportPixels", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36"

  it("caps iPhones and iPads (which report a Mac with a touch screen) at the iOS canvas limit", () => {
    expect(maxExportPixels(IPHONE, 5)).toBe(SAFE_EXPORT_PIXELS)
    expect(maxExportPixels(MAC, 5)).toBe(SAFE_EXPORT_PIXELS)
  })

  it("keeps a 6000×6000 photo whole on a computer and on Android", () => {
    for (const [agent, touch] of [[MAC, 0], [ANDROID, 5]] as const) {
      expect(maxExportPixels(agent, touch)).toBe(MAX_EXPORT_PIXELS)
      expect(fitPixels(6000, 6000, maxExportPixels(agent, touch))).toEqual({ width: 6000, height: 6000 })
    }
  })
})
