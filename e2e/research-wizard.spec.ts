/**
 * research-wizard.spec.ts — E2E tests for the Portal v2.4 research initiation
 * wizard full happy-path flow (P6-01).
 *
 * Coverage:
 *   1. Clicking "Start Research" on /research opens the InitiationWizardDialog
 *   2. Step 1 (ResearchPackageBuilder): fill topic, research_question, select
 *      sensitivity_profile, enter task_type and audience, pick time_profile
 *   3. Advancing to Step 2 via the "Analyse Routes" submit button
 *   4. Step 2 (ResearchRouteSelection): select a route card, click "Initiate Routing"
 *   5. Step 3 (PromptPackagePreview): click "Save as Draft"
 *   6. After save, /research shows the draft run in ActiveResearchRuns with "Draft" badge
 *
 * Route interception:
 *   All backend API calls are mocked so the test runs fully offline:
 *   - POST /api/workflows/external-research/routing-analysis  (Step 1 → Step 2)
 *   - POST /api/workflows/external-research (save_as_draft:true in body → draft path)
 *   - POST /api/workflows/external-research (no save_as_draft → launch path, not used here)
 *   - GET  /api/workflows/runs?*                              (ActiveResearchRuns poll)
 *
 * Auth:
 *   Applies the portal_session cookie via the authenticatedPage fixture.
 *   Does NOT require skipIfBackendDown — all network is intercepted.
 *
 * Selectors:
 *   - "Start Research" button: aria-label="Start a new research run"
 *   - Wizard dialog:           data-testid="initiation-wizard"
 *   - Topic input:             aria-label="Research package configuration" → first input
 *   - Sensitivity profile:     role=radio name=sensitivity_profile
 *   - Route cards (matrix):    aria-label matching "Select path: …"
 *   - Initiate Routing CTA:    role=button with text "Initiate Routing"
 *   - Save as Draft:           aria-label="Save as draft"
 *   - Draft badge:             text "Draft" inside the ActiveResearchRuns section
 */

import { test, expect } from "./support/fixtures";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Stable draft run ID returned by the mocked save-draft endpoint. */
const MOCK_DRAFT_RUN_ID = "01HZK8TESTDRAFT00001";

/** ISO timestamp used across all mocked run objects. */
const NOW_ISO = new Date("2026-05-24T12:00:00Z").toISOString();

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

/**
 * A minimal routing-analysis response with one card per routing category.
 * Returned by the mocked POST …/routing-analysis endpoint.
 */
function makeRoutingAnalysisResponse() {
  return {
    intent_core: {
      research_question:
        "What are the most effective patterns for managing stateful workloads in Kubernetes?",
      target_fidelity: "factual",
      estimated_depth: "standard",
    },
    extracted_entities: ["Kubernetes", "StatefulSet", "PersistentVolume"],
    archival_archetypes: ["comparative_analysis", "technical_overview"],
    route_cards: [
      {
        route: "perplexity",
        display_name: "Perplexity AI",
        routing_category: "fast_path",
        score: 0.82,
        expected_output: "Concise briefing with citations",
        rationale:
          "High recall for technical infrastructure topics; optimal for standard depth.",
      },
      {
        route: "chatgpt",
        display_name: "ChatGPT",
        routing_category: "precise_vector",
        score: 0.75,
        expected_output: "Structured analysis with code examples",
        rationale:
          "Strong reasoning capability for comparative patterns.",
      },
      {
        route: "internal_synthesis",
        display_name: "Internal Synthesis Engine",
        routing_category: "swarm_synthesis",
        score: 0.61,
        expected_output: "Comprehensive multi-source synthesis",
        rationale:
          "Cross-venue validation for exhaustive coverage.",
      },
    ],
  };
}

/**
 * A mock WorkflowRun row with status="draft".
 * Returned by the mocked GET /api/workflows/runs endpoint after saving.
 */
