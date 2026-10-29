// Google AdSense in the two side rails. The publisher id and the ad unit
// ids come from the environment (GitHub repository variables in the deploy
// workflow), so the code carries no account data and a build without them
// simply has no ads.

const env = import.meta.env

export const adsense = {
  /** ca-pub-XXXXXXXXXXXXXXXX, or "" when ads are off. */
  client: env.PUBLIC_ADSENSE_CLIENT ?? "",
  slots: {
    left: env.PUBLIC_ADSENSE_SLOT_LEFT ?? "",
    right: env.PUBLIC_ADSENSE_SLOT_RIGHT ?? "",
    /** In the content, for screens without rails (phones, tablets). */
    inline: env.PUBLIC_ADSENSE_SLOT_INLINE ?? "",
  },
}

export type AdSlot = keyof typeof adsense.slots
export type AdRail = Exclude<AdSlot, "inline">

/** The screen width from which the rails show; the same value as in global.css. */
export const RAILS_MIN_WIDTH = 1392

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

/**
 * Asks AdSense to fill every ad unit that is on screen and not filled yet.
 * A unit hidden by CSS (the rails on a narrow screen, the inline unit on
 * a wide one) has no width, and an ad unit without a width must not be
 * requested, so those wait until the screen width changes.
 *
 * Each push({}) fills the first `ins.adsbygoogle` AdSense has not seen, in
 * page order, whatever we meant. So a unit is an `ins.ad-unit` until it is
 * requested, and only then gets the adsbygoogle class: otherwise the hidden
 * inline unit (between the rails in the page) took the right rail's turn.
 */
export function fillAds() {
  document.querySelectorAll<HTMLElement>("ins.ad-unit:not(.adsbygoogle)").forEach((unit) => {
    if (unit.offsetWidth === 0) return
    unit.classList.add("adsbygoogle")
    ;(window.adsbygoogle = window.adsbygoogle ?? []).push({})
  })
}
