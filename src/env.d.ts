interface ImportMetaEnv {
  readonly PUBLIC_ADSENSE_CLIENT?: string
  readonly PUBLIC_ADSENSE_SLOT_LEFT?: string
  readonly PUBLIC_ADSENSE_SLOT_RIGHT?: string
  readonly PUBLIC_ADSENSE_SLOT_INLINE?: string
  /** Google Analytics 4 measurement id, G-XXXXXXXXXX. */
  readonly PUBLIC_GA_ID?: string
  /** Shown on the privacy page, which AdSense requires. */
  readonly PUBLIC_CONTACT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// libheif-js ships no types for its browser bundle (src/lib/heic.ts types what it uses).
declare module "libheif-js/libheif-wasm/libheif-bundle.mjs" {
  const load: () => unknown
  export default load
}
