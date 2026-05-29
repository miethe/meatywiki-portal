/**
 * E2E — Inbox & Library Live Workflow Status: bulk compile flow (P2-01)
 *
 * Covers:
 *   - 5 artifacts start compiling concurrently → InboxBatchCompileHeader shows
 *     "0 of 5 compiled" and updates through to "5 of 5 compiled"
 *   - Collapsible toggle expands/collapses the artifact rows
 *   - Batch moves to Processed section after all 5 reach terminal state
 *
 * SSE strategy: each artifact gets its own page.route intercept that returns
 * a complete synthetic SSE stream (all stage events + terminal) in one response
 * body, matching the pattern in compile-success.spec.ts.
 *
 * Budget: <30s (test.setTimeout(30_000)).
 */

import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARTIFACT_IDS = [
  "e2e-bulk-art-1",
  "e2e-bulk-art-2",
  "e2e-bulk-art-3",
  "e2e-bulk-art-4",
  "e2e-bulk-art-5",
] as const;

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Builds a complete SSE body for a single artifact compile stream.
 * All events are delivered in one response body (Playwright limitation).
 */
function buildSseBody(artifactId: string): string {
  const stages = ["classify", "extract", "compile", "file_back", "lint"] as const;
  const lines: string[] = [];
  let idx = 0;
  for (const stage of stages) {
    lines.push(
      `id: ${idx++}`,
      `event: stage_started`,
      `data: {"id":"${artifactId}-evt-${idx}","artifact_id":"${artifactId}","run_id":null,"workflow":"compile","stage":"${stage}","status":"started","created_at":"2026-05-20T10:00:0${idx}.000Z","payload":{}}`,
      ``,
      `id: ${idx++}`,
      `event: stage_completed`,
      `data: {"id":"${artifactId}-evt-${idx}","artifact_id":"${artifactId}","run_id":null,"workflow":"compile","stage":"${stage}","status":"completed","created_at":"2026-05-20T10:00:0${idx}.500Z","payload":{"duration_ms":${100 + idx * 10}}}`,
      ``,
    );
  }
  // Terminal success event
  lines.push(
    `id: ${idx}`,
    `event: workflow_stage_event`,
    `data: {"id":"${artifactId}-evt-terminal","artifact_id":"${artifactId}","run_id":null,"workflow":"compile","stage":"terminal","status":"completed","created_at":"2026-05-20T10:00:20.000Z","payload":{}}`,
    ``,
  );
  return lines.join("\n");
}

/** Wire SSE intercepts for all 5 artifact compile-events endpoints. */
async function mockAllCompileEventsSSE(page: Page): Promise<void> {
  for (const artifactId of ARTIFACT_IDS) {
    await page.route(
      `**/api/artifacts/${artifactId}/compile/events**`,
      async (route) => {
        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          body: buildSseBody(artifactId),
        });
      },
    );
  }
}

/** Wire compile POST intercepts for all 5 artifacts → 202 Accepted. */
async function mockAllCompilePosts(page: Page): Promise<void> {
  for (const artifactId of ARTIFACT_IDS) {
    await page.route(
      `**/api/artifacts/${artifactId}/compile`,
      async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 202,
            contentType: "application/json",
            // Real 202 contract returns { workflow_run_id } only — no job_id
            // exists anywhere in the compile pipeline (DI-080 groups client-side).
            body: JSON.stringify({
              workflow_run_id: `01MOCKRUN${artifactId}`,
            }),
          });
        } else {
          await route.continue();
        }
      },
    );
  }
}

