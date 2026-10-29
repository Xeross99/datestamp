// Keeping a photo's metadata through the export. Drawing on a canvas and
// encoding a JPEG drops every EXIF field (date taken, camera, lens, GPS),
// so the original's EXIF segment is copied into the new file, with the few
// fields that no longer hold put right:
// - Orientation → 1: the pixels were already turned upright on decoding;
// - the pixel dimensions → the exported size (big photos are scaled down);
// - the date → the one stamped on the photo, when the user changed it;
// - the embedded thumbnail (IFD1) → dropped: it shows the photo without the
//   date, and Finder or a gallery may show the thumbnail instead.
// A photo without EXIF (a screenshot, a PNG, a HEIC) gets a minimal one
// with the date it was stamped with.
//
// No library: a JPEG is a list of segments, and EXIF is a small TIFF
// structure in the APP1 segment.

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] // "Exif\0\0"
/** Where the TIFF structure starts inside an APP1 segment: marker (2), length (2), "Exif\0\0" (6). */
const TIFF_START = 10

const TAG = {
  orientation: 0x0112,
  dateTime: 0x0132,
  exifIfd: 0x8769,
  dateTimeOriginal: 0x9003,
  dateTimeDigitized: 0x9004,
  pixelWidth: 0xa002,
  pixelHeight: 0xa003,
}

/** The EXIF APP1 segment of a JPEG (marker included), or null. */
export function exifSegment(jpeg: Uint8Array): Uint8Array | null {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null
  let at = 2
  while (at + 4 <= jpeg.length && jpeg[at] === 0xff) {
    const marker = jpeg[at + 1]
    if (marker === 0xda || marker === 0xd9) break // image data starts: no more metadata
    const length = (jpeg[at + 2] << 8) | jpeg[at + 3]
    if (marker === 0xe1 && EXIF_HEADER.every((byte, index) => jpeg[at + 4 + index] === byte)) {
      return jpeg.slice(at, at + 2 + length)
    }
    at += 2 + length
  }
  return null
}

/** "2026:07:14 18:30:00", the EXIF date format (local time, like the camera's). */
export function exifDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * A copy of an EXIF segment fitted to the exported file (see the top of the
 * file). Returns null when the segment cannot be read safely; the caller
 * then builds a fresh one.
 */
export function fitExif(segment: Uint8Array, { width, height, date }: { width: number; height: number; date?: Date }): Uint8Array | null {
  try {
    const out = segment.slice()
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
    const tiffLength = out.length - TIFF_START
    const order = view.getUint16(TIFF_START)
    if (order !== 0x4949 && order !== 0x4d4d) return null
    const little = order === 0x4949
    const inside = (offset: number, size: number) => offset >= 0 && offset + size <= tiffLength
    const u16 = (offset: number) => view.getUint16(TIFF_START + offset, little)
    const u32 = (offset: number) => view.getUint32(TIFF_START + offset, little)
    const set16 = (offset: number, value: number) => view.setUint16(TIFF_START + offset, value, little)
    const set32 = (offset: number, value: number) => view.setUint32(TIFF_START + offset, value, little)

    // Calls back for every entry of an IFD; returns where its "next IFD" pointer is.
    const walk = (ifd: number, visit: (tag: number, entry: number) => void) => {
      if (!inside(ifd, 2)) throw new Error("IFD outside the segment")
      const count = u16(ifd)
      if (!inside(ifd + 2, count * 12 + 4)) throw new Error("IFD outside the segment")
      for (let index = 0; index < count; index++) visit(u16(ifd + 2 + index * 12), ifd + 2 + index * 12)
      return ifd + 2 + count * 12
    }
    const setNumber = (entry: number, value: number) => {
      const type = u16(entry + 2)
      if (type === 3) set16(entry + 8, value) // SHORT
      else if (type === 4) set32(entry + 8, value) // LONG
    }
    const text = date ? exifDate(date) : null
    const setDate = (entry: number) => {
      if (!text || u16(entry + 2) !== 2 || u32(entry + 4) < 20) return // ASCII, room for 19 chars + NUL
      const offset = u32(entry + 8)
      if (!inside(offset, 20)) return
      for (let index = 0; index < 19; index++) out[TIFF_START + offset + index] = text.charCodeAt(index)
      out[TIFF_START + offset + 19] = 0
    }

    let exifIfd = 0
    const next = walk(u32(4), (tag, entry) => {
      if (tag === TAG.orientation) set16(entry + 8, 1)
      else if (tag === TAG.exifIfd) exifIfd = u32(entry + 8)
      else if (tag === TAG.dateTime) setDate(entry)
    })
    set32(next, 0) // no IFD1: the old thumbnail goes
    if (exifIfd) {
      walk(exifIfd, (tag, entry) => {
        if (tag === TAG.pixelWidth) setNumber(entry, width)
        else if (tag === TAG.pixelHeight) setNumber(entry, height)
        else if (tag === TAG.dateTimeOriginal || tag === TAG.dateTimeDigitized) setDate(entry)
      })
    }
    return out
  } catch {
    return null
  }
}

/** A minimal EXIF segment: upright, and the date taken (as DateTimeOriginal and DateTimeDigitized). */
export function buildExif(date: Date): Uint8Array {
  // Little-endian TIFF: header (8), IFD0 with 2 entries (30), the Exif IFD
  // with 2 entries (30), then the 20-byte date both entries point to.
  const tiff = new Uint8Array(88)
  const view = new DataView(tiff.buffer)
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(at, tag, true)
    view.setUint16(at + 2, type, true)
    view.setUint32(at + 4, count, true)
    view.setUint32(at + 8, value, true)
  }
  tiff.set([0x49, 0x49, 0x2a, 0x00])
  view.setUint32(4, 8, true) // IFD0 at 8
  view.setUint16(8, 2, true)
  entry(10, TAG.orientation, 3, 1, 1)
  entry(22, TAG.exifIfd, 4, 1, 38)
  view.setUint32(34, 0, true)
  view.setUint16(38, 2, true)
  entry(40, TAG.dateTimeOriginal, 2, 20, 68)
  entry(52, TAG.dateTimeDigitized, 2, 20, 68)
  view.setUint32(64, 0, true)
  const text = exifDate(date)
  for (let index = 0; index < 19; index++) tiff[68 + index] = text.charCodeAt(index)

  const length = 2 + EXIF_HEADER.length + tiff.length
  const segment = new Uint8Array(2 + length)
  segment.set([0xff, 0xe1, length >> 8, length & 0xff, ...EXIF_HEADER])
  segment.set(tiff, TIFF_START)
  return segment
}

/**
 * The JPEG with the EXIF segment right after its start marker, where EXIF
 * belongs (the JFIF segment a canvas writes there is dropped: EXIF replaces it).
 */
export function insertExif(jpeg: Uint8Array, segment: Uint8Array): Uint8Array {
  let rest = 2
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) rest = 4 + ((jpeg[4] << 8) | jpeg[5])
  const out = new Uint8Array(2 + segment.length + jpeg.length - rest)
  out.set([0xff, 0xd8])
  out.set(segment, 2)
  out.set(jpeg.subarray(rest), 2 + segment.length)
  return out
}
