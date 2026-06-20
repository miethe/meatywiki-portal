/**
 * E2E: Portal v2.6 — Peek + expand flow (P5-01 coverage).
 *
 * Scenario A — peek from connection card:
 *   Open artifact detail → Connections tab → click connection card →
 *   assert ArtifactPeekModal opens → click "Expand" →
 *   assert full-page navigation to /artifact/:peekId.
 *
 * Scenario B — peek from backlink row:
 *   Open artifact detail → Backlinks tab → click a backlink row →
 *   assert peek modal opens → click "Expand" → assert full-page nav.
 *
 * Stubs:
 *   GET /api/artifacts/:id         — source + peer detail
 *   GET /api/artifacts/:id/edges   — outgoing edge to PEER
 *   GET /api/artifacts/:id/backlinks — incoming backlink from PEER
 *   GET /api/artifacts/:id/processing-history — empty
 *
 * Assumed aria / testid anchors:
 *   - ConnectionCard emits a button/link whose text is the peer title
 *   - ArtifactPeekModal: role="dialog" with aria-label containing "Peek" or
 *     with a DialogTitle containing the artifact name
 *   - "Expand" button: aria-label contains "Open … on full page" or text "Expand"
 *   - Backlinks tab button: id="artifact-tab-btn-backlinks"
 *   - Backlink row: button with peer title text
 *
 * data-testid values assumed to exist (to be added if missing):
 *   None — role/text selectors used throughout.
 */

import { test, expect } from "../../support/fixtures";
import {
  installResearchMocks,
  makeArtifactDetail,
  ARTIFACT_A_ID,
  ARTIFACT_B_ID,
} from "../../support/research-mocks";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const SOURCE_ID = ARTIFACT_A_ID;
const PEER_ID = ARTIFACT_B_ID;
const PEER_TITLE = "Supporting Evidence Gamma";

const sourceDetail = makeArtifactDetail({
  id: SOURCE_ID,
  title: "Core Concept",
  type: "concept",
});

const peerDetail = makeArtifactDetail({
  id: PEER_ID,
  title: PEER_TITLE,
  type: "evidence",
});

// Outgoing edge: SOURCE → PEER
const sourceEdges = {
  incoming: [],
  outgoing: [
    {
      artifact_id: PEER_ID,
      type: "supports" as const,
      title: PEER_TITLE,
      subtype: "evidence",
    },
  ],
};

// Backlinks from PEER → SOURCE (returned by /backlinks endpoint)
const sourceBacklinks = {
  artifact_id: SOURCE_ID,
  incoming: [
    {
      id: PEER_ID,
      title: PEER_TITLE,
      type: "evidence",
      edge_type: "supports",
      direction: "incoming",
    },
  ],
  outgoing: [],
};

// ---------------------------------------------------------------------------
// Route setup
// ---------------------------------------------------------------------------

async function setupPeekMocks(page: Page): Promise<void> {
  await installResearchMocks(page, {
    artifactDetail: {
      [SOURCE_ID]: sourceDetail,
      [PEER_ID]: peerDetail,
    },
    artifactEdges: {
      [SOURCE_ID]: sourceEdges,
      [PEER_ID]: { incoming: [], outgoing: [] },
    },
  });

  // Backlinks endpoint
  await page.route(`**/api/artifacts/${SOURCE_ID}/backlinks**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: sourceBacklinks }),
    });
  });

  // Processing history (required by ProcessingHistoryTab which mounts on Backlinks tab nav)
  await page.route(`**/api/artifacts/*/processing-history**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { items: [] } }),
    });
  });
}

// ---------------------------------------------------------------------------
// Helper: assert peek modal opens and close it
// ---------------------------------------------------------------------------

async function assertPeekModal(page: Page, peekId: string): Promise<void> {
  // The peek modal is a Dialog — look for it by role or specific content
  // BaseArtifactModal uses Radix Dialog so it will have role="dialog"
  const peekModal = page.getByRole("dialog").filter({
    // It should either contain the peer title or an Expand button
    hasText: new RegExp(`${PEER_TITLE}|expand|loading`, "i"),
  }).first();

  await expect(peekModal).toBeVisible({ timeout: 10_000 });

  // The Expand button (aria-label: "Open <title> on full page")
  const expandBtn = peekModal
    .getByRole("button", { name: /open .* on full page|expand/i })
    .first();

  await expect(expandBtn).toBeVisible({ timeout: 8_000 });

  // Click Expand → should navigate to full artifact page
  await expandBtn.click();

  // Modal should close and URL should be the full artifact page
  await expect(page).toHaveURL(new RegExp(`/artifact/${peekId}`), {
    timeout: 10_000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Portal v2.6 — Peek modal + expand", () => {
  test("Connections tab card → peek modal opens → Expand navigates to full page", async ({
    authenticatedPage: page,
  }) => {
    await setupPeekMocks(page);
    await page.goto(`/artifact/${SOURCE_ID}`);

    await expect(page.getByRole("heading", { name: "Core Concept" })).toBeVisible({
      timeout: 15_000,
    });

    // 1. Open Connections tab
    const connectionsTabBtn = page.locator("#artifact-tab-btn-connections");
    await expect(connectionsTabBtn).toBeVisible({ timeout: 10_000 });
    await connectionsTabBtn.click();

    // 2. Wait for edge list to load and display the peer card/row
    const tabPanel = page.locator('[id="artifact-tab-panel-connections"]');
    await expect(tabPanel.getByText(PEER_TITLE)).toBeVisible({ timeout: 10_000 });

    // 3. Click the connection card to open peek
    //    ConnectionCard wraps ArtifactCard with onPeek; clicking opens peek modal
    await tabPanel.getByText(PEER_TITLE).first().click();

    // 4. Assert peek modal opens and test Expand navigation
    await assertPeekModal(page, PEER_ID);
  });

  test("Backlinks tab row → peek modal opens → Expand navigates to full page", async ({
    authenticatedPage: page,
  }) => {
    await setupPeekMocks(page);
    await page.goto(`/artifact/${SOURCE_ID}`);

    await expect(page.getByRole("heading", { name: "Core Concept" })).toBeVisible({
      timeout: 15_000,
    });

    // 1. Open Backlinks tab
    const backlinksTabBtn = page.locator("#artifact-tab-btn-backlinks");
    await expect(backlinksTabBtn).toBeVisible({ timeout: 10_000 });
    await backlinksTabBtn.click();

    // 2. Wait for backlinks to load
    await expect(page.getByText(PEER_TITLE)).toBeVisible({ timeout: 10_000 });

    // 3. Click the backlink row button (BacklinkRow renders button when onPeek is set)
    const backlinkButton = page.getByRole("button", {
      name: new RegExp(`Peek at ${PEER_TITLE}|${PEER_TITLE}`, "i"),
    }).first();

    // Fallback: click the text directly
    const backlinkClickable = (await backlinkButton.count()) > 0
      ? backlinkButton
      : page.getByText(PEER_TITLE).first();

    await backlinkClickable.click();

    // 4. Assert peek modal opens and test Expand navigation
    await assertPeekModal(page, PEER_ID);
  });
});
