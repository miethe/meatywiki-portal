/**
 * E2E: Portal v2.6 — Link artifact flow (P5-01 coverage).
 *
 * Scenario:
 *   Open artifact detail → Connections tab → "Add connection" →
 *   ArtifactSearchDialog → pick artifact → edge-type confirm dialog →
 *   Confirm → assert the new connection card appears.
 *
 * All network traffic is intercepted via page.route() — no live backend
 * required. The test stubs:
 *   GET  /api/artifacts/:id           — source artifact detail
 *   GET  /api/artifacts/:id/edges     — initially empty; updated after link
 *   GET  /api/artifacts?**            — search results for the picker dialog
 *   POST /api/artifacts/:id/link      — link endpoint (202 stub)
 *
 * Assumed data-testid / aria values:
 *   - "Add a new connection to this artifact" (aria-label on + button)
 *   - "Find artifact to connect" (dialog title text)
 *   - ArtifactSearchDialog: role="dialog", title "Find artifact to connect"
 *   - "Add connection" (dialog title in confirm step)
 *   - "edge-type-select" (id on the connection-type Select trigger)
 *   - Connection card renders target title text once linked
 *   - Toast with text "Connection added" after success
 */

import { test, expect } from "../../support/fixtures";
import {
  installResearchMocks,
  makeArtifactDetail,
  makeArtifactCard,
  ARTIFACT_A_ID,
  ARTIFACT_B_ID,
} from "../../support/research-mocks";
import type { EdgeSpec } from "../../support/research-mocks";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const SOURCE_ID = ARTIFACT_A_ID;
const TARGET_ID = ARTIFACT_B_ID;
const TARGET_TITLE = "Supporting Evidence Beta";

const sourceDetail = makeArtifactDetail({
  id: SOURCE_ID,
  title: "Research Concept Alpha",
  type: "concept",
});

const targetCard = makeArtifactCard({
  id: TARGET_ID,
  title: TARGET_TITLE,
  type: "evidence",
  workspace: "library",
});

// The artifact list returned by the search dialog
const searchResults = {
  data: { items: [targetCard], cursor: null },
};

// Edge list — empty initially; non-empty after link
const emptyEdges = { artifact_id: SOURCE_ID, incoming: [] as EdgeSpec[], outgoing: [] as EdgeSpec[] };
const linkedEdges = {
  artifact_id: SOURCE_ID,
  incoming: [] as EdgeSpec[],
  outgoing: [
    {
      artifact_id: TARGET_ID,
      type: "supports" as const,
      title: TARGET_TITLE,
      subtype: "evidence",
    },
  ] as EdgeSpec[],
};

// ---------------------------------------------------------------------------
// Route setup
// ---------------------------------------------------------------------------

async function setupLinkFlow(page: Page): Promise<void> {
  let edgesState = emptyEdges;

  await installResearchMocks(page, {
    artifactDetail: {
      [SOURCE_ID]: sourceDetail,
    },
    artifactEdges: {
      [SOURCE_ID]: { incoming: [], outgoing: [] },
    },
    artifactsList: [{ body: searchResults }],
  });

  // Override the edges route to return updated state after linking
  await page.route(`**/api/artifacts/${SOURCE_ID}/edges**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(edgesState),
    });
  });

  // POST /api/artifacts/:id/link → 201 Created
  await page.route(`**/api/artifacts/${SOURCE_ID}/link`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    // Simulate the edge existing now
    edgesState = linkedEdges;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ source_id: SOURCE_ID, target_id: TARGET_ID, edge_type: "supports" }),
    });
  });

  // Also mock /api/artifacts/:id for the target detail (search preview)
  await page.route(`**/api/artifacts/${TARGET_ID}**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = route.request().url();
    // Skip edges sub-route — handled by wildcard in installResearchMocks
    if (url.includes("/edges")) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: makeArtifactDetail({ id: TARGET_ID, title: TARGET_TITLE, type: "evidence" }) }),
    });
  });
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe("Portal v2.6 — Link artifact via Connections tab", () => {
  test("add connection: search → pick → choose edge type → confirm → card appears", async ({
    authenticatedPage: page,
  }) => {
    await setupLinkFlow(page);
    await page.goto(`/artifact/${SOURCE_ID}`);

    // 1. Artifact detail loads
    await expect(page.getByRole("heading", { name: "Research Concept Alpha" })).toBeVisible({
      timeout: 15_000,
    });

    // 2. Navigate to Connections tab
    const connectionsTabBtn = page.locator("#artifact-tab-btn-connections");
    await expect(connectionsTabBtn).toBeVisible({ timeout: 10_000 });
    await connectionsTabBtn.click();

    // 3. Empty state is shown initially
    const tabPanel = page.locator('[id="artifact-tab-panel-connections"]');
    await expect(tabPanel).toBeVisible({ timeout: 5_000 });

    // 4. Click "Add connection"
    const addConnectionBtn = page.getByRole("button", {
      name: /add a new connection to this artifact/i,
    });
    await expect(addConnectionBtn).toBeVisible({ timeout: 5_000 });
    await addConnectionBtn.click();

    // 5. ArtifactSearchDialog opens
    const searchDialog = page.getByRole("dialog", { name: /find artifact to connect/i });
    await expect(searchDialog).toBeVisible({ timeout: 5_000 });

    // 6. Target artifact appears in search results
    await expect(searchDialog.getByText(TARGET_TITLE)).toBeVisible({ timeout: 8_000 });

    // 7. Click the target artifact to select it
    const targetRow = searchDialog.locator(`[role="option"], button, [role="row"]`).filter({
      hasText: TARGET_TITLE,
    }).first();
    // Fallback: click on text directly if specific role not found
    const targetClickable = searchDialog.getByText(TARGET_TITLE).first();
    await targetClickable.click();

    // 8. Edge-type confirmation dialog opens ("Add connection")
    const confirmDialog = page.getByRole("dialog", { name: /add connection/i });
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });

    // 9. The target artifact's name should be displayed in the confirm dialog
    await expect(confirmDialog.getByText(TARGET_TITLE)).toBeVisible();

    // 10. Choose edge type — select "Supports" from the Select
    const edgeTypeSelect = confirmDialog.locator("#edge-type-select");
    await edgeTypeSelect.click();
    await page.getByRole("option", { name: "Supports" }).click();

    // 11. Confirm the connection
    const confirmBtn = confirmDialog.getByRole("button", { name: /add connection/i });
    await confirmBtn.click();

    // 12. Success toast appears
    await expect(
      page.getByRole("status").filter({ hasText: /connection added/i }),
    ).toBeVisible({ timeout: 8_000 });

    // 13. The new connection card (or stub row) is visible in the Connections tab
    await expect(tabPanel.getByText(TARGET_TITLE)).toBeVisible({ timeout: 8_000 });
  });
});
