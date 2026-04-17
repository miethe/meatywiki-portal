/**
 * Research Journey 3 — Freshness + Contradiction review (P4-04).
 *
 * Covers: /artifact/:id detail → freshness badge renders correct colour/text
 * per lens_freshness + stale_after state, contradiction flag appears iff the
 * edges endpoint includes ≥1 `contradicts` edge.
 *
 * Matrix:
 *   CURRENT   — lens_freshness = fresh, no stale_after
 *   STALE     — lens_freshness = stale
 *   OUTDATED  — lens_freshness = outdated
 *   MISSING   — both fields null → badge absent
 *   CONTRADICTS — edges contain a `contradicts` edge → red flag appears
 */

import { test, expect } from "../../support/fixtures";
import {
  installResearchMocks,
  makeArtifactDetail,
  ARTIFACT_CURRENT_ID,
  ARTIFACT_STALE_ID,
  ARTIFACT_OUTDATED_ID,
  ARTIFACT_MISSING_ID,
  ARTIFACT_CONTRADICTS_ID,
} from "../../support/research-mocks";

test.describe("Research: Freshness + contradiction review journey", () => {
  test("current freshness renders 'current' pill", async ({
    authenticatedPage: page,
  }) => {
    await installResearchMocks(page, {
      artifactDetail: {
        [ARTIFACT_CURRENT_ID]: makeArtifactDetail({
          id: ARTIFACT_CURRENT_ID,
          title: "Current Artifact",
          frontmatter_jsonb: { lens_freshness: "fresh" },
        }),
      },
      artifactEdges: { [ARTIFACT_CURRENT_ID]: { incoming: [], outgoing: [] } },
    });

    await page.goto(`/artifact/${ARTIFACT_CURRENT_ID}`);
    // Target the ArtifactFreshnessBadge specifically (distinct title attribute)
    await expect(
      page.locator('[title="Freshness indicator: current"]'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[title="Freshness indicator: stale"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[title="Freshness indicator: outdated"]'),
    ).toHaveCount(0);
  });

  test("stale freshness renders 'stale' pill", async ({
    authenticatedPage: page,
  }) => {
    await installResearchMocks(page, {
      artifactDetail: {
        [ARTIFACT_STALE_ID]: makeArtifactDetail({
          id: ARTIFACT_STALE_ID,
          title: "Stale Artifact",
          frontmatter_jsonb: { lens_freshness: "stale" },
        }),
      },
      artifactEdges: { [ARTIFACT_STALE_ID]: { incoming: [], outgoing: [] } },
    });

    await page.goto(`/artifact/${ARTIFACT_STALE_ID}`);
    await expect(
      page.locator('[title="Freshness indicator: stale"]'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("outdated freshness renders 'outdated' pill", async ({
    authenticatedPage: page,
  }) => {
    await installResearchMocks(page, {
      artifactDetail: {
        [ARTIFACT_OUTDATED_ID]: makeArtifactDetail({
          id: ARTIFACT_OUTDATED_ID,
          title: "Outdated Artifact",
          frontmatter_jsonb: { lens_freshness: "outdated" },
        }),
      },
      artifactEdges: {
        [ARTIFACT_OUTDATED_ID]: { incoming: [], outgoing: [] },
      },
    });

    await page.goto(`/artifact/${ARTIFACT_OUTDATED_ID}`);
    await expect(
      page.locator('[title="Freshness indicator: outdated"]'),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("missing freshness fields render no badge", async ({
    authenticatedPage: page,
  }) => {
    await installResearchMocks(page, {
      artifactDetail: {
        [ARTIFACT_MISSING_ID]: makeArtifactDetail({
          id: ARTIFACT_MISSING_ID,
          title: "Missing Freshness Artifact",
          frontmatter_jsonb: {}, // no lens_freshness, no stale_after
        }),
      },
      artifactEdges: {
        [ARTIFACT_MISSING_ID]: { incoming: [], outgoing: [] },
      },
    });

    await page.goto(`/artifact/${ARTIFACT_MISSING_ID}`);
    // Wait for detail to load (breadcrumb present)
    await expect(
      page.getByRole("navigation", { name: /Breadcrumb/i }),
    ).toBeVisible({ timeout: 10_000 });

    // ArtifactFreshnessBadge renders nothing (no element with this title)
    await expect(
      page.locator('[title^="Freshness indicator:"]'),
    ).toHaveCount(0);
  });

  test("contradiction flag appears when edges include a contradicts edge", async ({
    authenticatedPage: page,
  }) => {
    await installResearchMocks(page, {
      artifactDetail: {
        [ARTIFACT_CONTRADICTS_ID]: makeArtifactDetail({
          id: ARTIFACT_CONTRADICTS_ID,
          title: "Contradicted Artifact",
          frontmatter_jsonb: { lens_freshness: "fresh" },
        }),
      },
      artifactEdges: {
        [ARTIFACT_CONTRADICTS_ID]: {
          incoming: [
            {
              artifact_id: "01HXYZ00000000000000CONF1",
              type: "contradicts",
              title: "Conflicting Claim",
              subtype: "concept",
            },
          ],
          outgoing: [],
        },
      },
    });

    await page.goto(`/artifact/${ARTIFACT_CONTRADICTS_ID}`);
    await expect(
      page.getByLabel(/Contradicted by 1 linked artifact/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("contradiction flag hidden when no contradicts edges", async ({
    authenticatedPage: page,
  }) => {
    const id = "01HXYZ00000000000000NOCON";
    await installResearchMocks(page, {
      artifactDetail: {
        [id]: makeArtifactDetail({
          id,
          title: "Uncontradicted Artifact",
          frontmatter_jsonb: { lens_freshness: "fresh" },
        }),
      },
      artifactEdges: {
        [id]: {
          incoming: [
            {
              artifact_id: "01HXYZ0000000000000000AAA",
              type: "supports",
              title: "Supporting Peer",
              subtype: "concept",
            },
          ],
          outgoing: [],
        },
      },
    });

    await page.goto(`/artifact/${id}`);
    await expect(
      page.getByRole("navigation", { name: /Breadcrumb/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByLabel(/Contradicted by/i),
    ).toHaveCount(0);
  });
});