function makeDraftRun() {
  return {
    run_id: MOCK_DRAFT_RUN_ID,
    template_id: "external_research_v1",
    status: "draft",
    topic: "Container orchestration patterns",
    research_question:
      "What are the most effective patterns for managing stateful workloads in Kubernetes?",
    created_at: NOW_ISO,
    updated_at: NOW_ISO,
  };
}

/** Envelope shape used by listActiveResearchRuns. */
function makeRunsEnvelope(runs: ReturnType<typeof makeDraftRun>[]) {
  return { data: runs, cursor: null, etag: null };
}

// ---------------------------------------------------------------------------
// Route interception helpers
// ---------------------------------------------------------------------------

/**
 * Install all API mocks needed for the full wizard happy path.
 *
 * Called at the start of each test. Responses are queued so the test has
 * precise control over what the backend "returns" without a live server.
 */
async function installApiMocks(page: Page) {
  // ── Step 1 → Step 2: routing analysis ──────────────────────────────────────
  await page.route("**/api/workflows/external-research/routing-analysis", (route) => {
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeRoutingAnalysisResponse()),
    });
  });

  // ── Step 3: save as draft or full launch ────────────────────────────────────
  // POST /api/workflows/external-research — body contains save_as_draft: true
  // for the draft path, or no save_as_draft for the full launch path.
  // The routing-analysis endpoint is a sub-path and already handled above.
  // We match only the exact path (no sub-paths) to avoid conflicting with
  // routing-analysis which is caught by the earlier route.
  await page.route("**/api/workflows/external-research", (route) => {
    if (route.request().method() !== "POST") {
      void route.continue();
      return;
    }
    // Both save-as-draft and full launch hit the same URL. We parse the body
    // to distinguish them. In this test we only exercise the draft path but
    // handle both for robustness.
    let isSaveAsDraft = false;
    try {
      const rawBody = route.request().postData() ?? "{}";
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      isSaveAsDraft = parsed.save_as_draft === true;
    } catch {
      // Body parse failed — treat as launch (no save_as_draft key)
    }

    if (isSaveAsDraft) {
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ run_id: MOCK_DRAFT_RUN_ID }),
      });
    } else {
      // Full launch (not exercised in this test — fulfill anyway for safety)
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ run_id: "01HZK8TESTLAUNCH0001" }),
      });
    }
  });

  // ── ActiveResearchRuns poll — initially empty, then returns draft run ───────
  // We use a counter so the first fetch (before save) returns empty and
  // subsequent fetches (after redirect back to /research) return the draft.
  let fetchCount = 0;
  await page.route("**/api/workflows/runs*", (route) => {
    fetchCount += 1;
    const runs = fetchCount >= 2 ? [makeDraftRun()] : [];
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(makeRunsEnvelope(runs)),
    });
  });
}

// ---------------------------------------------------------------------------
// Helper — navigate to /research and wait for DOM ready
// ---------------------------------------------------------------------------

async function goToResearch(page: Page) {
  await page.goto("/research");
  await page.waitForLoadState("domcontentloaded");
}

// ---------------------------------------------------------------------------
// Helper — open the wizard dialog from /research
// ---------------------------------------------------------------------------

async function openWizard(page: Page) {
  // The "Start Research" button may appear either in the page header/CTA
  // area or inside the EmptyState component within ActiveResearchRuns.
  // Both use aria-label="Start a new research run".
  const triggerBtn = page.locator('[aria-label="Start a new research run"]').first();
  await expect(triggerBtn, "Start Research button should be visible").toBeVisible({
    timeout: 10_000,
  });
  await triggerBtn.click();

  // Wait for the wizard dialog to mount
  const wizard = page.locator('[data-testid="initiation-wizard"]');
  await expect(wizard, "Wizard dialog should open after clicking Start Research").toBeVisible({
    timeout: 8_000,
  });
}

// ---------------------------------------------------------------------------
// Suite: Full wizard happy path (P6-01)
// ---------------------------------------------------------------------------

