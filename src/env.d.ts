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
