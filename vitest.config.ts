import { defineConfig } from "vitest/config"

// Unit tests: the pure logic in src/lib and src/i18n (no browser). The
// editor in a real browser is covered by the Playwright tests in tests/e2e.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
  },
})
