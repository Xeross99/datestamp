// Reading a photo the user picked: its date (EXIF first, the file's
// modification time as a fallback) and a decoded image.

export type DateSource = "exif" | "file"

export async function photoDate(file: File): Promise<{ date: Date; source: DateSource }> {
  try {
    // Loaded with the first photo, not with the page (it is a third of the editor's code).
    const { default: exifr } = await import("exifr")
    const tags = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"])
    const date = tags?.DateTimeOriginal ?? tags?.CreateDate
    if (date instanceof Date && !Number.isNaN(date.getTime())) return { date, source: "exif" }
  } catch {
    // No EXIF, or a format exifr cannot read: fall back to the file's date.
  }
  return { date: new Date(file.lastModified), source: "file" }
}

/**
 * The decoded photo, already turned upright: createImageBitmap applies the
 * EXIF orientation by default (imageOrientation: "from-image").
 * Throws for formats the browser cannot decode (HEIC outside Safari).
 */
export function decodePhoto(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file)
}

export function stampedFileName(name: string) {
  return name.replace(/\.[^.]+$/, "") + "-date.jpg"
}
