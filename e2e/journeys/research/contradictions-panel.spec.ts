/**
 * E2E: Research workspace — Contradictions panel (P7-05).
 *
 * Acceptance: A-1.6-19 (Research panels — contradictions).
 *
 * All API calls are stubbed via page.route() — no live backend required.
 * Backend handler: meatywiki/portal/api/research.py
 *   GET /api/artifacts/research/contradictions?cursor=...
 *
 * Scenarios:
 *   1 (happy) Panel renders paginated contradiction pairs.
 *   2 (happy) Clicking a pair row opens the detail modal with both artifacts side-by-side.
 *   3 (happy) Pressing Escape closes the open modal.
 *   4 (error)  API 500 → error message shown; no pair rows rendered.
 */

import { test, expect } from "../../support/fixtures";
import { installResearchMocks } from "../../support/research-mocks";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const PAIR_1_ID = "01HXYZ170000000000000PR01";
const PAIR_2_ID = "01HXYZ170000000000000PR02";
const PAIR_NEXT_CURSOR = "cursor_contradictions_p2";
const PAIR_PAGE2_ID = "01HXYZ170000000000000PR03";

function makeContradictionPair(
  id: string,
  titleA: string,
  titleB: string,
  topic: string,
  flaggedAt = "2026-03-10T14:00:00Z",
) {
  return {
    id,
    artifact_a: {
      id: `${id}_A`,
      title: titleA,
      excerpt: `Excerpt from ${titleA}: this claim argues that X is always true.`,
    },
    artifact_b: {
      id: `${id}_B`,
      title: titleB,
      excerpt: `Excerpt from ${titleB}: this claim argues that X is never true.`,
    },
    shared_topic: topic,
    flagged_at: flaggedAt,
  };
}

const PAGE1_BODY = {
  data: [
    makeContradictionPair(PAIR_1_ID, "Claim: X is Always True", "Claim: X is Never True", "x-truth"),
    makeContradictionPair(PAIR_2_ID, "Model Biases Evidence", "Bias-Free Model Study", "model-bias"),
  ],
  cursor: PAIR_NEXT_CURSOR,
};

const PAGE2_BODY = {
  data: [
    makeContradictionPair(PAIR_PAGE2_ID, "Alpha Claim", "Beta Counterclaim", "alpha-beta"),
  ],
  cursor: null,
};

// ---------------------------------------------------------------------------
// Route installer
// ---------------------------------------------------------------------------

async function installContradictionsMocks(
  page: import("@playwright/test").Page,
  options: { errorOnAll?: boolean } = {},
) {
  // Shared auth + artifacts stubs
  await installResearchMocks(page, {
    artifactsList: [{ body: { data: [], cursor: null } }],
  });

  // Stub the freshness panel so it doesn't interfere
  await page.route("**/api/artifacts/research/freshness-status**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], cursor: null }),
    });
  });

  // GET /api/artifacts/research/contradictions
  // Backend handler: src/meatywiki/portal/api/research.py — fetchContradictions()
  await page.route("**/api/artifacts/research/contradictions**", async (route) => {
    if (options.errorOnAll) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "internal_server_error" }),
      });
      return;
    }

    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("cursor");

    if (cursor === PAIR_NEXT_CURSOR) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PAGE2_BODY),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PAGE1_BODY),
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Research: Contradictions panel (P7-05 / A-1.6-19)", () => {
  test("panel renders paginated contradiction pairs", async ({
    authenticatedPage: page,
  }) => {
    await installContradictionsMocks(page);
    await page.goto("/research");

    // Panel heading
    await expect(page.getByRole("heading", { name: /Contradictions/i })).toBeVisible({
      timeout: 12_000,
    });

    // Both pairs are visible as button rows
    const pair1Btn = page.getByRole("button", {
      name: /Claim: X is Always True vs Claim: X is Never True/i,
    });
    const pair2Btn = page.getByRole("button", {
      name: /Model Biases Evidence vs Bias-Free Model Study/i,
    });
    await expect(pair1Btn).toBeVisible({ timeout: 10_000 });
    await expect(pair2Btn).toBeVisible();

    // Count badge reflects pair count
    await expect(page.getByLabel(/2 contradiction pairs/i)).toBeVisible();
  });

  test("clicking a pair row opens the detail modal with both artifacts side-by-side", async ({
    authenticatedPage: page,
  }) => {
    await installContradictionsMocks(page);
    await page.goto("/research");

    await expect(
      page.getByRole("button", {
        name: /Claim: X is Always True vs Claim: X is Never True/i,
      }),
    ).toBeVisible({ timeout: 12_000 });

    // Click the first contradiction row
    await page.getByRole("button", {
      name: /Claim: X is Always True vs Claim: X is Never True/i,
    }).click();

    // Modal dialog opens
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // Both artifact panes are present side-by-side
    await expect(
      dialog.getByRole("article", { name: /First artifact: Claim: X is Always True/i }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("article", { name: /Second artifact: Claim: X is Never True/i }),
    ).toBeVisible();

    // Shared topic tag is visible in the modal header area
    await expect(dialog.getByText("x-truth")).toBeVisible();
  });

  test("pressing Escape closes the contradiction detail modal", async ({
    authenticatedPage: page,
  }) => {
    await installContradictionsMocks(page);
    await page.goto("/research");

    await expect(
      page.getByRole("button", {
        name: /Claim: X is Always True vs Claim: X is Never True/i,
      }),
    ).toBeVisible({ timeout: 12_000 });

    await page.getByRole("button", {
      name: /Claim: X is Always True vs Claim: X is Never True/i,
    }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });

  test("API 500 renders error message and no pair rows", async ({
    authenticatedPage: page,
  }) => {
    await installContradictionsMocks(page, { errorOnAll: true });
    await page.goto("/research");

    // Panel heading still renders
    await expect(page.getByRole("heading", { name: /Contradictions/i })).toBeVisible({
      timeout: 12_000,
    });

    // Error text appears
    await expect(page.getByText(/Failed to load contradictions/i)).toBeVisible({
      timeout: 8_000,
    });

    // No pair rows (buttons) rendered
    await expect(
      page.getByRole("button", {
        name: /Claim: X is Always True/i,
      }),
    ).toHaveCount(0);
  });
});
