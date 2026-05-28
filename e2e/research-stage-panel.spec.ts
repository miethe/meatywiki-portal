/**
 * research-stage-panel.spec.ts — E2E tests for portal-v2.1 P4-05.
 *
 * Coverage:
 *   1. Synthesis panel renders for external_research_v1 + synthesis stage name.
 *   2. Draft panel: format checkboxes visible; "Generate Drafts" posts to the
 *      mocked draft endpoint and displays the resulting artifact links.
 *   3. Review panel: citation checklist + pass/fail banner; strict-mode toggle
 *      gates "Pass Review & File Back" CTA; success state shows artifact link.
 *   4. Non-external_research_v1 workflow does NOT mount research panels.
 *   5. Visual snapshots — one screenshot per panel state.
 *
 * All backend API calls are intercepted at the Playwright route layer.
 * No real LLM, no real Postgres, no real backend process required.
 *
 * Routes mocked:
 *   GET  /api/workflows/:runId          — WorkflowRun single envelope
 *   GET  /api/workflows/:runId/timeline — WorkflowEventDTO[]
 *   GET  /api/workflows/:runId/audit-log — empty list
 *   GET  /api/workflows/runs?*          — run history (empty)
 *   POST /api/workflows/:runId/external-research/synthesize
 *   POST /api/workflows/:runId/external-research/draft
 *   POST /api/workflows/:runId/external-research/review
 *   PATCH /api/workflows/:runId/external-research/review
 *   GET  /api/artifacts/{id}/compile/events - compile SSE (empty stream)
 *   GET  /api/workflows/{id}/stream         - workflow SSE (empty stream)
 *
 * Important implementation notes:
 *   - WorkflowViewerScreen starts with selectedStageName=null; ResearchStagePanel
 *     only renders once the user clicks a timeline stage button. The helper
 *     goToWorkflowViewer clicks the first div[role="button"] in the timeline nav.
 *   - The URL pattern for /api/workflows/:runId must NOT match sub-paths such as
 *     /timeline or /audit-log. We use glob patterns that end with the exact runId
 *     (no trailing slash) and handle sub-paths with separate route registrations.
 *   - The timeline mock returns a single stage_started event whose stage field
 *     is the target stage name. deriveTimelineStages groups by stage field,
 *     producing one TimelineStage entry. Clicking it populates selectedStage,
 *     allowing StageContextPanelMaybeResearch to mount ResearchStagePanel.
 */

import { test, expect } from "./support/fixtures";

// Stage-panel tests navigate to /workflows/:runId which starts the Next.js dev
// server. To prevent timeouts when many workers compete for the single server,
// run these tests serially within each browser project.
test.describe.configure({ mode: "serial" });
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Stable IDs used across fixtures
// ---------------------------------------------------------------------------

const RUN_ID = "01HZRSP00000000000000SNTH";
const NON_RESEARCH_RUN_ID = "01HZRSP00000000000000BSIC";
const SYNTH_ARTIFACT_ID = "01HZART000000000000000SYN";
const PLAN_ARTIFACT_ID = "01HZART000000000000000PLN";
const DRAFT_ARTIFACT_ID_1 = "01HZART000000000000000DR1";
const DRAFT_ARTIFACT_ID_2 = "01HZART000000000000000DR2";
const FINAL_ARTIFACT_ID = "01HZART000000000000000FNL";
const NOW_ISO = new Date("2026-05-28T10:00:00Z").toISOString();

// ---------------------------------------------------------------------------
// WorkflowRun fixture factories
// ---------------------------------------------------------------------------

