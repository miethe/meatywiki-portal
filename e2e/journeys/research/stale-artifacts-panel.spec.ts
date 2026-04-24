/**
 * E2E: Research workspace — Stale Artifacts panel (P7-05).
 *
 * Acceptance: A-1.6-19 (Research panels — freshness/stale artifacts).
 *
 * All API calls are stubbed via page.route() — no live backend required.
 * Backend handler: meatywiki/portal/api/research.py
 *   GET /api/artifacts/research/freshness-status?threshold_days=N&cursor=...
 *
 * Scenarios:
 *   1 (happy) Panel renders with stale artifact rows on page load.
 *   2 (happy) Threshold input change triggers a new fetch with updated param.
 *   3 (happy) Cursor "Next page" navigation fetches page 2 and updates rows.
 *   4 (happy) Click on an artifact row link navigates to the detail page.
 *   5 (error)  API 500 → error alert is shown; no artifact rows rendered.
 */

import { test, expect } from "../../support/fixtures";
import { installResearchMocks } from "../../support/research-mocks";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const ARTIFACT_STALE_1 = "01HXYZ160000000000000SA01";
const ARTIFACT_STALE_2 = "01HXYZ160000000000000SA02";
const ARTIFACT_PAGE2_1 = "01HXYZ160000000000000PG21";
const NEXT_CURSOR = "cursor_abc_page2";

function makeFreshnessItem(
  id: string,
  title: string,
  score: number,
  lastSynthDate: string | null = null,
) {
  return {
    id,
    title,
    subtype: "concept",
    freshness_score: score,
    last_synthesis_date: lastSynthDate,
    source_artifact_count: 3,
  };
}

// Page 1 response (threshold_days=30)
const PAGE1_BODY = {
  data: [
    makeFreshnessItem(ARTIFACT_STALE_1, "Stale Concept Alpha", 18, "2026-01-01T00:00:00Z"),
    makeFreshnessItem(ARTIFACT_STALE_2, "Stale Concept Beta", 45, "2026-02-15T00:00:00Z"),
  ],
  cursor: NEXT_CURSOR,
};

// Page 1 response for threshold_days=7 (new threshold)
const THRESHOLD7_BODY = {
  data: [
    makeFreshnessItem("01HXYZ160000000000000TH71", "Very Stale Concept", 5, "2025-12-01T00:00:00Z"),
  ],
  cursor: null,
};

// Page 2 response
const PAGE2_BODY = {
  data: [
    makeFreshnessItem(ARTIFACT_PAGE2_1, "Page Two Concept", 22, "2026-03-01T00:00:00Z"),
  ],
  cursor: null,
};

// ---------------------------------------------------------------------------
// Route installer specific to this spec
// (supplements installResearchMocks with freshness-status endpoint)
// ---------------------------------------------------------------------------

