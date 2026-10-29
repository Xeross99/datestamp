// Every user-facing string lives in src/i18n/<locale>.ts, each typed as the
// English file (`satisfies typeof en`), so a key missing in a translation
// fails the build.

import { defaultLocale, locales, ogLocales, type Locale } from "./locales"
import en from "./en"
import pl from "./pl"
import de from "./de"
import es from "./es"
import fr from "./fr"
import it from "./it"
import pt from "./pt"

export { defaultLocale, locales, ogLocales, type Locale }

export type Strings = typeof en
export type EditorStrings = Strings["editor"]

/**
 * Polish typesetting: a one-letter word (a, i, o, u, w, z) must not end a
 * line, so the space after it is a non-breaking one. Applied to every Polish
 * string here rather than typed into pl.ts, where it would be invisible.
 */
function keepOneLetterWords<T>(value: T): T {
  if (typeof value === "string") return value.replace(/(?<=^|[\s(„"])([aiouwzAIOUWZ]) /g, "$1\u00a0") as T
  if (Array.isArray(value)) return value.map(keepOneLetterWords) as T
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, keepOneLetterWords(item)])) as T
  return value
}

export const strings: Record<Locale, Strings> = { en, pl: keepOneLetterWords(pl), de, es, fr, it, pt }

export const t = (locale: Locale) => strings[locale]

/** The pages of the site; each locale gives each its own (translated) slug. */
export const pages = ["home", "iphone", "android", "windows", "mac", "batch", "screenshot", "timestamp", "scanned", "retro", "privacy"] as const
export type Page = (typeof pages)[number]

/** The how-to pages (Guide.astro), each aimed at one search: "add date to photo on iPhone"... */
export const guidePages = ["iphone", "android", "windows", "mac", "batch", "screenshot", "timestamp", "scanned", "retro"] as const satisfies readonly Page[]
export type GuidePage = (typeof guidePages)[number]
export const isGuide = (page: Page): page is GuidePage => (guidePages as readonly Page[]).includes(page)

/** A page's path in a locale, without the base: /, /pl/, /de/datum-auf-foto-iphone/. */
export function pathOf(page: Page, locale: Locale): string {
  const prefix = locale === defaultLocale ? "/" : `/${locale}/`
  return page === "home" ? prefix : `${prefix}${strings[locale].slugs[page]}/`
}

// import.meta.env is Vite's; outside it (the Playwright tests import this
// file for the page paths) there is no base.
const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "")

/** A path with the GitHub Pages base prefixed (/datestamp/pl/ in production). */
export const href = (path: string) => base + path
