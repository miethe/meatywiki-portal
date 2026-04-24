/**
 * E2E: Screen B — Operator controls (pause / resume / cancel) (P7-05).
 *
 * Acceptance: A-1.6-20 (Screen B operator controls).
 *
 * All API calls are stubbed via page.route() — no live backend required.
 * Backend handlers:
 *   POST /api/workflows/:run_id/pause   — src/meatywiki/portal/api/workflows.py
 *   POST /api/workflows/:run_id/resume  — src/meatywiki/portal/api/workflows.py
 *   POST /api/workflows/:run_id/cancel  — src/meatywiki/portal/api/workflows.py
 *   GET  /api/workflows/runs?limit=1    — used by viewer to derive currentRun
 *
 * Scenarios:
 *   1 (happy) Running run → click Pause → run transitions to paused → Resume button appears.
 *   2 (happy) Paused run → click Resume → run transitions to running → Pause button appears.
 *   3 (happy) Cancel flow: running run → click Cancel → confirm dialog → confirm → state = cancelled.
 *   4 (error)  Pause API 500 → inline error alert shown; Pause button still present.
 */

import { test, expect } from "../support/fixtures";
import { installResearchMocks } from "../support/research-mocks";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUN_ID = "run_operator_test_001";
const TEMPLATE_ID = "research_synthesis_v1";

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

type RunStatus = "running" | "paused" | "cancelled" | "complete" | "queued";

function makeWorkflowRun(status: RunStatus) {
  return {
    id: RUN_ID,
    template_id: TEMPLATE_ID,
    status,
    started_at: "2026-04-24T10:00:00Z",
    ended_at: null,
    artifact_ids: [],
    metadata: {},
  };
}

const TIMELINE_EVENTS = [
  {
    id: "evt_001",
    run_id: RUN_ID,
    stage: "ingest",
    stage_index: 0,
    event_type: "stage_started",
    ts: "2026-04-24T10:00:05Z",
    payload: {},
  },
  {
    id: "evt_002",
    run_id: RUN_ID,
    stage: "classify",
    stage_index: 1,
    event_type: "stage_started",
    ts: "2026-04-24T10:01:00Z",
    payload: {},
  },
];

const AUDIT_LOG_EMPTY = { data: [], cursor: null };

// ---------------------------------------------------------------------------
// Route installer
// ---------------------------------------------------------------------------

/**
 * Install all route stubs needed for the workflow-viewer-screen.
 *
 * @param statusSequence  Array of statuses returned by successive GET /runs
 *   calls.  The first is the initial paint; subsequent entries simulate
 *   poll-after-action refetches.  When exhausted, the last entry repeats.
 * @param actionStatus    HTTP status code to return for pause/resume/cancel (default 200).
 */
