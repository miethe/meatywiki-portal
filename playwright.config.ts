import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * P3-12 adds:
 * - Critical user journey tests (login, inbox, quick add, artifact detail)
 * - Accessibility checks via @axe-core/playwright
 * - Mobile viewport tests (responsive design)
 *
 * Backend dependency:
 *   Tests require the backend API at MEATYWIKI_PORTAL_API_URL (default:
 *   http://127.0.0.1:8787) and a valid MEATYWIKI_PORTAL_TOKEN. Tests use
 *   the skipIfBackendDown fixture to skip gracefully when the backend is
 *   unreachable, so the suite can run in frontend-only CI environments
 *   without false failures.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Capture screenshot on failure for debugging
    screenshot: "only-on-failure",
    // Record video on first retry so failures can be replayed
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