async function installFreshnessMocks(
  page: import("@playwright/test").Page,
  options: { errorOnAll?: boolean } = {},
) {
  // Auth + artifact endpoints via shared helper (empty artifact list is fine)
  await installResearchMocks(page, {
    artifactsList: [{ body: { data: [], cursor: null } }],
  });

  // GET /api/artifacts/research/freshness-status
  // Backend handler: src/meatywiki/portal/api/research.py — fetchFreshnessStatus()
  await page.route("**/api/artifacts/research/freshness-status**", async (route) => {
    if (options.errorOnAll) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "internal_server_error", detail: "DB unavailable" }),
      });
      return;
    }

    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("cursor");
    const threshold = url.searchParams.get("threshold_days");

    if (cursor === NEXT_CURSOR) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PAGE2_BODY),
      });
      return;
    }

    if (threshold === "7") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(THRESHOLD7_BODY),
      });
      return;
    }

    // Default: page 1 / threshold 30
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PAGE1_BODY),
    });
  });

  // Stub contradictions so the parallel panel doesn't cause noise
  await page.route("**/api/artifacts/research/contradictions**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], cursor: null }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Research: Stale Artifacts panel (P7-05 / A-1.6-19)", () => {
  test("panel renders stale artifact rows on page load", async ({
    authenticatedPage: page,
  }) => {
    await installFreshnessMocks(page);
    await page.goto("/research");

    // Section heading must be visible
    await expect(page.getByRole("heading", { name: /Stale Artifacts/i })).toBeVisible({
      timeout: 12_000,
    });

    // Both fixture artifacts must appear as links
    await expect(page.getByRole("link", { name: "Stale Concept Alpha" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("link", { name: "Stale Concept Beta" })).toBeVisible();

    // Freshness score meters are present (at least one per artifact)
    const meters = page.locator('[role="meter"]');
    await expect(meters.first()).toBeVisible();
  });

  test("threshold input change re-fetches with updated threshold_days param", async ({
    authenticatedPage: page,
  }) => {
    await installFreshnessMocks(page);

    // Collect freshness-status requests to verify the threshold param
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("freshness-status")) requests.push(req.url());
    });

    await page.goto("/research");
    await expect(page.getByRole("heading", { name: /Stale Artifacts/i })).toBeVisible({
      timeout: 12_000,
    });

    // Clear the threshold input and type a new value
    const thresholdInput = page.getByLabel(/Staleness threshold in days/i);
    await expect(thresholdInput).toBeVisible({ timeout: 8_000 });
    await thresholdInput.fill("7");

    // Wait for the debounce (400ms) + request to fire and new data to render
    await expect(page.getByRole("link", { name: "Very Stale Concept" })).toBeVisible({
      timeout: 5_000,
    });

    // Verify at least one request carried threshold_days=7
    const hadThreshold7 = requests.some((u) => u.includes("threshold_days=7"));
    expect(hadThreshold7).toBe(true);

    // Page-1 items should no longer be visible
    await expect(page.getByRole("link", { name: "Stale Concept Alpha" })).toHaveCount(0);
  });

  test("Next page pagination fetches page 2 and updates rows", async ({
    authenticatedPage: page,
  }) => {
    await installFreshnessMocks(page);
    await page.goto("/research");

    await expect(page.getByRole("link", { name: "Stale Concept Alpha" })).toBeVisible({
      timeout: 12_000,
    });

    // Pagination nav should be present (page 1 has a next cursor)
    const paginationNav = page.getByRole("navigation", {
      name: /Stale artifacts pagination/i,
    });
    await expect(paginationNav).toBeVisible({ timeout: 8_000 });

    const nextBtn = paginationNav.getByRole("button", { name: /Next page/i });
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Page 2 artifact appears
    await expect(page.getByRole("link", { name: "Page Two Concept" })).toBeVisible({
      timeout: 8_000,
    });

    // Page 1 artifacts are gone
    await expect(page.getByRole("link", { name: "Stale Concept Alpha" })).toHaveCount(0);

    // Next button is now disabled (no further cursor)
    await expect(nextBtn).toBeDisabled();
  });

  test("clicking an artifact link navigates to the detail page", async ({
    authenticatedPage: page,
  }) => {
    await installFreshnessMocks(page);

    // Stub the artifact detail page so navigation succeeds without a 404
    await page.route(`**/api/artifacts/${ARTIFACT_STALE_1}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: ARTIFACT_STALE_1,
            title: "Stale Concept Alpha",
            workspace: "research",
            type: "concept",
            status: "active",
            schema_version: "1.0",
            created: "2026-01-01T10:00:00Z",
            updated: "2026-04-01T12:00:00Z",
            file_path: "wiki/concepts/stale-alpha.md",
            frontmatter_jsonb: {},
            metadata: {},
          },
        }),
      });
    });
    await page.route(`**/api/artifacts/${ARTIFACT_STALE_1}/edges**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ artifact_id: ARTIFACT_STALE_1, incoming: [], outgoing: [] }),
      });
    });

    await page.goto("/research");
    await expect(page.getByRole("link", { name: "Stale Concept Alpha" })).toBeVisible({
      timeout: 12_000,
    });

    await page.getByRole("link", { name: "Stale Concept Alpha" }).click();
    await expect(page).toHaveURL(new RegExp(`/artifact/${ARTIFACT_STALE_1}`), {
      timeout: 8_000,
    });
  });

  test("API 500 renders error alert and no artifact rows", async ({
    authenticatedPage: page,
  }) => {
    await installFreshnessMocks(page, { errorOnAll: true });
    await page.goto("/research");

    // Section heading is still visible (panel shell renders)
    await expect(page.getByRole("heading", { name: /Stale Artifacts/i })).toBeVisible({
      timeout: 12_000,
    });

    // Error alert is shown
    const errorAlert = page.getByRole("alert");
    await expect(errorAlert.first()).toBeVisible({ timeout: 8_000 });

    // No artifact links rendered
    await expect(page.getByRole("link", { name: "Stale Concept Alpha" })).toHaveCount(0);
  });
});
