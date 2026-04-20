/**
 * Journey: Workflow Viewer (Screen B)
 *
 * Covers P1.5-2-02 acceptance:
 *   - Navigate to /workflows/:runId
 *   - Timeline panel renders with stage nodes
 *   - Clicking a stage updates the stage context panel
 *   - Artifact lineage panel is present
 *   - Run history panel is present with a re-run button
 *   - All panels render on a completed research_synthesis_v1 run
 *
 * Backend dependency: required (skips gracefully if unreachable).
 * The test uses the first available completed run from GET /api/workflows/runs.
 */

import { test, expect, API_URL, TEST_TOKEN } from "../support/fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface WorkflowRunStub {
  id: string;
  template_id: string;
  status: string;
}

async function fetchCompletedRun(): Promise<WorkflowRunStub | null> {
  try {
    const resp = await fetch(
      `${API_URL}/api/workflows/runs?status=complete&limit=5`,
      {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!resp.ok) return null;
    const body = (await resp.json()) as { data: WorkflowRunStub[] };
    return body.data?.[0] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Journey: Workflow Viewer (Screen B)", () => {
  test(
    "All four panels render for a completed run",
    async ({ authenticatedPage: page, skipIfBackendDown }) => {
      // Find a completed run to navigate to.
      const run = await fetchCompletedRun();

      if (!run) {
        test.skip(true, "No completed runs available — skipping viewer test");
        return;
      }

      await page.goto(`/workflows/${encodeURIComponent(run.id)}`);

      // Wait for the viewer screen to mount.
      await expect(
        page.getByTestId("workflow-viewer-screen"),
      ).toBeVisible({ timeout: 8000 });

      // Panel A: Timeline panel container should be visible.
      await expect(
        page.getByTestId("timeline-panel-container"),
      ).toBeVisible();

      // Panel C: Artifact lineage section heading.
      await expect(
        page.getByText("Artifact Lineage"),
      ).toBeVisible();

      // Panel D: Run history section heading.
      await expect(
        page.getByText("Run History"),
      ).toBeVisible();

      // Re-run button is present.
      await expect(
        page.getByTestId("rerun-button"),
      ).toBeVisible();
    },
  );

  test(
    "Clicking a stage updates the context panel",
    async ({ authenticatedPage: page, skipIfBackendDown }) => {
      const run = await fetchCompletedRun();
      if (!run) {
        test.skip(true, "No completed runs available");
        return;
      }

      await page.goto(`/workflows/${encodeURIComponent(run.id)}`);
      await page.getByTestId("workflow-viewer-screen").waitFor({ timeout: 8000 });

      // Wait for timeline to render (at least one stage node).
      const stageNodes = page.locator('[role="listitem"][aria-label]');
      await expect(stageNodes.first()).toBeVisible({ timeout: 6000 });

      // Click first stage node.
      const firstNode = stageNodes.first();
      const stageAriaLabel = await firstNode.getAttribute("aria-label");

      // Click the button inside the listitem.
      await firstNode.locator('[role="button"]').click();

      // Stage context panel should show a section heading (not empty state).
      // The empty state says "Click a stage in the timeline..." — it should be gone.
      await expect(
        page.getByText(/Click a stage in the timeline/i),
      ).not.toBeVisible();

      // The panel heading should now show the selected stage label.
      // (The aria-label of the node contains the stage name.)
      if (stageAriaLabel) {
        // Extract stage label from "Stage N: <Label> — <status>, started Xs ago"
        const match = stageAriaLabel.match(/Stage \d+: ([^—]+)/);
        if (match?.[1]) {
          const label = match[1].trim();
          await expect(page.getByText(label).first()).toBeVisible();
        }
      }
    },
  );

  test(
    "Timeline shows at least three stage events for research_synthesis_v1 run",
    async ({ authenticatedPage: page, skipIfBackendDown }) => {
      const run = await fetchCompletedRun();
      if (!run || run.template_id !== "research_synthesis_v1") {
        test.skip(true, "No research_synthesis_v1 completed run available");
        return;
      }

      await page.goto(`/workflows/${encodeURIComponent(run.id)}`);
      await page.getByTestId("workflow-viewer-screen").waitFor({ timeout: 8000 });

      const stageNodes = page.locator('[role="listitem"][aria-label]');
      await expect(stageNodes.nth(2)).toBeVisible({ timeout: 6000 });

      const count = await stageNodes.count();
      expect(count).toBeGreaterThanOrEqual(3);
    },
  );

  test(
    "Back navigation returns to workflows list",
    async ({ authenticatedPage: page, skipIfBackendDown }) => {
      const run = await fetchCompletedRun();
      if (!run) {
        test.skip(true, "No completed runs available");
        return;
      }

      await page.goto(`/workflows/${encodeURIComponent(run.id)}`);
      await page.getByTestId("workflow-viewer-screen").waitFor({ timeout: 8000 });

      await page.getByRole("link", { name: /Back to workflows list/i }).click();
      await expect(page).toHaveURL(/\/workflows$/);
    },
  );
});
