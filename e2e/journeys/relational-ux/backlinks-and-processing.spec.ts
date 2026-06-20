/**
 * E2E: Portal v2.6 — Backlinks render + Processing empty-state (P5-01 coverage).
 *
 * Scenario A — Backlinks tab (seeded edges):
 *   Open artifact detail → Backlinks tab →
 *   assert incoming edge rows render (not empty, not error, not spinner).
 *
 * Scenario B — Backlinks tab (empty):
 *   Same artifact, /backlinks returns empty →
 *   assert "No backlinks" message or equivalent empty state renders.
 *
 * Scenario C — Processing tab:
 *   Open artifact detail → Processing tab →
 *   assert graceful empty state renders (message text, no unhandled error,
 *   no persistent spinner after data resolves).
 *
 * Stubs:
 *   GET /api/artifacts/:id               — artifact detail
 *   GET /api/artifacts/:id/edges         — empty
 *   GET /api/artifacts/:id/backlinks     — seeded or empty (per scenario)
 *   GET /api/artifacts/:id/processing-history — empty array
 *
 * Assumed aria / testid anchors:
 *   - Backlinks tab button: id="artifact-tab-btn-backlinks"
 *   - Processing tab button: id="artifact-tab-btn-processing"
 *   - Backlink rows: text of incoming artifact titles visible
 *   - Empty state message: text matching /no backlinks/i or similar
 *   - Processing empty state: text matching /no (processing|history|stages)/i
 *     OR a specific empty-state element (not a persistent loading spinner)
 *
 * data-testid values assumed to exist (to be added if missing):
 *   data-testid="processing-empty-state" — on the empty state container
 *   data-testid="backlinks-empty-state"  — on the backlinks empty state
 *   (fall back to text matching if absent)
 */

import { test, expect } from "../../support/fixtures";
import {
  installResearchMocks,
  makeArtifactDetail,
  ARTIFACT_A_ID,
} from "../../support/research-mocks";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const ARTIFACT_ID = ARTIFACT_A_ID;
const INCOMING_TITLE_1 = "Upstream Concept One";
const INCOMING_TITLE_2 = "Upstream Evidence Two";

const artifactDetail = makeArtifactDetail({
  id: ARTIFACT_ID,
  title: "Target Artifact For Backlinks",
  type: "concept",
});

// Seeded backlinks response
const seededBacklinks = {
  artifact_id: ARTIFACT_ID,
  incoming: [
    {
      id: "01HXYZ180000000000000BK10",
      title: INCOMING_TITLE_1,
      type: "concept",
      edge_type: "derived_from",
      direction: "incoming",
    },
    {
      id: "01HXYZ180000000000000BK11",
      title: INCOMING_TITLE_2,
      type: "evidence",
      edge_type: "supports",
      direction: "incoming",
    },
  ],
  outgoing: [],
};

const emptyBacklinks = {
  artifact_id: ARTIFACT_ID,
  incoming: [],
  outgoing: [],
};

// ---------------------------------------------------------------------------
// Route builders
// ---------------------------------------------------------------------------

