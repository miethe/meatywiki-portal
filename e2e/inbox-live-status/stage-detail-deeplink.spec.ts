/**
 * E2E — Inbox & Library Live Workflow Status: stage-detail deep-link flow
 *
 * Covers (P3-04):
 *   - ActivityHistoryTooltip "Related Artifacts" section renders mocked upstream
 *     and downstream relations from GET /api/artifacts/{id}/relationships
 *   - Clicking a stage row (aria-label "View {stage} stage event log") navigates
 *     to /artifact/{id}/compile/stages/{stage}
 *   - StageDetailClient renders: breadcrumb nav, event log entries, token counts
 *     (numeric values shown when present; "— Not available" when absent)
 *   - Back button (aria-label "Back to artifact detail") returns to the artifact
 *     detail URL
 *
 * SSE strategy: page.route intercepts are used for the compile-events SSE
 * endpoint and for the relationships REST endpoint. The SSE body is sent as a
 * single response (Playwright limitation) with synthetic stage events that
 * include token-count fields on the "extract" stage so the detail page can
 * exercise both the present and absent token-count branches.
 *
 * Backend dependency: required (skips gracefully via skipIfBackendDown fixture).
 *
 * Budget: whole flow must assert completion < 10 s (test.setTimeout(10_000)).
 */

import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARTIFACT_ID = "e2e-test-artifact-deeplink";

// Full WorkflowStageEventDTO shape expected by StageDetailClient / useCompileEvents.
// token-count fields are present on "extract" only — so the detail page exercises
// both the "show numeric value" and "— Not available" branches in a single run.
const STAGES = ["classify", "extract", "compile", "file_back", "lint"] as const;

// Token values injected into the "extract" stage_completed event.
const EXTRACT_TOKENS = { tokens_input: 1_200, tokens_output: 480, tokens_total: 1_680 };

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Builds the full SSE response body for the compile-events stream.
 *
 * Each stage gets a stage_started + stage_completed pair. The "extract"
 * stage_completed event includes token-count fields. A terminal success
 * event closes the stream.
 */
function buildSseBody(artifactId: string): string {
  const lines: string[] = [];
  let idx = 0;

  for (const stage of STAGES) {
    // stage_started
    lines.push(
      `id: ${idx}`,
      `event: workflow_stage_event`,
      `data: ${JSON.stringify({
        id: `${artifactId}-evt-${idx}`,
        artifact_id: artifactId,
        run_id: null,
        workflow: "compile",
        stage,
        status: "started",
        created_at: `2026-05-20T10:00:0${idx}.000Z`,
        payload: {},
      })}`,
      ``,
    );
    idx++;

    // stage_completed — include token counts for "extract" only
    const payload: Record<string, unknown> =
      stage === "extract"
        ? { duration_ms: 2_400, ...EXTRACT_TOKENS }
        : { duration_ms: 150 + idx * 10 };

    lines.push(
      `id: ${idx}`,
      `event: workflow_stage_event`,
      `data: ${JSON.stringify({
        id: `${artifactId}-evt-${idx}`,
        artifact_id: artifactId,
        run_id: null,
        workflow: "compile",
        stage,
        status: "completed",
        created_at: `2026-05-20T10:00:0${idx}.500Z`,
        payload,
      })}`,
      ``,
    );
    idx++;
  }

  // Terminal success
  lines.push(
    `id: ${idx}`,
    `event: workflow_stage_event`,
    `data: ${JSON.stringify({
      id: `${artifactId}-evt-terminal`,
      artifact_id: artifactId,
      run_id: null,
      workflow: "compile",
      stage: "terminal",
      status: "completed",
      created_at: "2026-05-20T10:01:00.000Z",
      payload: {},
    })}`,
    ``,
  );

  return lines.join("\n");
}

/**
 * Registers the SSE compile-events route intercept.
 * Returns a complete stream in a single response body.
 */
async function mockCompileEventsSSE(page: Page): Promise<void> {
  await page.route(
    `**/api/artifacts/${ARTIFACT_ID}/compile/events`,
    async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: buildSseBody(ARTIFACT_ID),
      });
    },
  );
}