/** Inject 5 test artifacts into the inbox list. All are in needs_compile group. */
async function mockInboxList(page: Page): Promise<void> {
  await page.route("**/api/artifacts?**", async (route) => {
    const url = route.request().url();
    if (!url.includes("include_processed")) {
      await route.continue();
      return;
    }

    const items = ARTIFACT_IDS.map((id, i) => ({
      id,
      title: `E2E Bulk Compile Artifact ${i + 1}`,
      status: "needs_compile",
      intervention_category: "needs_compile",
      workflow_stage: null,
      compile_status: null,
      created_at: new Date(Date.now() - 60_000).toISOString(),
      updated_at: new Date(Date.now() - 60_000).toISOString(),
    }));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items,
        pending: [],
        processed: [],
        cursor: null,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Bulk compile batch flow", () => {
  test.setTimeout(30_000);

  test(
    "batch header shows '0 of 5 compiled' when all 5 compile POSTs are sent",
    async ({ authenticatedPage: page }) => {
      await mockInboxList(page);
      await mockAllCompilePosts(page);
      await mockAllCompileEventsSSE(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      // Click compile on all 5 artifacts in rapid succession
      for (const artifactId of ARTIFACT_IDS) {
        const row = page.locator(`[data-artifact-id="${artifactId}"]`);
        await expect(row).toBeVisible({ timeout: 8_000 });
        const btn = row.getByRole("button", { name: /compile/i });
        await expect(btn).toBeEnabled({ timeout: 5_000 });
        await btn.click();
      }

      // Batch header should appear — showing 0 of 5 initially
      const batchHeader = page.locator("[data-testid='batch-compile-header']");
      await expect(batchHeader).toBeVisible({ timeout: 8_000 });

      const statusLabel = batchHeader.locator("[data-testid='batch-status-label']");
      await expect(statusLabel).toContainText(/0 of 5 compiled/i, {
        timeout: 5_000,
      });
    },
  );

  test(
    "batch header updates to '5 of 5 compiled' after all SSE streams terminate",
    async ({ authenticatedPage: page }) => {
      await mockInboxList(page);
      await mockAllCompilePosts(page);
      await mockAllCompileEventsSSE(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      // Click compile on all 5 artifacts
      for (const artifactId of ARTIFACT_IDS) {
        const row = page.locator(`[data-artifact-id="${artifactId}"]`);
        await expect(row).toBeVisible({ timeout: 8_000 });
        const btn = row.getByRole("button", { name: /compile/i });
        await btn.click();
      }

      // Wait for all terminals — batch header should reach "5 of 5 compiled"
      const batchHeader = page.locator("[data-testid='batch-compile-header']");
      await expect(batchHeader).toBeVisible({ timeout: 8_000 });

      const statusLabel = batchHeader.locator("[data-testid='batch-status-label']");
      await expect(statusLabel).toContainText(/5 of 5 compiled/i, {
        timeout: 20_000,
      });
    },
  );

  test(
    "collapsible toggle hides and reveals artifact rows",
    async ({ authenticatedPage: page }) => {
      await mockInboxList(page);
      await mockAllCompilePosts(page);
      await mockAllCompileEventsSSE(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      // Trigger batch
      for (const artifactId of ARTIFACT_IDS) {
        const row = page.locator(`[data-artifact-id="${artifactId}"]`);
        await expect(row).toBeVisible({ timeout: 8_000 });
        await row.getByRole("button", { name: /compile/i }).click();
      }

      const batchHeader = page.locator("[data-testid='batch-compile-header']");
      await expect(batchHeader).toBeVisible({ timeout: 8_000 });

      // Initially expanded — first artifact should be visible
      const firstRow = page.locator(
        `[data-artifact-id="${ARTIFACT_IDS[0]}"]`,
      );
      await expect(firstRow).toBeVisible({ timeout: 5_000 });

      // Collapse via the toggle button
      const toggleBtn = batchHeader.getByRole("button", {
        name: /collapse|expand/i,
      });
      await expect(toggleBtn).toBeVisible();
      await toggleBtn.click();

      // Children should be hidden
      await expect(firstRow).not.toBeVisible({ timeout: 3_000 });

      // Expand again
      await toggleBtn.click();
      await expect(firstRow).toBeVisible({ timeout: 3_000 });
    },
  );

  test(
    "batch moves to Processed section after all artifacts are terminal",
    async ({ authenticatedPage: page }) => {
      await mockInboxList(page);
      await mockAllCompilePosts(page);
      await mockAllCompileEventsSSE(page);

      // Also mock the processed endpoint refresh
      await page.route("**/api/artifacts?*include_processed=true*", async (route) => {
        // After terminal events, return items as processed
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [],
            processed: ARTIFACT_IDS.map((id, i) => ({
              id,
              title: `E2E Bulk Compile Artifact ${i + 1}`,
              workspace: "wiki",
              type: "concept",
              status: "compiled",
              created_at: new Date(Date.now() - 60_000).toISOString(),
              compiled_at: new Date().toISOString(),
              file_path: `/wiki/${id}.md`,
            })),
            cursor: null,
          }),
        });
      });

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      // Click compile on all 5 artifacts
      for (const artifactId of ARTIFACT_IDS) {
        const row = page.locator(`[data-artifact-id="${artifactId}"]`);
        await expect(row).toBeVisible({ timeout: 8_000 });
        await row.getByRole("button", { name: /compile/i }).click();
      }

      // Wait for Processed section to appear (after terminal events + onDone timers)
      const processedSection = page.locator("[data-testid='processed-section']");
      await expect(processedSection).toBeVisible({ timeout: 20_000 });
    },
  );
});
