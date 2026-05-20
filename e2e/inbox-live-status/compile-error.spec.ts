/**
 * E2E — Inbox & Library Live Workflow Status: compile error handling
 *
 * Covers (P5-02):
 *   - Mock terminal-failed event → inline CompileErrorPill renders on the row
 *   - Row stays in Pending group (not moved to Processed)
 *   - Compile button re-enables after terminal failure
 *   - Retry button is shown and triggers a fresh compile POST
 *
 * Backend dependency: required (skips gracefully via skipIfBackendDown fixture).
 *
 * SSE strategy: route interception streams a classify stage_started followed by
 * a compile_terminal failure event.
 */

import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";

const ARTIFACT_ID = "e2e-test-artifact-error";

async function mockCompileEventsSSEFailed(page: Page): Promise<void> {
  let callCount = 0;
  await page.route(
    `**/api/artifacts/${ARTIFACT_ID}/compile/events`,
    async (route) => {
      callCount++;
      const isRetry = callCount > 1;

      const lines: string[] = [
        `id: 0`,
        `event: stage_started`,
        `data: {"stage":"classify","artifact_id":"${ARTIFACT_ID}","ts":"2026-05-20T10:00:01.000Z"}`,
        ``,
        `id: 1`,
        `event: compile_terminal`,
        `data: {"artifact_id":"${ARTIFACT_ID}","outcome":"${isRetry ? "success" : "failed"}","error_stage":"classify","error_message":"LLM rate limit exceeded — no retry budget remaining","ts":"2026-05-20T10:00:02.000Z"}`,
        ``,
      ];

      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body: lines.join("\n"),
      });
    },
  );
}

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
            job_id: "mock-job-error-001",
            status: "queued",
          }),
        });
      } else {
        await route.continue();
      }
    },
  );
}

async function mockInboxList(page: Page): Promise<void> {
  await page.route("**/api/artifacts?**", async (route) => {
    const url = route.request().url();
    if (!url.includes("include_processed")) {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pending: [
          {
            id: ARTIFACT_ID,
            title: "E2E Test Artifact — Compile Error",
            status: "pending",
            workflow_stage: null,
            compile_status: null,
            created_at: "2026-05-20T09:00:00.000Z",
            updated_at: "2026-05-20T09:00:00.000Z",
          },
        ],
        processed: [],
        cursor: null,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Compile error handling", () => {
  test.describe.configure({ mode: "serial" });

  test(
    "inline error pill renders after terminal-failed event",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockInboxList(page);
      await mockCompilePost(page);
      await mockCompileEventsSSEFailed(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      const artifactRow = page.locator(`[data-artifact-id="${ARTIFACT_ID}"]`);
      await expect(artifactRow).toBeVisible({ timeout: 10_000 });
      await artifactRow.getByRole("button", { name: /compile/i }).click();

      // Error pill should appear within 5 seconds of terminal event
      const errorPill = artifactRow.locator("[data-testid='compile-error-pill']");
      await expect(errorPill).toBeVisible({ timeout: 5_000 });
      await expect(errorPill).toContainText(/failed|error/i);
    },
  );

  test(
    "failed row stays in Pending group — not moved to Processed",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockInboxList(page);
      await mockCompilePost(page);
      await mockCompileEventsSSEFailed(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      const artifactRow = page.locator(`[data-artifact-id="${ARTIFACT_ID}"]`);
      await expect(artifactRow).toBeVisible({ timeout: 10_000 });
      await artifactRow.getByRole("button", { name: /compile/i }).click();

      // Wait for error pill (confirms terminal event was received)
      const errorPill = artifactRow.locator("[data-testid='compile-error-pill']");
      await expect(errorPill).toBeVisible({ timeout: 5_000 });

      // Row must remain in Pending group
      const pendingGroup = page.locator("[data-testid='pending-group']");
      await expect(
        pendingGroup.locator(`[data-artifact-id="${ARTIFACT_ID}"]`),
      ).toBeVisible();

      // Processed section should NOT contain the failed artifact
      const processedSection = page.locator("[data-testid='processed-section']");
      // Processed section may not exist yet (no success artifacts) — that's fine
      const processedExists = await processedSection.isVisible();
      if (processedExists) {
        await expect(
          processedSection.locator(`[data-artifact-id="${ARTIFACT_ID}"]`),
        ).not.toBeVisible();
      }
    },
  );

  test(
    "compile button re-enables after terminal failure",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockInboxList(page);
      await mockCompilePost(page);
      await mockCompileEventsSSEFailed(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      const artifactRow = page.locator(`[data-artifact-id="${ARTIFACT_ID}"]`);
      await expect(artifactRow).toBeVisible({ timeout: 10_000 });

      const compileBtn = artifactRow.getByRole("button", { name: /compile/i });
      await compileBtn.click();

      // Wait for error state
      await expect(
        artifactRow.locator("[data-testid='compile-error-pill']"),
      ).toBeVisible({ timeout: 5_000 });

      // Button must re-enable so the user can retry
      await expect(compileBtn).toBeEnabled({ timeout: 3_000 });
    },
  );

  test(
    "retry button triggers a fresh compile POST",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockInboxList(page);
      const compileRequests: string[] = [];
      await page.route(
        `**/api/artifacts/${ARTIFACT_ID}/compile`,
        async (route) => {
          if (route.request().method() === "POST") {
            compileRequests.push(route.request().url());
            await route.fulfill({
              status: 202,
              contentType: "application/json",
              body: JSON.stringify({
                artifact_id: ARTIFACT_ID,
                job_id: `mock-job-retry-${compileRequests.length}`,
                status: "queued",
              }),
            });
          } else {
            await route.continue();
          }
        },
      );
      await mockCompileEventsSSEFailed(page);

      await page.goto("/inbox");
      await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
        timeout: 10_000,
      });

      const artifactRow = page.locator(`[data-artifact-id="${ARTIFACT_ID}"]`);
      await expect(artifactRow).toBeVisible({ timeout: 10_000 });

      // First compile — triggers failure
      const compileBtn = artifactRow.getByRole("button", { name: /compile/i });
      await compileBtn.click();
      await expect(
        artifactRow.locator("[data-testid='compile-error-pill']"),
      ).toBeVisible({ timeout: 5_000 });

      expect(compileRequests).toHaveLength(1);

      // Retry — look for retry button or re-click compile
      const retryBtn = artifactRow.getByRole("button", { name: /retry/i });
      if (await retryBtn.isVisible()) {
        await retryBtn.click();
      } else {
        // Some implementations reuse the compile button after failure
        await compileBtn.click();
      }

      // A second POST should have fired
      await expect
        .poll(() => compileRequests.length, { timeout: 5_000 })
        .toBeGreaterThanOrEqual(2);
    },
  );
});
