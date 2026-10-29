import { defineConfig, devices } from "@playwright/test"

// End-to-end tests against the built site (astro preview), so they check
// what GitHub Pages serves. Locally the web server builds first; in CI the
// workflow has built already.
const PORT = 4322

// The tests run against a build with (fake) AdSense and GA4 ids, so the ad
// slots, the paused ad requests, GA's consent gating and the cookie banner
// are there as in production.
// Requests to Google are blocked in tests/e2e/helpers.ts.
export const TEST_ADS_ENV = {
  PUBLIC_ADSENSE_CLIENT: "ca-pub-0000000000000000",
  PUBLIC_ADSENSE_SLOT_LEFT: "1111111111",
  PUBLIC_ADSENSE_SLOT_RIGHT: "2222222222",
  PUBLIC_ADSENSE_SLOT_INLINE: "3333333333",
  PUBLIC_GA_ID: "G-TEST000000",
}

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // The offline worker would answer some requests itself, out of reach of
    // page.route; only the offline test turns it on.
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: process.env.CI ? `npx astro preview --port ${PORT} --ignore-lock` : `npm run build && npx astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: TEST_ADS_ENV,
  },
})
