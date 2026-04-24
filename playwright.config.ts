import { defineConfig, devices } from "@playwright/test";

const PLAYWRIGHT_HOST = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const PLAYWRIGHT_PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const PLAYWRIGHT_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  `http://${PLAYWRIGHT_HOST}:${PLAYWRIGHT_PORT}`;

/**
 * Playwright E2E test configuration.
 *
 * P3-12 adds:
 * - Critical user journey tests (login, inbox, quick add, artifact detail)
 * - Accessibility checks via @axe-core/playwright
 * - Mobile viewport tests (responsive design)
 *
 * PU7-04 adds:
 * - Visual regression snapshot configuration (snapshotDir, snapshotPathTemplate)
 * - Snapshots stored under e2e/content-viewer/__snapshots__/ per project
 *
 * Backend dependency:
 *   Tests require the backend API at MEATYWIKI_PORTAL_API_URL (default:
 *   http://127.0.0.1:8787) and a valid MEATYWIKI_PORTAL_TOKEN. Tests use
 *   the skipIfBackendDown fixture to skip gracefully when the backend is
 *   unreachable, so the suite can run in frontend-only CI environments
 *   without false failures.
 *
 *   Content-viewer E2E tests (e2e/content-viewer/) use route interception
 *   and do NOT require the backend — they run fully offline.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: PLAYWRIGHT_BASE_URL,
    trace: "on-first-retry",
    // Capture screenshot on failure for debugging
    screenshot: "only-on-failure",
    // Record video on first retry so failures can be replayed
    video: "on-first-retry",
  },

  // Visual regression snapshot configuration (PU7-04)
  // Snapshots are stored alongside the spec file in a __snapshots__ directory.
  // Template: e2e/content-viewer/__snapshots__/{testFileName}/{snapshotName}-{projectName}.png
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/__snapshots__/{testFileName}/{arg}-{projectName}{ext}",

  // Snapshot comparison options — global defaults (per-test can override)
  expect: {
    toHaveScreenshot: {
      // 2% pixel tolerance for font rendering / anti-aliasing differences
      maxDiffPixelRatio: 0.02,
      // Threshold for individual pixel colour distance (0-1, default 0.2)
      threshold: 0.2,
      // Animate CSS transitions to stable state before snapshot
      animations: "disabled",
    },
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
    command: `pnpm exec next dev --hostname ${PLAYWRIGHT_HOST} --port ${PLAYWRIGHT_PORT}`,
    url: PLAYWRIGHT_BASE_URL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