test.describe("Research Wizard — full happy path (P6-01)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("completes all 3 wizard steps and shows draft badge on /research", async ({
    authenticatedPage: page,
  }) => {
    // Install API mocks before any navigation so interceptors are in place
    // when the page first loads and makes its runs-list fetch.
    await installApiMocks(page);

    await goToResearch(page);
    await openWizard(page);

    // ── Step 1: fill the research package ────────────────────────────────────

    // Verify we are on Step 1 by checking the form landmark
    const packageForm = page.locator('[aria-label="Research package configuration"]');
    await expect(packageForm, "Research package form should be visible in Step 1").toBeVisible({
      timeout: 8_000,
    });

    // Topic — the first text input inside the form
    const topicInput = packageForm.locator('input[type="text"]').first();
    await topicInput.fill("Container orchestration patterns");

    // Research question — the first textarea inside the form
    const questionTextarea = packageForm.locator("textarea").first();
    await questionTextarea.fill(
      "What are the most effective patterns for managing stateful workloads in Kubernetes?",
    );

    // Sensitivity profile — select "Internal" radio option
    // The RadioGroup uses <input type="radio" name="sensitivity_profile" value="internal">
    const internalRadio = packageForm.locator(
      'input[type="radio"][name="sensitivity_profile"][value="internal"]',
    );
    await internalRadio.check();

    // Task type — free-text input that follows the sensitivity section
    // Its aria-label is its label text; use placeholder to narrow the selector.
    const taskTypeInput = packageForm.locator(
      'input[placeholder*="comparative analysis"]',
    );
    await taskTypeInput.fill("comparative analysis");

    // Audience — free-text input with placeholder "e.g. engineering, executive"
    const audienceInput = packageForm.locator(
      'input[placeholder*="engineering"]',
    );
    await audienceInput.fill("platform engineers");

    // Time profile — click the "Standard" radio-button in the TripleToggle.
    // TripleToggle renders role="radio" aria-checked buttons inside a radiogroup.
    const timeProfileGroup = page.locator('[role="radiogroup"][aria-label="Time Profile"]');
    await timeProfileGroup.locator('[role="radio"]', { hasText: "Standard" }).click();

    // Submit Step 1 — "Analyse Routes" button (type=submit inside the form)
    const analyseBtn = packageForm.locator('button[type="submit"]', {
      hasText: /Analyse Routes/i,
    });
    await expect(analyseBtn, "Analyse Routes button should be enabled").toBeEnabled({
      timeout: 5_000,
    });
    await analyseBtn.click();

    // ── Step 2: route selection ───────────────────────────────────────────────

    // Wait for routing analysis to resolve and the matrix to appear.
    // The matrix has role="radiogroup" aria-label="Routing path options".
    const routingMatrix = page.locator(
      '[role="radiogroup"][aria-label="Routing path options"]',
    );
    await expect(routingMatrix, "Routing matrix should appear in Step 2").toBeVisible({
      timeout: 15_000,
    });

    // Select the first available route card via its "Select Path" button.
    // RoutingMatrixCard renders: button[role="radio"][aria-label="Select path: {displayName}"]
    const firstSelectPathBtn = routingMatrix
      .locator('[role="radio"]', { hasText: /Select Path/i })
      .first();
    await expect(firstSelectPathBtn, "At least one route card should be selectable").toBeVisible({
      timeout: 5_000,
    });
    await firstSelectPathBtn.click();

    // The card should now show "Selected" state (aria-checked="true")
    await expect(
      firstSelectPathBtn,
      "Selected route card should have aria-checked=true",
    ).toHaveAttribute("aria-checked", "true", { timeout: 3_000 });

    // Click "Initiate Routing" CTA — the primary footer button in Step 2.
    // ResearchRouteSelection renders: <Button aria-label is not set, but text is "Initiate Routing">
    // We also fall back to "INITIATE ROUTING" in case of uppercase CSS.
    const initiateBtn = page
      .getByRole("button", { name: /initiate routing/i })
      .last();
    await expect(initiateBtn, "Initiate Routing button should be enabled").toBeEnabled({
      timeout: 5_000,
    });
    await initiateBtn.click();

    // ── Step 3: prompt package preview ───────────────────────────────────────

    // Wait for the Configure & Launch heading to confirm Step 3 mounted
    const step3Heading = page.locator(
      '[aria-label="Configure and launch — Step 3"]',
    );
    await expect(step3Heading, "Step 3 panel should be visible").toBeVisible({
      timeout: 8_000,
    });

    // Click "Save as Draft" — aria-label="Save as draft"
    const saveAsDraftBtn = page.locator('[aria-label="Save as draft"]');
    await expect(saveAsDraftBtn, "Save as Draft button should be visible").toBeVisible({
      timeout: 5_000,
    });
    await saveAsDraftBtn.click();

    // ── Assert: draft run visible on /research ────────────────────────────────

    // After save, the wizard navigates to /research.
    // We wait for the navigation first.
    await page.waitForURL("**/research", { timeout: 10_000 });
    await page.waitForLoadState("domcontentloaded");

    // The ActiveResearchRuns section renders draft cards with a "Draft" badge.
    // aria-label="N draft run(s)" wraps the draft card grid.
    const activeRunsSection = page.locator(
      '[aria-label="Active Research Runs"]',
    );
    await expect(
      activeRunsSection,
      "Active Research Runs section should be visible after redirect",
    ).toBeVisible({ timeout: 8_000 });

    // Wait for the draft badge text "Draft" to appear inside the section.
    // DraftBadge renders a <span> containing the text "Draft" (with FileEdit icon).
    const draftBadge = activeRunsSection.getByText("Draft").first();
    await expect(
      draftBadge,
      "Draft badge should be visible in ActiveResearchRuns after saving",
    ).toBeVisible({ timeout: 10_000 });
  });

  // ---------------------------------------------------------------------------
  // Regression: wizard dialog can be cancelled on Step 1 without side effects
  // ---------------------------------------------------------------------------

  test("cancelling the wizard on Step 1 closes the dialog", async ({
    authenticatedPage: page,
  }) => {
    await installApiMocks(page);
    await goToResearch(page);
    await openWizard(page);

    // Wizard should be open on Step 1
    const wizard = page.locator('[data-testid="initiation-wizard"]');
    await expect(wizard).toBeVisible({ timeout: 8_000 });

    // Click Cancel (aria-label="Cancel wizard")
    const cancelBtn = page.locator('[aria-label="Cancel wizard"]');
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });
    await cancelBtn.click();

    // Dialog should close — the wizard is no longer attached
    await expect(wizard, "Wizard should be closed after Cancel").not.toBeAttached({
      timeout: 5_000,
    });
  });

  // ---------------------------------------------------------------------------
  // Regression: "Next →" footer button also advances Step 1 → Step 2
  // ---------------------------------------------------------------------------

  test("footer Next button advances from Step 1 to Step 2", async ({
    authenticatedPage: page,
  }) => {
    await installApiMocks(page);
    await goToResearch(page);
    await openWizard(page);

    // Fill minimum required fields so Step 1 is valid
    const packageForm = page.locator('[aria-label="Research package configuration"]');
    await packageForm.locator('input[type="text"]').first().fill("Kubernetes StatefulSets");
    await packageForm
      .locator("textarea")
      .first()
      .fill("How do StatefulSets differ from Deployments for stateful apps?");

    // The ResearchInitiationWizardInner footer has a "Next →" button
    // with aria-label="Advance to next step"
    const nextBtn = page.locator('[aria-label="Advance to next step"]');
    await expect(nextBtn, "Next button should be visible in footer").toBeVisible({
      timeout: 5_000,
    });
    await nextBtn.click();

    // Routing matrix should eventually appear (mocked response is instant)
    const routingMatrix = page.locator(
      '[role="radiogroup"][aria-label="Routing path options"]',
    );
    await expect(
      routingMatrix,
      "Routing matrix should appear after clicking Next from Step 1",
    ).toBeVisible({ timeout: 15_000 });
  });
});
