// HEIC/HEIF (iPhone photos) for browsers that cannot decode it themselves:
// Chrome, Edge and Firefox. libheif compiled to WebAssembly (libheif-js,
// LGPL-3.0, loaded as its own file), about 2 MB, so it is imported only
// when such a photo arrives, never with the page.

type HeifImage = {
  is_primary(): boolean
  get_width(): number
  get_height(): number
  display(target: ImageData, done: (result: ImageData | null) => void): void
  free(): void
}
type Libheif = { HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] } }

let libheif: Promise<Libheif> | undefined

/** Whether a file is HEIC/HEIF: its name, its type, or its first bytes (an ISO-BMFF "ftyp" box with a HEIF brand). */
export async function isHeic(file: File): Promise<boolean> {
  if (/\.(heic|heif)$/i.test(file.name) || /^image\/hei[cf]/.test(file.type)) return true
  const head = new TextDecoder("latin1").decode(await file.slice(4, 12).arrayBuffer())
  return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(head)
}

/** The photo's main image, decoded, upright (libheif applies the HEIF rotation). */
export async function decodeHeic(file: File): Promise<ImageBitmap> {
  libheif ??= import("libheif-js/libheif-wasm/libheif-bundle.mjs").then(async ({ default: load }) => (await load()) as Libheif)
  const { HeifDecoder } = await libheif
  const images = new HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()))
  const image = images.find((candidate) => candidate.is_primary()) ?? images[0]
  if (!image) throw new Error(`No image in ${file.name}`)
  try {
    const pixels = new ImageData(image.get_width(), image.get_height())
    await new Promise<void>((resolve, reject) => image.display(pixels, (result) => (result ? resolve() : reject(new Error(`Cannot decode ${file.name}`)))))
    return await createImageBitmap(pixels)
  } finally {
    images.forEach((each) => each.free())
  }
}
