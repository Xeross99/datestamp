// The cookie consent, per purpose: statistics (Google Analytics 4) and
// advertising (Google AdSense). Necessary storage (settings, this choice)
// needs none.
//
// - Until the visitor chooses, AdSense sends no ad requests
//   (pauseAdRequests) and Google Analytics is not loaded at all.
// - Statistics allowed: GA4 loads (Consent Mode v2, analytics_storage granted).
// - Advertising allowed: personalised ads; refused: non-personalised ones
//   (requestNonPersonalizedAds).
//
// The choice lives in localStorage; Base.astro's <head> script applies a
// stored one before anything loads (same key, same rules). Not a
// Google-certified CMP: in the EEA, the UK and Switzerland AdSense then
// serves only limited ads (CLAUDE.md, Ads).

import { loadAnalytics, revokeAnalytics } from "./analytics"

export const CONSENT_KEY = "datestamp:consent"

export interface Consent {
  analytics: boolean
  ads: boolean
  /** When the choice was made (ISO date). */
  at: string
}

type AdsQueue = unknown[] & { pauseAdRequests?: 0 | 1; requestNonPersonalizedAds?: 0 | 1 }

/** The stored choice, or null when there is none (or one from before statistics were asked). */
export function storedConsent(): Consent | null {
  try {
    const value = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null")
    return value && typeof value.ads === "boolean" && typeof value.analytics === "boolean" ? value : null
  } catch {
    return null
  }
}

function applyConsent(consent: Consent) {
  const ads = ((window as { adsbygoogle?: AdsQueue }).adsbygoogle ??= [] as AdsQueue)
  ads.requestNonPersonalizedAds = consent.ads ? 0 : 1
  ads.pauseAdRequests = 0
  if (consent.analytics) loadAnalytics(consent)
  else revokeAnalytics()
}

export function mountConsent(banner: HTMLElement) {
  const details = banner.querySelector<HTMLElement>("[data-consent-details]")!
  const customizeButton = banner.querySelector<HTMLButtonElement>("[data-consent-customize]")!
  const saveButton = banner.querySelector<HTMLButtonElement>("[data-consent-save]")!
  const toggle = (name: "analytics" | "ads") => banner.querySelector<HTMLInputElement>(`input[name="${name}"]`)!

  const showDetails = (show: boolean) => {
    if (show) details.dataset.open = ""
    else delete details.dataset.open
    details.inert = !show
    customizeButton.hidden = show
    saveButton.hidden = !show
    customizeButton.setAttribute("aria-expanded", String(show))
  }
  const open = () => {
    const current = storedConsent()
    toggle("analytics").checked = current?.analytics ?? false
    toggle("ads").checked = current?.ads ?? false
    showDetails(Boolean(current)) // coming back from "Cookie settings": show what was chosen
    banner.inert = false
    banner.dataset.open = ""
  }
  const close = () => {
    delete banner.dataset.open
    banner.inert = true
  }
  const choose = (analytics: boolean, ads: boolean) => {
    const consent: Consent = { analytics, ads, at: new Date().toISOString() }
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    } catch {
      // Not remembered: the banner comes back on the next page.
    }
    applyConsent(consent)
    close()
    // The ad units wait for a choice; fill the ones on screen now.
    window.dispatchEvent(new CustomEvent("datestamp:consent", { detail: consent }))
  }

  banner.querySelector("[data-consent-accept]")!.addEventListener("click", () => choose(true, true))
  banner.querySelector("[data-consent-reject]")!.addEventListener("click", () => choose(false, false))
  customizeButton.addEventListener("click", () => showDetails(true))
  saveButton.addEventListener("click", () => choose(toggle("analytics").checked, toggle("ads").checked))
  // "Cookie settings" in the footer brings the banner back.
  document.querySelectorAll("[data-consent-open]").forEach((button) => button.addEventListener("click", open))

  if (!storedConsent()) open()
}