function makeResearchWorkflowRun(stageName: string) {
  return {
    id: RUN_ID,
    run_id: RUN_ID,
    template_id: "external_research_v1",
    status: "running",
    started_at: NOW_ISO,
    completed_at: null,
    artifact_id: null,
    artifact_title: null,
    source_artifacts: [],
    created_artifacts: [
      { artifact_id: SYNTH_ARTIFACT_ID, title: "Kubernetes StatefulSets Synthesis" },
    ],
    metadata: {
      topic: "Container orchestration patterns",
      research_question: "How do StatefulSets differ from Deployments?",
      plan_artifact_id: PLAN_ARTIFACT_ID,
      synthesis_artifact_id: null,
      draft_artifact_ids: [],
      selected_venue: "perplexity",
      venue_score: 0.82,
    },
    current_stage: stageName,
  };
}

function makeNonResearchWorkflowRun() {
  return {
    id: NON_RESEARCH_RUN_ID,
    run_id: NON_RESEARCH_RUN_ID,
    template_id: "research_synthesis_v1",
    status: "running",
    started_at: NOW_ISO,
    completed_at: null,
    artifact_id: "01HZART000000000000000SRC",
    artifact_title: "My Wiki Concept",
    source_artifacts: [],
    created_artifacts: [],
    metadata: {},
    current_stage: "synthesize",
  };
}

// ---------------------------------------------------------------------------
// Timeline event factories
// ---------------------------------------------------------------------------

function makeTimelineEvents(stageName: string, runId: string) {
  return [
    {
      id: `evt_${runId}_1`,
      run_id: runId,
      event_type: "stage_started",
      stage: stageName,
      event_payload: { stage: stageName },
      created_at: NOW_ISO,
    },
  ];
}

// ---------------------------------------------------------------------------
// Route mock installer helpers
// ---------------------------------------------------------------------------

/**
 * Installs common mocks shared by all panel tests.
 *
 * Route priority / ordering notes:
 *   - Sub-path routes (/timeline, /audit-log, /external-research/..., /stream)
 *     are registered BEFORE the catch-all run-detail route so they take
 *     precedence. Playwright uses first-match for routes with the same glob.
 *   - The run-detail route matches the exact /api/workflows/{runId} path WITHOUT a
 *     trailing slash and WITHOUT a wildcard suffix, so it won't absorb
 *     requests for sub-paths.
 */
async function installCommonMocks(
  page: Page,
  runId: string,
  runFixture: Record<string, unknown>,
  stageName: string,
): Promise<void> {
  const token = process.env.MEATYWIKI_PORTAL_TOKEN ?? "test-token-e2e";
  await page.context().addCookies(
    ["127.0.0.1", "localhost"].map((domain) => ({
      name: "portal_session",
      value: token,
      domain,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );

  // Auth session — short-circuit any login redirect
  await page.route("**/api/auth/session", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true }),
      });
    } else {
      await route.continue();
    }
  });

  // Sub-paths registered FIRST (most-specific wins in first-match ordering):

  // GET /api/workflows/:runId/timeline
  await page.route(`**/api/workflows/${runId}/timeline**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: makeTimelineEvents(stageName, runId) }),
    });
  });

  // GET /api/workflows/:runId/audit-log
  await page.route(`**/api/workflows/${runId}/audit-log**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    });
  });

  // SSE stubs — immediately return an empty stream so the app doesn't stall
  await page.route(`**/api/workflows/${runId}/stream**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });
  await page.route("**/api/artifacts/*/compile/events**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });
  await page.route("**/api/workflow-events**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });

  // GET /api/workflows/runs?template_id=* — run history
  await page.route("**/api/workflows/runs**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], cursor: null }),
    });
  });

  // GET /api/workflows/:runId — single run detail (catch-all for exact run path)
  // Registered last so sub-paths above take precedence.
  // We gate on URL.pathname ending with /runId to avoid absorbing sub-paths.
  await page.route(`**/api/workflows/${runId}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    // Only respond when the path ends exactly with the runId (no sub-path)
    if (!url.pathname.endsWith(`/${runId}`)) return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: runFixture }),
    });
  });
}

// ---------------------------------------------------------------------------
// Helper — navigate to workflow viewer and click the first timeline stage
// ---------------------------------------------------------------------------