async function installViewerMocks(
  page: import("@playwright/test").Page,
  options: {
    statusSequence?: RunStatus[];
    pauseStatus?: number;
    resumeStatus?: number;
    cancelStatus?: number;
  } = {},
) {
  const {
    statusSequence = ["running"],
    pauseStatus = 200,
    resumeStatus = 200,
    cancelStatus = 200,
  } = options;

  // Shared auth / research stubs (these pages don't hit research endpoints,
  // but installResearchMocks sets up the session cookie + auth mock correctly).
  await installResearchMocks(page, { artifactsList: [] });

  // Track how many times /runs has been called so we can advance the sequence
  let runsCallCount = 0;

  // GET /api/workflows/runs — returns the run in the appropriate status
  await page.route("**/api/workflows/runs**", async (route) => {
    const status = statusSequence[Math.min(runsCallCount, statusSequence.length - 1)];
    runsCallCount++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [makeWorkflowRun(status)], cursor: null }),
    });
  });

  // GET /api/workflows/:run_id/timeline
  await page.route(`**/api/workflows/${RUN_ID}/timeline**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: TIMELINE_EVENTS, cursor: null }),
    });
  });

  // GET /api/workflows/:run_id/audit-log
  await page.route(`**/api/workflows/${RUN_ID}/audit-log**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(AUDIT_LOG_EMPTY),
    });
  });

  // GET /api/workflows/runs?template_id= (run history)
  await page.route("**/api/workflows/runs?template_id=**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("template_id")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [makeWorkflowRun(statusSequence[0]!)], cursor: null }),
      });
    } else {
      await route.continue();
    }
  });

  // POST /api/workflows/:run_id/pause
  await page.route(`**/api/workflows/${RUN_ID}/pause`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    if (pauseStatus >= 500) {
      await route.fulfill({
        status: pauseStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: "pause_failed" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ run_id: RUN_ID, action: "pause", acknowledged_at: new Date().toISOString() }),
      });
    }
  });

  // POST /api/workflows/:run_id/resume
  await page.route(`**/api/workflows/${RUN_ID}/resume`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: resumeStatus,
      contentType: "application/json",
      body: JSON.stringify({ run_id: RUN_ID, action: "resume", acknowledged_at: new Date().toISOString() }),
    });
  });

  // POST /api/workflows/:run_id/cancel
  await page.route(`**/api/workflows/${RUN_ID}/cancel`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: cancelStatus,
      contentType: "application/json",
      body: JSON.stringify({ run_id: RUN_ID, action: "cancel", acknowledged_at: new Date().toISOString() }),
    });
  });

  // Catch-all for any other workflow SSE streams
  await page.route("**/api/workflow-events**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });
  await page.route(`**/api/workflows/${RUN_ID}/stream**`, async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Screen B: Operator controls (P7-05 / A-1.6-20)", () => {
  test("running run: Pause → state transitions to paused → Resume button appears", async ({
    authenticatedPage: page,
  }) => {
    // Sequence: initial=running, after-action poll=paused
    await installViewerMocks(page, { statusSequence: ["running", "paused"] });
    await page.goto(`/workflows/${RUN_ID}`);

    // Viewer screen must mount
    await expect(page.getByTestId("workflow-viewer-screen")).toBeVisible({ timeout: 12_000 });

    // Operator actions block must be visible (run is running)
    const actionsBlock = page.getByTestId("operator-actions-block");
    await expect(actionsBlock).toBeVisible({ timeout: 8_000 });

    // Pause button is present; Resume is not
    const pauseBtn = page.getByTestId("operator-pause-button");
    const resumeBtn = page.getByTestId("operator-resume-button");
    await expect(pauseBtn).toBeVisible();
    await expect(resumeBtn).toHaveCount(0);

    // Click Pause
    await pauseBtn.click();

    // After the successful POST + refetch, Resume button must appear
    await expect(resumeBtn).toBeVisible({ timeout: 8_000 });
    // Pause button should now be gone (status=paused → canPause=false)
    await expect(pauseBtn).toHaveCount(0);
  });

  test("paused run: Resume → state transitions to running → Pause button appears", async ({
    authenticatedPage: page,
  }) => {
    // Sequence: initial=paused, after-action poll=running
    await installViewerMocks(page, { statusSequence: ["paused", "running"] });
    await page.goto(`/workflows/${RUN_ID}`);

    await expect(page.getByTestId("workflow-viewer-screen")).toBeVisible({ timeout: 12_000 });

    const actionsBlock = page.getByTestId("operator-actions-block");
    await expect(actionsBlock).toBeVisible({ timeout: 8_000 });

    const resumeBtn = page.getByTestId("operator-resume-button");
    const pauseBtn = page.getByTestId("operator-pause-button");

    // Initially: Resume visible, Pause absent (status=paused)
    await expect(resumeBtn).toBeVisible();
    await expect(pauseBtn).toHaveCount(0);

    // Click Resume
    await resumeBtn.click();

    // After refetch status=running: Pause button appears, Resume gone
    await expect(pauseBtn).toBeVisible({ timeout: 8_000 });
    await expect(resumeBtn).toHaveCount(0);
  });

  test("Cancel flow: confirm dialog → confirm → state = cancelled", async ({
    authenticatedPage: page,
  }) => {
    // Sequence: initial=running, after-cancel=cancelled
    await installViewerMocks(page, { statusSequence: ["running", "cancelled"] });
    await page.goto(`/workflows/${RUN_ID}`);

    await expect(page.getByTestId("workflow-viewer-screen")).toBeVisible({ timeout: 12_000 });
    const actionsBlock = page.getByTestId("operator-actions-block");
    await expect(actionsBlock).toBeVisible({ timeout: 8_000 });

    // Click the Cancel button (opens confirm dialog)
    const cancelBtn = page.getByTestId("operator-cancel-button");
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Confirm dialog (alertdialog) appears
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText(/Cancel Workflow Run/i)).toBeVisible();

    // Click the confirm "Cancel run" button inside the dialog
    await dialog.getByRole("button", { name: /Cancel run/i }).click();

    // After cancel completes: operator block hides entirely (no running/paused state)
    await expect(actionsBlock).not.toBeVisible({ timeout: 8_000 });
  });

  test("Pause API error: inline error shown; Pause button remains", async ({
    authenticatedPage: page,
  }) => {
    await installViewerMocks(page, {
      statusSequence: ["running"],
      pauseStatus: 500,
    });
    await page.goto(`/workflows/${RUN_ID}`);

    await expect(page.getByTestId("workflow-viewer-screen")).toBeVisible({ timeout: 12_000 });
    const actionsBlock = page.getByTestId("operator-actions-block");
    await expect(actionsBlock).toBeVisible({ timeout: 8_000 });

    const pauseBtn = page.getByTestId("operator-pause-button");
    await expect(pauseBtn).toBeVisible();
    await pauseBtn.click();

    // Inline error is shown in the operator block
    const errorMsg = page.getByTestId("operator-error");
    await expect(errorMsg).toBeVisible({ timeout: 8_000 });

    // Pause button is still present (status unchanged — still running)
    await expect(pauseBtn).toBeVisible();
  });
});
