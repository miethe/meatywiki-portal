/**
 * Research Journey 2 — Backlinks Explorer (P4-03).
 *
 * Covers: /research/backlinks → enter artifact id → see Incoming + Outgoing
 * lists with edge-type chips → click a peer link → land on /artifact/:id.
 */

import { test, expect } from "../../support/fixtures";
import {
  installResearchMocks,
  makeArtifactDetail,
  ARTIFACT_A_ID,
  ARTIFACT_B_ID,
} from "../../support/research-mocks";

const PEER_INCOMING = "01HXYZ00000000000000PEER1";
const PEER_OUTGOING = "01HXYZ00000000000000PEER2";

test.describe("Research: Backlinks Explorer journey", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await installResearchMocks(page, {
      artifactEdges: {
        [ARTIFACT_A_ID]: {
          incoming: [
            {
              artifact_id: PEER_INCOMING,
              type: "supports",
              title: "Peer Concept Alpha",
              subtype: "concept",
            },
          ],
          outgoing: [
            {
              artifact_id: PEER_OUTGOING,
              type: "derived_from",
              title: "Peer Evidence Beta",
              subtype: "evidence",
            },
          ],
        },
        [ARTIFACT_B_ID]: {
          incoming: [],
          outgoing: [],
        },
      },
      artifactDetail: {
        [PEER_OUTGOING]: makeArtifactDetail({
          id: PEER_OUTGOING,
          title: "Peer Evidence Beta",
          type: "evidence",
        }),
      },
    });
  });

  test("renders incoming + outgoing edge lists with chips", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/research/backlinks");

    await expect(
      page.getByRole("heading", { name: "Backlinks", level: 1 }),
    ).toBeVisible();

    // Empty state before lookup
    await expect(
      page.getByText(/Select an artifact to view its backlinks/i),
    ).toBeVisible();

    await page.getByRole("textbox", { name: /Artifact ID/i }).fill(ARTIFACT_A_ID);
    await page.getByRole("button", { name: /View backlinks/i }).click();

    // Both section headings appear
    await expect(
      page.getByRole("heading", { name: /Incoming/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("heading", { name: /Outgoing/i })).toBeVisible();

    // Edge type chips
    await expect(page.getByLabel(/Edge type: Supports/i)).toBeVisible();
    await expect(page.getByLabel(/Edge type: Derived from/i)).toBeVisible();

    // Peer titles
    await expect(
      page.getByRole("link", { name: "Peer Concept Alpha" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Peer Evidence Beta" }),
    ).toBeVisible();
  });

  test("clicking a peer link navigates to /artifact/:id", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/research/backlinks");
    await page.getByRole("textbox", { name: /Artifact ID/i }).fill(ARTIFACT_A_ID);
    await page.getByRole("button", { name: /View backlinks/i }).click();

    const peerLink = page.getByRole("link", { name: "Peer Evidence Beta" });
    await expect(peerLink).toBeVisible({ timeout: 5_000 });
    await peerLink.click();

    await expect(page).toHaveURL(new RegExp(`/artifact/${PEER_OUTGOING}$`), {
      timeout: 10_000,
    });
  });

  test("empty-state shows when artifact has no edges", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/research/backlinks");
    await page.getByRole("textbox", { name: /Artifact ID/i }).fill(ARTIFACT_B_ID);
    await page.getByRole("button", { name: /View backlinks/i }).click();

    await expect(
      page.getByRole("status", { name: /No edges found/i }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
