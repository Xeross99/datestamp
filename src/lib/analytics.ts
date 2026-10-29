// Google Analytics 4, only with consent (src/lib/consent.ts): until then the
// script is not even downloaded ("basic" Consent Mode). Base.astro's <head>
// loads it early for a visitor who already agreed; this module loads it
// right after a "yes" in the banner and sends the app's events.
//
// Events never carry a photo, a file name or a date from a photo: only
// counts and the chosen options.

const env = import.meta.env
export const GA_ID = env.PUBLIC_GA_ID ?? ""

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
  }
}

function gtag(...args: unknown[]) {
  window.dataLayer ??= []
  // gtag.js reads the arguments object, not an array.
  // eslint-disable-next-line prefer-rest-params
  window.gtag ??= function () {
    window.dataLayer!.push(arguments)
  }
  window.gtag(...args)
}

let loaded = false

/** Loads GA4 once consent for statistics is given (no-op without an id). */
export function loadAnalytics(consent: { ads: boolean }) {
  if (!GA_ID) return
  gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: consent.ads ? "granted" : "denied",
    ad_user_data: consent.ads ? "granted" : "denied",
    ad_personalization: consent.ads ? "granted" : "denied",
  })
  if (loaded || document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
    loaded = true
    return
  }
  loaded = true
  gtag("js", new Date())
  gtag("config", GA_ID)
  const script = document.createElement("script")
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.append(script)
}

/** Statistics refused after all: stop measuring and drop GA's cookies. */
export function revokeAnalytics() {
  if (!GA_ID) return
  gtag("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" })
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0].trim()
    if (!name.startsWith("_ga")) continue
    for (const domain of ["", location.hostname, `.${location.hostname.split(".").slice(-2).join(".")}`]) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`
    }
  }
}

/** An app event (e.g. photos saved), sent only when statistics are allowed and GA runs. */
export function track(name: string, params: Record<string, string | number> = {}) {
  if (!GA_ID || !window.gtag) return
  try {
    const consent = JSON.parse(localStorage.getItem("datestamp:consent") ?? "null")
    if (!consent?.analytics) return
  } catch {
    return
  }
  window.gtag("event", name, params)
}
