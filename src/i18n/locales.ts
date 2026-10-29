// The site's languages. Kept apart from the strings so astro.config.mjs
// can import it (the sitemap's hreflang list) without loading the
// translations. A new locale: add it here and add src/i18n/<locale>.ts.

export const locales = ["en", "pl", "de", "es", "fr", "it", "pt"] as const
export type Locale = (typeof locales)[number]

/** Served without a prefix (/), every other locale under /<locale>/. */
export const defaultLocale: Locale = "en"

/** og:locale for each language: the region whose readers the copy is written for. */
export const ogLocales: Record<Locale, string> = {
  en: "en_GB",
  pl: "pl_PL",
  de: "de_DE",
  es: "es_ES",
  fr: "fr_FR",
  it: "it_IT",
  pt: "pt_BR",
}