/**
 * Mocks GET /api/artifacts/{id}/relationships with sample upstream and
 * downstream relations.
 */
async function mockRelationships(page: Page): Promise<void> {
  await page.route(
    `**/api/artifacts/${ARTIFACT_ID}/relationships`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          artifact_id: ARTIFACT_ID,
          upstream: [
            {
              artifact_id: "upstream-art-001",
              title: "Source Note Alpha",
              artifact_type: "note",
              relationship: "derived_from",
            },
          ],
          downstream: [
            {
              artifact_id: "downstream-art-001",
              title: "Child Concept Beta",
              artifact_type: "concept",
              relationship: "synthesized_into",
            },
          ],
        }),
      });
    },
  );
}

/**
 * Mocks GET /api/artifacts/{id}/activity so the ActivityHistoryTooltip
 * has stage rows to display (required for the tooltip to show clickable rows).
 */
async function mockActivity(page: Page): Promise<void> {
  await page.route(
    `**/api/artifacts/${ARTIFACT_ID}/activity`,
    async (route) => {
      const stages: Array<{
        stage: string;
        status: string;
        started_at: string;
        completed_at: string;
        duration_ms: number;
      }> = STAGES.map((stage, i) => ({
        stage,
        status: "completed",
        started_at: `2026-05-20T10:00:0${i * 2}.000Z`,
        completed_at: `2026-05-20T10:00:0${i * 2 + 1}.000Z`,
        duration_ms: 1_000,
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          artifact_id: ARTIFACT_ID,
          stages,
          outcome: "success",
          last_compiled_at: "2026-05-20T10:01:00.000Z",
        }),
      });
    },
  );
}

/**
 * Mocks the library list endpoint to inject one compiled artifact so the
 * Library page renders a card with a status badge we can interact with.
 */