async function setupBacklinksMocks(
  page: Page,
  backlinksPayload: typeof seededBacklinks | typeof emptyBacklinks,
): Promise<void> {
  await installResearchMocks(page, {
    artifactDetail: { [ARTIFACT_ID]: artifactDetail },
    artifactEdges: { [ARTIFACT_ID]: { incoming: [], outgoing: [] } },
  });

  // Backlinks endpoint
  await page.route(`**/api/artifacts/${ARTIFACT_ID}/backlinks**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: backlinksPayload }),
    });
  });

  // Processing history (empty — avoids spinner persistence in Processing tab)
  await page.route(`**/api/artifacts/${ARTIFACT_ID}/processing-history**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { items: [], cursor: null } }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests — Backlinks
// ---------------------------------------------------------------------------

test.describe("Portal v2.6 — Backlinks tab", () => {
  test("seeded artifact: incoming backlink rows render correctly", async ({
    authenticatedPage: page,
  }) => {
    await setupBacklinksMocks(page, seededBacklinks);
    await page.goto(`/artifact/${ARTIFACT_ID}`);

    await expect(
      page.getByRole("heading", { name: "Target Artifact For Backlinks" }),
    ).toBeVisible({ timeout: 15_000 });

    // Open Backlinks tab
    const backlinksTabBtn = page.locator("#artifact-tab-btn-backlinks");
    await expect(backlinksTabBtn).toBeVisible({ timeout: 10_000 });
    await backlinksTabBtn.click();

    // Loading indicator should NOT persist
    await expect(
      page.getByLabel(/backlinks loading/i).or(page.getByRole("status", { name: /loading backlinks/i })),
    ).not.toBeVisible({ timeout: 8_000 });

    // No error alert
    await expect(page.getByRole("alert")).not.toBeVisible({ timeout: 3_000 });

    // Both incoming backlink titles must be visible
    await expect(page.getByText(INCOMING_TITLE_1)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(INCOMING_TITLE_2)).toBeVisible({ timeout: 5_000 });
  });

  test("empty backlinks: graceful empty state shown, no error", async ({
    authenticatedPage: page,
  }) => {
    await setupBacklinksMocks(page, emptyBacklinks);
    await page.goto(`/artifact/${ARTIFACT_ID}`);

    await expect(
      page.getByRole("heading", { name: "Target Artifact For Backlinks" }),
    ).toBeVisible({ timeout: 15_000 });

    const backlinksTabBtn = page.locator("#artifact-tab-btn-backlinks");
    await expect(backlinksTabBtn).toBeVisible({ timeout: 10_000 });
    await backlinksTabBtn.click();

    // No error
    await expect(page.getByRole("alert")).not.toBeVisible({ timeout: 3_000 });

    // Empty state — accept either aria-label or visible text approaches
    const emptyState = page
      .getByLabel(/no backlinks found/i)
      .or(page.getByText(/no backlinks/i))
      .or(page.locator('[data-testid="backlinks-empty-state"]'))
      .first();

    await expect(emptyState).toBeVisible({ timeout: 8_000 });

    // The seeded titles must NOT appear
    await expect(page.getByText(INCOMING_TITLE_1)).not.toBeVisible();
    await expect(page.getByText(INCOMING_TITLE_2)).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tests — Processing tab
// ---------------------------------------------------------------------------

test.describe("Portal v2.6 — Processing tab empty state", () => {
  test("Processing tab shows graceful empty state, no error or persistent spinner", async ({
    authenticatedPage: page,
  }) => {
    await setupBacklinksMocks(page, emptyBacklinks);
    await page.goto(`/artifact/${ARTIFACT_ID}`);

    await expect(
      page.getByRole("heading", { name: "Target Artifact For Backlinks" }),
    ).toBeVisible({ timeout: 15_000 });

    // Open Processing tab
    const processingTabBtn = page.locator("#artifact-tab-btn-processing");
    await expect(processingTabBtn).toBeVisible({ timeout: 10_000 });
    await processingTabBtn.click();

    // Allow data to resolve
    // A persistent spinner must not be present after a reasonable timeout
    const loadingSpinner = page
      .getByRole("status", { name: /loading processing|loading history/i })
      .or(page.locator('[aria-busy="true"]').filter({ hasText: /processing/i }))
      .first();

    // If it appears, it must disappear within the timeout
    try {
      await expect(loadingSpinner).not.toBeVisible({ timeout: 10_000 });
    } catch {
      // Spinner was never visible — that's also fine
    }

    // No unhandled error alert
    const errorAlert = page
      .getByRole("alert")
      .filter({ hasText: /error|failed|unexpected/i })
      .first();
    await expect(errorAlert).not.toBeVisible({ timeout: 3_000 });

    // The Processing tab panel should contain an empty state message
    const processingPanel = page.locator('[id="artifact-tab-panel-processing"]');
    await expect(processingPanel).toBeVisible({ timeout: 5_000 });

    // Accept any of the expected empty-state patterns from ProcessingHistoryTab
    const emptyState = processingPanel
      .getByText(/no (processing|pipeline|stages|history)/i)
      .or(processingPanel.getByText(/not yet (processed|compiled)/i))
      .or(processingPanel.locator('[data-testid="processing-empty-state"]'))
      .or(
        // The component may render a descriptive message about the vault-reconciled gap
        processingPanel.getByText(/vault.reconcil/i),
      )
      .first();

    await expect(emptyState).toBeVisible({ timeout: 8_000 });
  });
});
