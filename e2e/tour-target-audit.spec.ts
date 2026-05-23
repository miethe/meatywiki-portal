/**
 * tour-target-audit.spec.ts — Verify that every data-tour target in TOURS is
 * reachable in the DOM for tours that can be tested without fixture data.
 *
 * Strategy:
 *   - For each testable tour (inbox, library, graph, researchWizard, decisions)
 *     navigate to the corresponding page and assert that every step's CSS
 *     selector is present in the DOM (attached, not necessarily visible —
 *     some targets are inside collapsed panels or conditional sections).
 *   - Tours that require a specific entity to already exist in the database
 *     (artifactDetail, workflowRun, lensScoring) are skipped with test.skip()
 *     because they have no stable URL without fixture data.
 *
 * Auth:
 *   Uses the authenticatedPage fixture from e2e/support/fixtures.ts, which
 *   seeds the portal_session cookie so the layout shell does not redirect to
 *   /login.
 *
 * Backend dependency:
 *   Uses skipIfBackendDown to skip gracefully when the backend is unreachable.
 *
 * Page map:
 *   inbox          → /inbox
 *   library        → /library
 *   graph          → /graph
 *   researchWizard → /research
 *   decisions      → /decisions
 */

import type { Page } from "@playwright/test";
import { TOURS } from "../src/lib/copy/tours";
import { test, expect } from "./support/fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to `path` and wait for the DOM to be ready. Uses
 * waitForLoadState("domcontentloaded") as the minimum bar — the graph page
 * requires ssr:false dynamic imports that settle asynchronously, so we also
 * wait for networkidle on graph-page assertions.
 */
async function goTo(page: Page, path: string, waitForIdle = false) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  if (waitForIdle) {
    await page.waitForLoadState("networkidle").catch(() => {});
  }
}

/**
 * Assert that every step target in the given steps array is attached to the
 * DOM. Does not require visibility — some panels are hidden until interaction.
 */
async function assertAllTargetsAttached(
  page: Page,
  steps: readonly { target: string; title: string }[],
) {
  for (const step of steps) {
    const locator = page.locator(step.target);
    await expect(
      locator.first(),
      `Tour target "${step.target}" (step: "${step.title}") should be attached to the DOM`,
    ).toBeAttached({ timeout: 8_000 });
  }
}

// ---------------------------------------------------------------------------
// Inbox tour
// ---------------------------------------------------------------------------

test.describe("Tour target audit — inbox", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("all inbox tour targets are present in the DOM", async ({
    authenticatedPage: page,
    skipIfBackendDown: _skip,
  }) => {
    await goTo(page, "/inbox");
    await assertAllTargetsAttached(page, TOURS.inbox);
  });
});

// ---------------------------------------------------------------------------
// Library tour
// ---------------------------------------------------------------------------

test.describe("Tour target audit — library", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("all library tour targets are present in the DOM", async ({
    authenticatedPage: page,
    skipIfBackendDown: _skip,
  }) => {
    await goTo(page, "/library");
    await assertAllTargetsAttached(page, TOURS.library);
  });
});

// ---------------------------------------------------------------------------
// Graph tour
// ---------------------------------------------------------------------------

test.describe("Tour target audit — graph", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("all graph tour targets are present in the DOM", async ({
    authenticatedPage: page,
    skipIfBackendDown: _skip,
  }) => {
    // The graph page uses ssr:false dynamic imports; waiting for networkidle
    // allows the sigma / cosmos bundles to settle before asserting targets.
    await goTo(page, "/graph", /* waitForIdle */ true);
    await assertAllTargetsAttached(page, TOURS.graph);
  });
});

// ---------------------------------------------------------------------------
// Research wizard tour
// ---------------------------------------------------------------------------

test.describe("Tour target audit — researchWizard", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("all researchWizard tour targets are present in the DOM", async ({
    authenticatedPage: page,
    skipIfBackendDown: _skip,
  }) => {
    await goTo(page, "/research");
    await assertAllTargetsAttached(page, TOURS.researchWizard);
  });
});

// ---------------------------------------------------------------------------
// Decisions tour
// ---------------------------------------------------------------------------

test.describe("Tour target audit — decisions", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("decisions-list target is present on the decisions list page", async ({
    authenticatedPage: page,
    skipIfBackendDown: _skip,
  }) => {
    await goTo(page, "/decisions");
    // Only assert the list-page target. The table/criteria/artifact-links
    // targets live on /decisions/[id] which requires an existing decision row.
    const listTargets = TOURS.decisions.filter(
      (s) => s.target === '[data-tour="decisions-list"]',
    );
    await assertAllTargetsAttached(page, listTargets);
  });

  test("decisions detail-page targets require fixture data — skipped", () => {
    // decisions-table, decisions-criteria, decisions-artifact-links all live
    // inside /decisions/[id]. Mark as expected skip so the suite documents
    // the gap without failing CI.
    test.skip(
      true,
      "decisions detail-page targets (decisions-table, decisions-criteria, decisions-artifact-links) require a fixture decision record at /decisions/[id]. Run after seeding the database with at least one decision table.",
    );
  });
});

// ---------------------------------------------------------------------------
// Skipped tours (require specific entity data)
// ---------------------------------------------------------------------------

test.describe("Tour target audit — skipped (require fixture data)", () => {
  test("artifactDetail tour targets require a specific artifact ID", () => {
    test.skip(
      true,
      "artifactDetail tour targets live at /artifact/[id]. Requires a pre-existing compiled artifact. Run after seeding with at least one artifact.",
    );
  });

  test("workflowRun tour targets require a specific workflow run ID", () => {
    test.skip(
      true,
      "workflowRun tour targets live at /workflows/[id]. Requires an active or completed workflow run. Run after triggering at least one compile workflow.",
    );
  });

  test("lensScoring tour targets require an artifact with lens scores", () => {
    test.skip(
      true,
      "lensScoring tour targets (lens-radar-chart, lens-dimension-sliders, lens-score-explanation, lens-comparison) are rendered inside /artifact/[id] only when lens_scores_jsonb is populated. Run after compiling an artifact with lens scoring enabled.",
    );
  });
});
