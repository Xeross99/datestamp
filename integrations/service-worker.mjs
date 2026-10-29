// Writes dist/sw.js after the build (integrations/sw.js with its
// placeholders filled in): the list of files to keep offline comes from
// what the build produced, and the version from their contents, so every
// deploy that changes a file installs a new worker.
import { createHash } from "node:crypto"
import { readFile, readdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

/** @param {{ locales: readonly string[], defaultLocale: string }} options */
export default function serviceWorker({ locales, defaultLocale }) {
  let base = "/"
  return {
    name: "datestamp-service-worker",
    hooks: {
      "astro:config:done": ({ config }) => {
        base = config.base.endsWith("/") ? config.base : `${config.base}/`
      },
      "astro:build:done": async ({ dir, logger }) => {
        const out = fileURLToPath(dir)
        const files = async (folder) => (await readdir(path.join(out, folder))).map((name) => `${folder}/${name}`)
        const icons = ["favicon.svg", "favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "manifest.webmanifest"]
        // Every language's home page holds the editor: "" is the default one.
        const homes = locales.map((locale) => (locale === defaultLocale ? "" : `${locale}/`))
        const precache = [...homes, ...(await files("_astro")), ...(await files("samples")), ...icons]

        const hash = createHash("sha256")
        for (const file of precache) hash.update(await readFile(path.join(out, file.endsWith("/") || file === "" ? `${file}index.html` : file)))
        const version = hash.digest("hex").slice(0, 12)

        const template = await readFile(new URL("./sw.js", import.meta.url), "utf8")
        const source = template
          .replace('"__VERSION__"', JSON.stringify(version))
          .replace('"__BASE__"', JSON.stringify(base))
          .replace("__LOCALES__", JSON.stringify(locales.filter((locale) => locale !== defaultLocale)))
          .replace("__PRECACHE__", JSON.stringify(precache))
        await writeFile(path.join(out, "sw.js"), source)
        logger.info(`sw.js ${version}: ${precache.length} files kept offline`)
      },
    },
  }
}
