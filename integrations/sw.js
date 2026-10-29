// @ts-nocheck: a template, its __PLACEHOLDERS__ are filled in by the build.
// DateStamp's service worker, so the editor works offline (PWA). The build
// (integrations/service-worker.mjs) fills in the placeholders and writes it
// to dist/sw.js. It keeps only the site's own files on the device; Google's
// ads and statistics always go to the network.
const VERSION = "__VERSION__"
const BASE = "__BASE__"
const LOCALES = __LOCALES__
// The editor's scripts, the icons and every
// language's home page: enough to open and use the editor offline.
const PRECACHE = __PRECACHE__
const CACHE = `datestamp-${VERSION}`

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => BASE + path)))
      .then(() => self.skipWaiting()),
  )
})

// A new version replaces the old one at once and drops its files.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("datestamp-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== "GET" || url.origin !== location.origin) return

  // Pages: the network first, so an update shows at once; offline, the copy
  // from the last visit, else that language's home page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => (await caches.match(request, { ignoreVary: true })) ?? (await caches.match(homeOf(url), { ignoreVary: true })) ?? (await caches.match(BASE, { ignoreVary: true })) ?? Response.error()),
    )
    return
  }

  // Files: hashed or versioned, so a cached copy is always right. The icon
  // links carry ?v=, hence ignoreSearch; ignoreVary, as a module script's
  // request (with Origin) must find the copy kept at install (without).
  event.respondWith(
    caches.match(request, { ignoreSearch: true, ignoreVary: true }).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})

/** The home page of the language a path is in (/pl/… → /pl/). */
function homeOf(url) {
  const first = url.pathname.slice(BASE.length).split("/")[0]
  return LOCALES.includes(first) ? `${BASE}${first}/` : BASE
}