async function mockLibraryList(page: Page): Promise<void> {
  await page.route("**/api/library**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: ARTIFACT_ID,
            title: "E2E Test Artifact — Stage Deep-link",
            compile_status: "success",
            last_compiled_at: "2026-05-20T10:01:00.000Z",
          },
        ],
        cursor: null,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Stage-detail deep-link flow", () => {
  test.setTimeout(10_000);

  test(
    "Related Artifacts section renders mocked upstream and downstream relations",
    async ({ authenticatedPage: page }) => {
      await mockLibraryList(page);
      await mockActivity(page);
      await mockRelationships(page);
      await mockCompileEventsSSE(page);

      await page.goto("/library");
      await expect(
        page.getByRole("heading", { name: "Library" }),
      ).toBeVisible({ timeout: 8_000 });

      // Open the ActivityHistoryTooltip popover via the status badge
      const libraryCard = page.locator(
        `[data-testid='library-card'][data-artifact-id="${ARTIFACT_ID}"]`,
      );
      await expect(libraryCard).toBeVisible({ timeout: 8_000 });

      const badge = libraryCard.locator(
        "[data-testid='library-card-status-badge']",
      );
      await badge.click();

      const tooltip = page.locator("[data-testid='activity-history-tooltip']");
      await expect(tooltip).toBeVisible({ timeout: 5_000 });

      // "Related Artifacts" section heading
      await expect(tooltip.getByText(/related artifacts/i)).toBeVisible();

      // Upstream chip: "Source Note Alpha"
      await expect(tooltip.getByText(/Source Note Alpha/)).toBeVisible();

      // Downstream chip: "Child Concept Beta"
      await expect(tooltip.getByText(/Child Concept Beta/)).toBeVisible();
    },
  );

  test(
    "clicking extract stage row navigates to /artifact/{id}/compile/stages/extract",
    async ({ authenticatedPage: page }) => {
      await mockLibraryList(page);
      await mockActivity(page);
      await mockRelationships(page);
      await mockCompileEventsSSE(page);

      await page.goto("/library");
      await expect(
        page.getByRole("heading", { name: "Library" }),
      ).toBeVisible({ timeout: 8_000 });

      // Open tooltip
      const badge = page
        .locator(
          `[data-testid='library-card'][data-artifact-id="${ARTIFACT_ID}"]`,
        )
        .locator("[data-testid='library-card-status-badge']");
      await badge.click();

      const tooltip = page.locator("[data-testid='activity-history-tooltip']");
      await expect(tooltip).toBeVisible({ timeout: 5_000 });

      // Click the "extract" stage row by its aria-label
      const extractRow = tooltip.getByRole("button", {
        name: /view extract stage event log/i,
      });
      await expect(extractRow).toBeVisible({ timeout: 3_000 });
      await extractRow.click();

      // URL must contain the stage-detail path
      await expect(page).toHaveURL(
        new RegExp(`/artifact/${ARTIFACT_ID}/compile/stages/extract`),
        { timeout: 5_000 },
      );
    },
  );

  test(
    "stage-detail page renders breadcrumb, event log, and token counts",
    async ({ authenticatedPage: page }) => {
      await mockCompileEventsSSE(page);
      await mockRelationships(page);

      // Navigate directly to the extract stage-detail page
      await page.goto(
        `/artifact/${ARTIFACT_ID}/compile/stages/extract`,
      );

      // Breadcrumb nav must be present
      const breadcrumb = page.locator("nav[aria-label='Breadcrumb'], nav");
      await expect(breadcrumb.first()).toBeVisible({ timeout: 8_000 });

      // Heading: "Extract stage" (humanized stage name)
      await expect(
        page.getByRole("heading", { name: /extract stage/i }),
      ).toBeVisible({ timeout: 5_000 });

      // Event log: the aria-label is "Extract stage event log"
      const eventLog = page.getByRole("list", {
        name: /extract stage event log/i,
      });
      await expect(eventLog).toBeVisible({ timeout: 5_000 });

      // At least one event row should exist (started + completed = 2 events)
      await expect(eventLog.locator("li").first()).toBeVisible({
        timeout: 5_000,
      });

      // Token counts for "extract" stage — numeric values should appear
      await expect(
        page.getByText(EXTRACT_TOKENS.tokens_input.toLocaleString()),
      ).toBeVisible({ timeout: 5_000 });
      await expect(
        page.getByText(EXTRACT_TOKENS.tokens_output.toLocaleString()),
      ).toBeVisible({ timeout: 5_000 });
    },
  );

  test(
    "stage-detail page shows '— Not available' for stages without token payload",
    async ({ authenticatedPage: page }) => {
      await mockCompileEventsSSE(page);
      await mockRelationships(page);

      // Navigate to "classify" stage — no token fields in mock payload
      await page.goto(
        `/artifact/${ARTIFACT_ID}/compile/stages/classify`,
      );

      await expect(
        page.getByRole("heading", { name: /classify stage/i }),
      ).toBeVisible({ timeout: 8_000 });

      // At least one "— Not available" string should appear (tokens absent)
      await expect(page.getByText("— Not available").first()).toBeVisible({
        timeout: 5_000,
      });
    },
  );

  test(
    "back button returns to artifact detail URL",
    async ({ authenticatedPage: page }) => {
      await mockCompileEventsSSE(page);
      await mockRelationships(page);

      // Navigate to the stage-detail page directly so history has an entry
      // First push the artifact detail page into history, then the stage page
      await page.goto(`/artifact/${ARTIFACT_ID}`);
      await page.goto(
        `/artifact/${ARTIFACT_ID}/compile/stages/extract`,
      );

      await expect(
        page.getByRole("heading", { name: /extract stage/i }),
      ).toBeVisible({ timeout: 8_000 });

      // Click the back button
      const backBtn = page.getByRole("button", {
        name: /back to artifact detail/i,
      });
      await expect(backBtn).toBeVisible({ timeout: 3_000 });
      await backBtn.click();

      // Should navigate back to the artifact detail URL
      await expect(page).toHaveURL(
        new RegExp(`/artifact/${ARTIFACT_ID}(?!.*stages)`),
        { timeout: 5_000 },
      );
    },
  );
});
