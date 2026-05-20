/**
 * E2E — Inbox & Library Live Workflow Status: compile success flow
 *
 * Covers (P5-01):
 *   - POST /api/artifacts/{id}/compile → button disables
 *   - Stage labels appear in order (classify → extract → compile → file_back → lint)
 *     via the CompileStageIndicator driven by useCompileEvents SSE hook
 *   - Terminal success event → status indicator shows "Compiled"
 *   - Row moves from Pending to Processed section
 *   - Navigate to /library → LibraryCardStatusBadge shows "Compiled <ago>"
 *
 * Backend dependency: required (skips gracefully via skipIfBackendDown fixture).
 *
 * SSE strategy: the spec intercepts the SSE endpoint and streams synthetic
 * stage events so the test runs without a live compile worker.
 */

import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helper — inject a minimal SSE stream via route interception
// ---------------------------------------------------------------------------

const ARTIFACT_ID = "e2e-test-artifact-success";

/**
 * Registers a route intercept for the compile-events SSE endpoint.
 * Streams stage events with short delays then closes the stream.
 */
async function mockCompileEventsSSE(page: Page): Promise<void> {
  await page.route(
    `**/api/artifacts/${ARTIFACT_ID}/compile/events`,
    async (route) => {
      const stages = [
        "classify",
        "extract",
        "compile",
        "file_back",
        "lint",
      ] as const;

      // Build the full SSE body upfront (Playwright route fulfil doesn't
      // support streaming chunks, so we send all events in one response).
      const lines: string[] = [];
      let idx = 0;
      for (const stage of stages) {
        lines.push(
          `id: ${idx++}`,
          `event: stage_started`,
          `data: {"stage":"${stage}","artifact_id":"${ARTIFACT_ID}","ts":"2026-05-20T10:00:0${idx}.000Z"}`,
          ``,
          `id: ${idx++}`,
          `event: stage_completed`,
          `data: {"stage":"${stage}","artifact_id":"${ARTIFACT_ID}","duration_ms":${120 + idx * 10},"ts":"2026-05-20T10:00:0${idx}.500Z"}`,
          ``,
        );
      }
      // Terminal success event
      lines.push(
        `id: ${idx}`,
        `event: compile_terminal`,
        `data: {"artifact_id":"${ARTIFACT_ID}","outcome":"success","ts":"2026-05-20T10:00:10.000Z"}`,
        ``,
      );

      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: lines.join("\n"),
      });
    },
  );
}

/**
 * Intercepts the compile POST to return a 202 Accepted without hitting the
 * backend worker; the SSE mock above drives state instead.
 */
async function mockCompilePost(page: Page): Promise<void> {
  await page.route(
    `**/api/artifacts/${ARTIFACT_ID}/compile`,
    async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 202,
          contentType: "application/json",
          body: JSON.stringify({
            artifact_id: ARTIFACT_ID,
            job_id: "mock-job-001",
            status: "queued",
          }),
        });
      } else {
        await route.continue();
      }
    },
  );
}

/**
 * Intercepts the inbox list endpoint to inject our test artifact into the
 * Pending group so the spec isn't blocked on real backend data.
 */
async function mockInboxList(page: Page): Promise<void> {
  await page.route("**/api/artifacts?**", async (route) => {
    const url = route.request().url();
    // Only intercept the inbox list call (not individual artifact fetches)
    if (!url.includes("include_processed")) {
      await route.continue();
      return;
    }

    const pendingArtifact = {
      id: ARTIFACT_ID,
      title: "E2E Test Artifact — Compile Success",
      status: "pending",
      workflow_stage: null,
      compile_status: null,
      created_at: "2026-05-20T09:00:00.000Z",
      updated_at: "2026-05-20T09:00:00.000Z",
    };

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pending: [pendingArtifact],
        processed: [],
        cursor: null,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Compile success flow", () => {
  test.describe.configure({ mode: "serial" });

  test(
    "compile button disables while SSE events stream",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockInboxList(page);
      await mockCompilePost(page);
      await mockCompileEventsSSE(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      // Locate the compile button for our test artifact
      const artifactRow = page.locator(`[data-artifact-id="${ARTIFACT_ID}"]`);
      await expect(artifactRow).toBeVisible({ timeout: 10_000 });

      const compileBtn = artifactRow.getByRole("button", {
        name: /compile/i,
      });
      await expect(compileBtn).toBeEnabled();

      // Trigger compile
      await compileBtn.click();

      // Button should disable while events stream
      await expect(compileBtn).toBeDisabled({ timeout: 5_000 });
    },
  );

  test(
    "stage labels appear in order as SSE events arrive",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockInboxList(page);
      await mockCompilePost(page);
      await mockCompileEventsSSE(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      const artifactRow = page.locator(`[data-artifact-id="${ARTIFACT_ID}"]`);
      await expect(artifactRow).toBeVisible({ timeout: 10_000 });
      await artifactRow.getByRole("button", { name: /compile/i }).click();

      // CompileStageIndicator should show each stage in sequence
      const stageIndicator = artifactRow.locator(
        "[data-testid='compile-stage-indicator']",
      );
      await expect(stageIndicator).toBeVisible({ timeout: 5_000 });

      const expectedStages = [
        "classify",
        "extract",
        "compile",
        "file_back",
        "lint",
      ];
      for (const stage of expectedStages) {
        await expect(
          stageIndicator.locator(`[data-stage="${stage}"]`),
        ).toBeVisible({ timeout: 8_000 });
      }
    },
  );

  test(
    "terminal success → row moves to Processed section",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockInboxList(page);
      await mockCompilePost(page);
      await mockCompileEventsSSE(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      const artifactRow = page.locator(`[data-artifact-id="${ARTIFACT_ID}"]`);
      await expect(artifactRow).toBeVisible({ timeout: 10_000 });
      await artifactRow.getByRole("button", { name: /compile/i }).click();

      // After terminal event the row should appear in the Processed section
      const processedSection = page.locator(
        "[data-testid='processed-section']",
      );
      await expect(processedSection).toBeVisible({ timeout: 10_000 });
      await expect(
        processedSection.locator(`[data-artifact-id="${ARTIFACT_ID}"]`),
      ).toBeVisible({ timeout: 10_000 });

      // The original pending group should no longer contain the artifact
      const pendingGroup = page.locator("[data-testid='pending-group']");
      await expect(
        pendingGroup.locator(`[data-artifact-id="${ARTIFACT_ID}"]`),
      ).not.toBeVisible();
    },
  );

  test(
    "Library card shows 'Compiled' badge after successful compile",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      // Mock library endpoint to return the compiled artifact
      await page.route("**/api/library**", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: ARTIFACT_ID,
                title: "E2E Test Artifact — Compile Success",
                compile_status: "success",
                last_compiled_at: new Date(
                  Date.now() - 60_000,
                ).toISOString(),
              },
            ],
            cursor: null,
          }),
        });
      });

      await page.goto("/library");
      await expect(
        page.getByRole("heading", { name: "Library" }),
      ).toBeVisible({ timeout: 10_000 });

      const libraryCard = page.locator(
        `[data-testid='library-card'][data-artifact-id="${ARTIFACT_ID}"]`,
      );
      await expect(libraryCard).toBeVisible({ timeout: 10_000 });

      // Badge should say "Compiled" with relative time
      const badge = libraryCard.locator("[data-testid='library-card-status-badge']");
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/compiled/i);
      // Relative-time suffix — any "ago" pattern is acceptable
      await expect(badge).toContainText(/ago|just now/i);
    },
  );
});
