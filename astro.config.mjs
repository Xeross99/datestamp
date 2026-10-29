// @ts-check
import { defineConfig } from "astro/config"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"
import { defaultLocale, locales } from "./src/i18n/locales.ts"

// GitHub Pages serves a project site at https://<owner>.github.io/<repo>/,
// so the deploy workflow passes SITE and BASE_PATH. Locally both default
// to the dev server's root. A custom domain later: SITE=https://domain, BASE_PATH=/.
export default defineConfig({
  site: process.env.SITE ?? "http://localhost:4321",
  base: process.env.BASE_PATH ?? "/",
  trailingSlash: "always",
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
  ],
})
