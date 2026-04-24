/**
 * E2E: Artifact detail — Backlinks tab (P7-05, optional coverage for P7-04).
 *
 * Covers: artifact detail page → click "Backlinks" tab → panel renders
 * server-side-fetched inbound edges.
 *
 * All API calls are stubbed via page.route() — no live backend required.
 * Backend handler: src/meatywiki/portal/api/artifacts.py
 *   GET /api/artifacts/:id/backlinks?edge_type=...
 *
 * Scenarios:
 *   1 (happy) Backlinks tab renders incoming + outgoing edge sections with backlink rows.
 *   2 (happy) Empty backlinks state renders "No backlinks found" message.
 */

import { test, expect } from "../support/fixtures";
import {
  installResearchMocks,
  makeArtifactDetail,
  ARTIFACT_A_ID,
} from "../support/research-mocks";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const BACKLINK_INCOMING_ID = "01HXYZ180000000000000BK01";
const BACKLINK_OUTGOING_ID = "01HXYZ180000000000000BK02";

// Response from GET /api/artifacts/:id/backlinks
// Backend handler: src/meatywiki/portal/api/artifacts.py → fetchBacklinks()
const BACKLINKS_WITH_EDGES = {
  artifact_id: ARTIFACT_A_ID,
  incoming: [
    {
      id: BACKLINK_INCOMING_ID,
      title: "Incoming Source Evidence",
      type: "concept",
      edge_type: "supports",
      direction: "incoming",
    },
  ],
  outgoing: [
    {
      id: BACKLINK_OUTGOING_ID,
      title: "Outgoing Derived Concept",
      type: "concept",
      edge_type: "derived_from",
      direction: "outgoing",
    },
  ],
};

const BACKLINKS_EMPTY = {
  artifact_id: ARTIFACT_A_ID,
  incoming: [],
  outgoing: [],
};

// ---------------------------------------------------------------------------
// Route installer
// ---------------------------------------------------------------------------

async function installArtifactDetailMocks(
  page: import("@playwright/test").Page,
  backlinksResponse: typeof BACKLINKS_WITH_EDGES | typeof BACKLINKS_EMPTY,
) {
  await installResearchMocks(page, {
    artifactDetail: {
      [ARTIFACT_A_ID]: makeArtifactDetail({
        id: ARTIFACT_A_ID,
        title: "Research Concept A",
        frontmatter_jsonb: { lens_freshness: "fresh" },
      }),
    },
    artifactEdges: {
      [ARTIFACT_A_ID]: { incoming: [], outgoing: [] },
    },
  });

  // GET /api/artifacts/:id/backlinks (P7-04 endpoint)
  await page.route(`**/api/artifacts/${ARTIFACT_A_ID}/backlinks**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: backlinksResponse }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Artifact detail: Backlinks tab (P7-05 / P7-04)", () => {
  test("Backlinks tab renders incoming and outgoing edge sections", async ({
    authenticatedPage: page,
  }) => {
    await installArtifactDetailMocks(page, BACKLINKS_WITH_EDGES);
    await page.goto(`/artifact/${ARTIFACT_A_ID}`);

    // Artifact detail page loads
    await expect(page.getByRole("heading", { name: "Research Concept A" })).toBeVisible({
      timeout: 12_000,
    });

    // Click the Backlinks tab
    const backlinksTabBtn = page.locator("#artifact-tab-btn-backlinks");
    await expect(backlinksTabBtn).toBeVisible({ timeout: 8_000 });
    await backlinksTabBtn.click();

    // Incoming section heading
    await expect(page.getByRole("heading", { name: /Incoming/i })).toBeVisible({
      timeout: 8_000,
    });

    // Incoming backlink row
    await expect(page.getByText("Incoming Source Evidence")).toBeVisible();

    // Outgoing section heading
    await expect(page.getByRole("heading", { name: /Outgoing/i })).toBeVisible();

    // Outgoing backlink row
    await expect(page.getByText("Outgoing Derived Concept")).toBeVisible();
  });

  test("Backlinks tab shows empty state when no edges are present", async ({
    authenticatedPage: page,
  }) => {
    await installArtifactDetailMocks(page, BACKLINKS_EMPTY);
    await page.goto(`/artifact/${ARTIFACT_A_ID}`);

    await expect(page.getByRole("heading", { name: "Research Concept A" })).toBeVisible({
      timeout: 12_000,
    });

    const backlinksTabBtn = page.locator("#artifact-tab-btn-backlinks");
    await expect(backlinksTabBtn).toBeVisible({ timeout: 8_000 });
    await backlinksTabBtn.click();

    // Empty state message
    await expect(page.getByLabel(/No backlinks found/i)).toBeVisible({ timeout: 8_000 });

    // No edge rows rendered
    await expect(page.getByText("Incoming Source Evidence")).toHaveCount(0);
  });
});
