// @ts-check
import { defineConfig } from "astro/config"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import serviceWorker from "./integrations/service-worker.mjs"
import { defaultLocale, locales } from "./src/i18n/locales.ts"

// The deploy workflow passes SITE (https://datestamp.eu) and BASE_PATH (/).
// Locally both default to the dev server's root.
export default defineConfig({
  site: process.env.SITE ?? "http://localhost:4321",
  base: process.env.BASE_PATH ?? "/",
  trailingSlash: "always",
  // The CSS (about 10 KB gzipped) inside each page instead of a file that
  // blocks the first paint until it has arrived.
  build: { inlineStylesheets: "always" },
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundled up front: JSZip is imported lazily (on the first ZIP), and
    // a dependency the dev server discovers that late makes it re-optimise and
    // fail that import ("Outdated Optimize Dep"). Production is unaffected.
    optimizeDeps: { include: ["jszip", "exifr", "@tailwindplus/elements"] },
  },
  integrations: [
    sitemap({
      // hreflang alternates for every page, matched by the /<locale>/ prefix.
      i18n: { defaultLocale, locales: Object.fromEntries(locales.map((locale) => [locale, locale])) },
    }),
    // dist/sw.js: the editor works offline (PWA).
    serviceWorker({ locales, defaultLocale }),
  ],
})
