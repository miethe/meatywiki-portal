/**
 * Research Journey 4 — Review Queue (P4-05).
 *
 * Covers: /research/queue → list artifacts with gate-type chips + stub
 * action buttons → buttons are disabled with v1.5 tooltip → empty state
 * renders when the mock returns zero items.
 */

import { test, expect } from "../../support/fixtures";
import {
  installResearchMocks,
  makeArtifactCard,
} from "../../support/research-mocks";

test.describe("Research: Review Queue journey", () => {
  test("renders review rows with gate chips + disabled action buttons", async ({
    authenticatedPage: page,
  }) => {
    const staleArtifact = makeArtifactCard({
      id: "01HXYZ00000000000000RV001",
      title: "Stale Concept Needing Refresh",
      type: "concept",
      status: "stale",
      metadata: {
        fidelity: "medium",
        freshness: "stale",
        verification_state: "unverified",
      },
    });
    const disputedArtifact = makeArtifactCard({
      id: "01HXYZ00000000000000RV002",
      title: "Disputed Claim",
      type: "concept",
      status: "stale",
      metadata: {
        fidelity: "high",
        freshness: "current",
        verification_state: "disputed",
      },
    });

    await installResearchMocks(page, {
      artifactsList: [
        {
          // Review queue fetch uses status=stale
          match: (url) => url.searchParams.get("status") === "stale",
          body: { data: [staleArtifact, disputedArtifact], cursor: null },
        },
      ],
    });

    await page.goto("/research/queue");

    await expect(
      page.getByRole("heading", { name: "Review Queue", level: 1 }),
    ).toBeVisible();

    // Count summary
    await expect(page.getByText(/2 artifacts flagged for review/i)).toBeVisible(
      { timeout: 5_000 },
    );

    // Both rows visible
    await expect(
      page.getByRole("link", { name: /Stale Concept Needing Refresh/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Disputed Claim/ }),
    ).toBeVisible();

    // Gate chips (derived from artifact metadata)
    await expect(
      page.getByLabel(/Triggered by: Freshness gate/i).first(),
    ).toBeVisible();
    await expect(
      page.getByLabel(/Triggered by: Contradiction gate/i),
    ).toBeVisible();

    // Action buttons — all three stubs per row, all disabled with v1.5 tooltip
    const firstRowActions = page.getByRole("group", {
      name: /Actions for Stale Concept Needing Refresh/i,
    });
    const promote = firstRowActions.getByRole("button", { name: /Promote/i });
    const archive = firstRowActions.getByRole("button", { name: /Archive/i });
    const linkBtn = firstRowActions.getByRole("button", { name: /Link/i });

    for (const btn of [promote, archive, linkBtn]) {
      await expect(btn).toBeVisible();
      await expect(btn).toBeDisabled();
      // The aria-label carries the v1.5 tooltip copy
      await expect(btn).toHaveAttribute(
        "aria-label",
        /available in Portal v1\.5/i,
      );
    }
  });

  test("empty state renders when queue returns no items", async ({
    authenticatedPage: page,
  }) => {
    await installResearchMocks(page, {
      artifactsList: [
        {
          match: (url) => url.searchParams.get("status") === "stale",
          body: { data: [], cursor: null },
        },
      ],
    });

    await page.goto("/research/queue");

    await expect(
      page.getByRole("status", { name: /Review queue is empty/i }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/No artifacts in review/i)).toBeVisible();
  });
});
