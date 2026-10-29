import exifr from "exifr"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { buildExif, exifDate, exifSegment, fitExif, insertExif } from "../../src/lib/exif"

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)))
// A stand-in for what a canvas encodes: a JPEG with a JFIF segment and no EXIF.
const canvasJpeg = () => {
  const original = fixture("no-exif-square.jpg")
  expect(exifSegment(original)).toBeNull()
  return original
}
const parse = (jpeg: Uint8Array) => exifr.parse(jpeg, { tiff: true, exif: true, gps: true, translateValues: false })

describe("exifSegment", () => {
  it("finds the EXIF of a camera photo and nothing in a photo without one", () => {
    expect(exifSegment(fixture("exif-full.jpg"))?.slice(0, 2)).toEqual(new Uint8Array([0xff, 0xe1]))
    expect(exifSegment(fixture("no-exif-portrait.jpg"))).toBeNull()
    expect(exifSegment(new TextEncoder().encode("not a jpeg"))).toBeNull()
  })
})

describe("fitExif + insertExif", () => {
  it("keeps the date, the camera and the place", async () => {
    const segment = fitExif(exifSegment(fixture("exif-full.jpg"))!, { width: 1600, height: 1200 })!
    const tags = await parse(insertExif(canvasJpeg(), segment))
    expect(exifDate(tags.DateTimeOriginal)).toBe("2019:08:03 12:34:56")
    expect(tags.Make).toBe("TestCam")
    expect(tags.Model).toBe("X100")
    expect(tags.latitude).toBeCloseTo(50.0614, 3)
    expect(tags.longitude).toBeCloseTo(19.9366, 3)
  })

  it("turns the orientation upright and writes the new size", async () => {
    const segment = fitExif(exifSegment(fixture("rotated.jpg"))!, { width: 600, height: 800 })!
    const tags = await parse(insertExif(canvasJpeg(), segment))
    expect(tags.Orientation).toBe(1)
  })

  it("writes the new pixel size (a big photo is scaled down on export)", async () => {
    const segment = fitExif(exifSegment(fixture("exif-full.jpg"))!, { width: 800, height: 600 })!
    const tags = await parse(insertExif(canvasJpeg(), segment))
    expect([tags.ExifImageWidth, tags.ExifImageHeight]).toEqual([800, 600])
  })

  it("writes a changed date", async () => {
    const segment = fitExif(exifSegment(fixture("exif-full.jpg"))!, { width: 1600, height: 1200, date: new Date(2001, 1, 3, 4, 5, 6) })!
    const tags = await parse(insertExif(canvasJpeg(), segment))
    expect(exifDate(tags.DateTimeOriginal)).toBe("2001:02:03 04:05:06")
  })

  it("puts EXIF right after the start of the file, instead of the canvas's JFIF", () => {
    const out = insertExif(canvasJpeg(), buildExif(new Date()))
    expect([...out.slice(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe1])
    expect(exifSegment(out)).not.toBeNull()
  })

  it("gives up on a broken segment instead of writing garbage", () => {
    const broken = exifSegment(fixture("exif-full.jpg"))!.slice(0, 20)
    expect(fitExif(broken, { width: 1, height: 1 })).toBeNull()
  })
})

describe("buildExif", () => {
  it("is a valid EXIF with the date and an upright orientation", async () => {
    const tags = await parse(insertExif(canvasJpeg(), buildExif(new Date(2026, 6, 14, 18, 30, 0))))
    expect(exifDate(tags.DateTimeOriginal)).toBe("2026:07:14 18:30:00")
    expect(tags.Orientation).toBe(1)
  })
})