/**
 * Navigates to /workflows/:runId, waits for the timeline to render, then
 * clicks the first stage button to populate selectedStageName in the viewer.
 *
 * TimelinePanel renders stage nodes as div[role="button"] inside an ordered
 * list (ol) within nav[aria-label="Workflow stage timeline"]. The aria-label
 * on the <li> is "Stage N: {Label} — {status}", not the raw stage name.
 * Clicking the div[role="button"] inside the first <li> is the reliable
 * way to select the single stage from our fixture.
 *
 * ResearchStagePanel only mounts once selectedStage is non-null AND
 * templateId="external_research_v1" AND currentRun is available. All three
 * conditions are satisfied after this click + the mocked fetchWorkflowRun
 * resolves with the research run fixture.
 */
async function goToWorkflowViewer(page: Page, runId: string): Promise<void> {
  await page.goto(`/workflows/${runId}`);
  await page.waitForLoadState("domcontentloaded");

  // Wait for the timeline nav to appear with at least one stage node.
  // TimelinePanel renders aria-label="Workflow stage timeline" on the <nav>.
  const timeline = page.locator('[aria-label="Workflow stage timeline"]');
  await expect(timeline, "Timeline nav should be visible").toBeVisible({ timeout: 15_000 });

  // Click the first stage node (div[role="button"]) inside the timeline.
  // Our fixture provides exactly one stage event so there is one node.
  const firstStageNode = timeline.locator('[role="button"]').first();
  await expect(firstStageNode, "At least one stage node should be visible in timeline").toBeVisible({
    timeout: 10_000,
  });
  await firstStageNode.click();

  // After the click, StageContextPanelMaybeResearch evaluates useResearch.
  // For external_research_v1 + a known research stage name, it mounts
  // ResearchStagePanel (data-testid="research-stage-panel").
  // We wait up to 15s to allow the fetchedRun async load to complete and
  // React to re-render with the panel.
  await page.locator('[data-testid="research-stage-panel"]').waitFor({
    state: "visible",
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Suite 1: Synthesis stage panel (P4-01 / P4-05)
// ---------------------------------------------------------------------------

test.describe("ResearchStagePanel — Synthesis (P4-05)", () => {
  const STAGE = "synthesize_results";

  test.use({ viewport: { width: 1280, height: 900 } });

  test("synthesis panel renders status badge and plan artifact link", async ({
    authenticatedPage: page,
  }) => {
    const run = makeResearchWorkflowRun(STAGE);
    await installCommonMocks(page, RUN_ID, run as unknown as Record<string, unknown>, STAGE);

    // POST synthesize — returns immediately with enqueued status
    await page.route(
      `**/api/workflows/${RUN_ID}/external-research/synthesize`,
      async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            status: "enqueued",
            synthesis_artifact_id: SYNTH_ARTIFACT_ID,
            enqueued_at: NOW_ISO,
          }),
        });
      },
    );

    await goToWorkflowViewer(page, RUN_ID);

    const panel = page.locator('[data-testid="research-stage-panel"]');
    await expect(panel, "Research stage panel should be visible").toBeVisible({ timeout: 8_000 });

    // Synthesis Status heading (rendered as uppercase via CSS, but text content is "Synthesis Status")
    const statusSection = panel.locator("h4").filter({ hasText: /synthesis status/i });
    await expect(statusSection, "Synthesis Status heading should render").toBeVisible({
      timeout: 8_000,
    });

    // Plan artifact link — planArtifactId is set in fixture metadata
    const planLink = panel.locator(`[aria-label="View plan artifact ${PLAN_ARTIFACT_ID}"]`);
    await expect(planLink, "Plan artifact link should be visible").toBeVisible({ timeout: 5_000 });

    // Visual snapshot — synthesis panel idle state
    await expect(panel).toHaveScreenshot("synthesis-panel-idle.png");
  });

  test("synthesis panel shows synthesized artifact links from created_artifacts", async ({
    authenticatedPage: page,
  }) => {
    const run = makeResearchWorkflowRun(STAGE);
    // Mark synthesis complete so the synthesized artifact link renders
    (run as { status: string }).status = "complete";

    await installCommonMocks(page, RUN_ID, run as unknown as Record<string, unknown>, STAGE);
    await goToWorkflowViewer(page, RUN_ID);

    const panel = page.locator('[data-testid="research-stage-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Synthesized artifacts list — aria-label="Synthesized artifacts"
    const artifactsList = panel.locator('[aria-label="Synthesized artifacts"]');
    await expect(artifactsList, "Synthesized artifacts list should render").toBeVisible({
      timeout: 8_000,
    });

    // Confirm the list contains the artifact from created_artifacts
    const artifactLink = panel.locator(
      `[aria-label="View artifact Kubernetes StatefulSets Synthesis"]`,
    );
    await expect(artifactLink, "Artifact link should be visible").toBeVisible({ timeout: 5_000 });

    await expect(panel).toHaveScreenshot("synthesis-panel-complete.png");
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Draft stage panel (P4-02 / P4-05)
// ---------------------------------------------------------------------------

test.describe("ResearchStagePanel — Draft (P4-05)", () => {
  const STAGE = "draft_artifacts";

  test.use({ viewport: { width: 1280, height: 900 } });

  test("draft panel renders four format checkboxes", async ({
    authenticatedPage: page,
  }) => {
    const run = makeResearchWorkflowRun(STAGE);
    await installCommonMocks(page, RUN_ID, run as unknown as Record<string, unknown>, STAGE);

    await goToWorkflowViewer(page, RUN_ID);

    const panel = page.locator('[data-testid="research-stage-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // The fieldset has aria-label="Select draft formats"
    const fieldset = panel.locator('[aria-label="Select draft formats"]');
    await expect(fieldset, "Format fieldset should be visible").toBeVisible({ timeout: 8_000 });

    // Verify all four format checkboxes exist
    const formats = ["brief", "topic_note", "blog", "prd"] as const;
    for (const fmt of formats) {
      const cb = fieldset.locator(`input[type="checkbox"][value="${fmt}"]`);
      await expect(cb, `Checkbox for format "${fmt}" should be visible`).toBeVisible({
        timeout: 5_000,
      });
    }

    // "Generate Drafts" CTA is disabled when no format selected
    const generateBtn = panel.getByRole("button", { name: /generate drafts/i });
    await expect(generateBtn, "Generate Drafts button should be present").toBeVisible();
    await expect(
      generateBtn,
      "Generate Drafts should be disabled when nothing selected",
    ).toBeDisabled();

    await expect(panel).toHaveScreenshot("draft-panel-initial.png");
  });

  test("draft panel calls draft endpoint and shows resulting artifact links", async ({
    authenticatedPage: page,
  }) => {
    const run = makeResearchWorkflowRun(STAGE);
    await installCommonMocks(page, RUN_ID, run as unknown as Record<string, unknown>, STAGE);

    // Mock the draft endpoint
    let draftCallBody: unknown = null;
    await page.route(
      `**/api/workflows/${RUN_ID}/external-research/draft`,
      async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        draftCallBody = JSON.parse(route.request().postData() ?? "{}");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "enqueued",
            draft_artifact_ids: [DRAFT_ARTIFACT_ID_1, DRAFT_ARTIFACT_ID_2],
            formats: ["brief", "blog"],
            enqueued_at: NOW_ISO,
          }),
        });
      },
    );

    await goToWorkflowViewer(page, RUN_ID);

    const panel = page.locator('[data-testid="research-stage-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Select two formats
    const fieldset = panel.locator('[aria-label="Select draft formats"]');
    await fieldset.locator('input[value="brief"]').check();
    await fieldset.locator('input[value="blog"]').check();

    // Generate Drafts should now be enabled
    const generateBtn = panel.getByRole("button", { name: /generate drafts/i });
    await expect(generateBtn).toBeEnabled({ timeout: 3_000 });
    await generateBtn.click();

    // Generated Drafts section appears after the request resolves
    const draftsList = panel.locator('[aria-label="Generated draft artifacts"]');
    await expect(draftsList, "Generated draft artifacts list should appear").toBeVisible({
      timeout: 12_000,
    });

    // Both artifact links should render
    const link1 = panel.locator(`[aria-label="View draft artifact ${DRAFT_ARTIFACT_ID_1}"]`);
    const link2 = panel.locator(`[aria-label="View draft artifact ${DRAFT_ARTIFACT_ID_2}"]`);
    await expect(link1, "First draft artifact link should be visible").toBeVisible({
      timeout: 8_000,
    });
    await expect(link2, "Second draft artifact link should be visible").toBeVisible({
      timeout: 8_000,
    });

    // Verify the request body was captured (draft endpoint was called)
    expect(draftCallBody, "Draft endpoint was called with selected formats").not.toBeNull();

    // Regenerate button appears after drafts are created
    const regenBtn = panel.getByRole("button", { name: /regenerate/i });
    await expect(
      regenBtn,
      "Regenerate button should appear after draft generation",
    ).toBeVisible({ timeout: 5_000 });

    await expect(panel).toHaveScreenshot("draft-panel-with-artifacts.png");
  });

  test("draft panel shows artifact list after generation completes", async ({
    authenticatedPage: page,
  }) => {
    const run = makeResearchWorkflowRun(STAGE);
    await installCommonMocks(page, RUN_ID, run as unknown as Record<string, unknown>, STAGE);

    // Draft endpoint returns one artifact immediately
    await page.route(
      `**/api/workflows/${RUN_ID}/external-research/draft`,
      async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            status: "enqueued",
            draft_artifact_ids: [DRAFT_ARTIFACT_ID_1],
            formats: ["brief"],
            enqueued_at: NOW_ISO,
          }),
        });
      },
    );

    await goToWorkflowViewer(page, RUN_ID);
    const panel = page.locator('[data-testid="research-stage-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Select brief format and submit
    await panel.locator('[aria-label="Select draft formats"]').locator('input[value="brief"]').check();
    await panel.getByRole("button", { name: /generate drafts/i }).click();

    // After submission resolves, draft list should show the artifact
    await expect(
      panel.locator('[aria-label="Generated draft artifacts"]'),
      "Draft artifacts list should appear after generation",
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Review stage panel (P4-03 / P4-05)
// ---------------------------------------------------------------------------

test.describe("ResearchStagePanel — Review (P4-05)", () => {
  const STAGE = "review_and_finalize";

  test.use({ viewport: { width: 1280, height: 900 } });

  test("review panel renders citation review CTA and strict mode toggle", async ({
    authenticatedPage: page,
  }) => {
    const run = makeResearchWorkflowRun(STAGE);
    await installCommonMocks(page, RUN_ID, run as unknown as Record<string, unknown>, STAGE);

    await goToWorkflowViewer(page, RUN_ID);

    const panel = page.locator('[data-testid="research-stage-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Citation Review CTA is shown before review runs
    const reviewCTA = panel.getByRole("button", { name: /run citation review/i });
    await expect(reviewCTA, "Run Citation Review button should be visible").toBeVisible({
      timeout: 8_000,
    });

    // Strict mode toggle (role="switch")
    const strictToggle = panel.locator('[role="switch"][aria-checked]');
    await expect(strictToggle, "Strict mode switch should be visible").toBeVisible({
      timeout: 5_000,
    });
    // Initially advisory (unchecked)
    await expect(strictToggle).toHaveAttribute("aria-checked", "false");

    await expect(panel).toHaveScreenshot("review-panel-initial.png");
  });

  test("review panel shows pass banner and enables file-back in advisory mode", async ({
    authenticatedPage: page,
  }) => {
    const run = makeResearchWorkflowRun(STAGE);
    await installCommonMocks(page, RUN_ID, run as unknown as Record<string, unknown>, STAGE);

    // Single route handler that dispatches on HTTP method
    await page.route(
      `**/api/workflows/${RUN_ID}/external-research/review`,
      async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              passed: true,
              mode: "advisory",
              warnings: [],
              coverage_score: 1.0,
              reviewed_at: NOW_ISO,
            }),
          });
        } else if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              status: "filed_back",
              final_artifact_id: FINAL_ARTIFACT_ID,
              lineage: [DRAFT_ARTIFACT_ID_1],
              filed_back_at: NOW_ISO,
            }),
          });
        } else {
          await route.continue();
        }
      },
    );

    await goToWorkflowViewer(page, RUN_ID);
    const panel = page.locator('[data-testid="research-stage-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Run the citation review
    const reviewCTA = panel.getByRole("button", { name: /run citation review/i });
    await expect(reviewCTA).toBeVisible({ timeout: 8_000 });
    await reviewCTA.click();

    // Pass banner should appear (advisory mode, no warnings)
    const passBanner = panel.locator('[role="status"]', {
      hasText: /review passed/i,
    });
    await expect(passBanner, "Pass banner should appear after review").toBeVisible({
      timeout: 10_000,
    });

    // File-back button should be enabled (advisory mode always allows file-back)
    const fileBackBtn = panel.getByRole("button", { name: /pass review.*file back/i });
    await expect(fileBackBtn, "Pass Review & File Back button should be visible").toBeVisible({
      timeout: 5_000,
    });
    await expect(fileBackBtn, "File-back should be enabled in advisory mode").toBeEnabled();

    await expect(panel).toHaveScreenshot("review-panel-pass-advisory.png");
  });

  test("strict mode gates file-back CTA when citation warnings exist", async ({
    authenticatedPage: page,
  }) => {
    const run = makeResearchWorkflowRun(STAGE);
    await installCommonMocks(page, RUN_ID, run as unknown as Record<string, unknown>, STAGE);

    // Mock review — strict fail (has warnings)
    await page.route(
      `**/api/workflows/${RUN_ID}/external-research/review`,
      async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            passed: false,
            mode: "strict",
            warnings: [
              {
                message: "Citation missing for claim: StatefulSets guarantee ordering",
                draft_artifact_id: DRAFT_ARTIFACT_ID_1,
              },
            ],
            coverage_score: 0.6,
            reviewed_at: NOW_ISO,
          }),
        });
      },
    );

    await goToWorkflowViewer(page, RUN_ID);
    const panel = page.locator('[data-testid="research-stage-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Enable strict mode by clicking the switch
    const strictToggle = panel.locator('[role="switch"]');
    await expect(strictToggle).toBeVisible({ timeout: 8_000 });
    await strictToggle.click();
    await expect(strictToggle).toHaveAttribute("aria-checked", "true");

    // Run review
    const reviewCTA = panel.getByRole("button", { name: /run citation review/i });
    await expect(reviewCTA).toBeVisible({ timeout: 5_000 });
    await reviewCTA.click();

    // Fail banner should appear
    const failBanner = panel.locator('[role="status"]', {
      hasText: /review failed/i,
    });
    await expect(failBanner, "Fail banner should appear in strict mode").toBeVisible({
      timeout: 10_000,
    });

    // Citation warnings list should render
    const warningsList = panel.locator('[aria-label="Citation warnings"]');
    await expect(warningsList, "Citation warnings list should be visible").toBeVisible({
      timeout: 5_000,
    });

    // File-back button should be DISABLED in strict mode with failures
    const fileBackBtn = panel.getByRole("button", { name: /pass review.*file back/i });
    await expect(fileBackBtn, "File-back button should be visible").toBeVisible({ timeout: 5_000 });
    await expect(
      fileBackBtn,
      "File-back should be disabled in strict mode with warnings",
    ).toBeDisabled();

    // The "blocked" note should explain why
    const blockedNote = panel.locator('[role="note"]');
    await expect(blockedNote, "Blocked note should explain strict mode gate").toBeVisible({
      timeout: 5_000,
    });

    await expect(panel).toHaveScreenshot("review-panel-strict-fail.png");
  });

  test("clicking Pass Review & File Back shows success state with final artifact link", async ({
    authenticatedPage: page,
  }) => {
    const run = makeResearchWorkflowRun(STAGE);
    await installCommonMocks(page, RUN_ID, run as unknown as Record<string, unknown>, STAGE);

    // Single handler dispatches on method: POST=review, PATCH=file-back
    await page.route(
      `**/api/workflows/${RUN_ID}/external-research/review`,
      async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              passed: true,
              mode: "advisory",
              warnings: [],
              coverage_score: 1.0,
              reviewed_at: NOW_ISO,
            }),
          });
        } else if (route.request().method() === "PATCH") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              status: "filed_back",
              final_artifact_id: FINAL_ARTIFACT_ID,
              lineage: [DRAFT_ARTIFACT_ID_1, SYNTH_ARTIFACT_ID],
              filed_back_at: NOW_ISO,
            }),
          });
        } else {
          await route.continue();
        }
      },
    );

    await goToWorkflowViewer(page, RUN_ID);
    const panel = page.locator('[data-testid="research-stage-panel"]');
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // Run review
    await panel.getByRole("button", { name: /run citation review/i }).click();
    // Wait for pass banner
    await expect(
      panel.locator('[role="status"]', { hasText: /review passed/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Click file-back
    const fileBackBtn = panel.getByRole("button", { name: /pass review.*file back/i });
    await expect(fileBackBtn).toBeEnabled({ timeout: 5_000 });
    await fileBackBtn.click();

    // Success state should show "Filed Back Successfully"
    const successStatus = panel.locator('[role="status"]', { hasText: /filed back/i });
    await expect(successStatus, "Filed back success status should appear").toBeVisible({
      timeout: 10_000,
    });

    // Final artifact link should render
    const finalLink = panel.locator(
      `[aria-label="View filed-back artifact ${FINAL_ARTIFACT_ID}"]`,
    );
    await expect(finalLink, "Final artifact link should be visible after file-back").toBeVisible({
      timeout: 8_000,
    });

    await expect(panel).toHaveScreenshot("review-panel-file-back-success.png");
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Non-research workflow regression guard (P4-04 / P4-05)
// ---------------------------------------------------------------------------

test.describe("ResearchStagePanel — Non-research workflow regression (P4-05)", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("non-external_research_v1 workflow does NOT render research-stage-panel", async ({
    authenticatedPage: page,
  }) => {
    const run = makeNonResearchWorkflowRun();
    const STAGE = "synthesize";

    await installCommonMocks(
      page,
      NON_RESEARCH_RUN_ID,
      run as unknown as Record<string, unknown>,
      STAGE,
    );

    await page.goto(`/workflows/${NON_RESEARCH_RUN_ID}`);
    await page.waitForLoadState("domcontentloaded");

    // Wait for the viewer screen to mount
    const viewerScreen = page.locator('[data-testid="workflow-viewer-screen"]');
    await expect(viewerScreen, "Workflow viewer screen should be visible").toBeVisible({
      timeout: 12_000,
    });

    // Click the first stage so we verify the panel is NOT a ResearchStagePanel
    const timeline = page.locator('[aria-label="Workflow stage timeline"]');
    await expect(timeline).toBeVisible({ timeout: 10_000 });
    const firstNode = timeline.locator('[role="button"]').first();
    const nodeCount = await firstNode.count();
    if (nodeCount > 0) await firstNode.click();

    // research-stage-panel must NOT appear for a non-research template
    const researchPanel = page.locator('[data-testid="research-stage-panel"]');
    await expect(
      researchPanel,
      "ResearchStagePanel must NOT render for non-external_research_v1 workflows",
    ).not.toBeAttached({ timeout: 5_000 });
  });
});
