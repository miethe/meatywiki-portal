/**
 * Shared Playwright fixtures and helpers for P3-12 E2E tests.
 *
 * Backend dependency strategy:
 *   Tests check reachability of PORTAL_API_URL (default: http://127.0.0.1:8787)
 *   before each journey. If the backend is unreachable they skip gracefully
 *   with `test.skip()` rather than failing, so CI pipelines that do not
 *   include the backend orchestration still go green.
 *
 *   Set MEATYWIKI_PORTAL_TOKEN in the environment (or .env.local) to supply
 *   the bearer token used for all journeys that require authentication.
 *
 * Usage:
 *   import { test, expect, checkBackend, loginAs } from "./fixtures";
 */

import { test as base, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const API_URL =
  process.env.MEATYWIKI_PORTAL_API_URL ?? "http://127.0.0.1:8787";

export const TEST_TOKEN =
  process.env.MEATYWIKI_PORTAL_TOKEN ?? "test-token-e2e";

// ---------------------------------------------------------------------------
// Backend reachability check
// ---------------------------------------------------------------------------

/**
 * Returns true when the backend health endpoint responds 200.
 * Used to conditionally skip tests that require a live backend.
 */
export async function isBackendReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${API_URL}/health`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    return resp.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Authenticated page fixture
// ---------------------------------------------------------------------------

/**
 * Extended test fixture that provides an `authenticatedPage` with the
 * portal_session cookie pre-set so tests start already logged in.
 *
 * Token is sourced from MEATYWIKI_PORTAL_TOKEN env var (falls back to
 * "test-token-e2e" for local dev convenience — replace with real token
 * or set the env var to authenticate against a live backend).
 */
export const test = base.extend<{
  authenticatedPage: Page;
  skipIfBackendDown: void;
}>({
  // Fixture: skip the whole test if backend is unreachable
  skipIfBackendDown: [
    async ({}, use, testInfo) => {
      const reachable = await isBackendReachable();
      if (!reachable) {
        testInfo.skip(
          true,
          `Backend unreachable at ${API_URL} — skipping E2E journey (set MEATYWIKI_PORTAL_API_URL + start backend to run).`,
        );
      }
      await use();
    },
    { auto: false },
  ],

  // Fixture: a Page with the session cookie already set
  authenticatedPage: async ({ page, context }, use) => {
    // Set the HttpOnly session cookie directly in the browser context
    await context.addCookies([
      {
        name: "portal_session",
        value: TEST_TOKEN,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    await use(page);
  },
});

export { expect };

// ---------------------------------------------------------------------------
// Login helper (UI-based — used in the Login journey test only)
// ---------------------------------------------------------------------------

/**
 * Fills and submits the login form with the given token, then waits for the
 * redirect away from /login.
 */
export async function loginViaUI(
  page: Page,
  token: string = TEST_TOKEN,
): Promise<void> {
  await page.goto("/login");
  await page.waitForSelector('[id="token"]', { state: "visible" });
  await page.fill('[id="token"]', token);
  await page.click('button[type="submit"]');
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

export async function navigateToInbox(page: Page): Promise<void> {
  await page.goto("/inbox");
  // Wait for the page heading to be present
  await page.waitForSelector('h1:has-text("Inbox"), [role="heading"]:has-text("Inbox")', {
    timeout: 10_000,
  });
}

export async function navigateToLibrary(page: Page): Promise<void> {
  await page.goto("/library");
  await page.waitForSelector('h1:has-text("Library"), [role="heading"]:has-text("Library")', {
    timeout: 10_000,
  });
}

export async function navigateToWorkflows(page: Page): Promise<void> {
  await page.goto("/workflows");
  await page.waitForSelector('h1:has-text("Workflows"), [role="heading"]:has-text("Workflows")', {
    timeout: 10_000,
  });
}
