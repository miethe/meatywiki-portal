/**
 * E2E — Inbox & Library Live Workflow Status: activity timeline tooltip
 *
 * Covers (P5-03):
 *   - Hover/click Library card badge → ActivityHistoryTooltip opens with stage timeline
 *   - Keyboard Escape closes the tooltip
 *   - Mobile viewport tap → tooltip opens (Popover in tap-to-reveal mode)
 *
 * Backend dependency: required for /api/artifacts/{id}/activity (skips via
 * skipIfBackendDown fixture). Activity endpoint is mocked via route intercept
 * so tests run without a fully populated vault.
 */

import { test, expect } from "../support/fixtures";
import type { Page } from "@playwright/test";

const ARTIFACT_ID = "e2e-test-artifact-tooltip";

const MOCK_ACTIVITY = {
  artifact_id: ARTIFACT_ID,
  stages: [
    {
      stage: "classify",
      status: "completed",
      started_at: "2026-05-20T09:00:01.000Z",
      completed_at: "2026-05-20T09:00:02.500Z",
      duration_ms: 1500,
    },
    {
      stage: "extract",
      status: "completed",
      started_at: "2026-05-20T09:00:02.500Z",
      completed_at: "2026-05-20T09:00:05.000Z",
      duration_ms: 2500,
    },
    {
      stage: "compile",
      status: "completed",
      started_at: "2026-05-20T09:00:05.000Z",
      completed_at: "2026-05-20T09:00:08.000Z",
      duration_ms: 3000,
    },
    {
      stage: "file_back",
      status: "completed",
      started_at: "2026-05-20T09:00:08.000Z",
      completed_at: "2026-05-20T09:00:08.500Z",
      duration_ms: 500,
    },
    {
      stage: "lint",
      status: "completed",
      started_at: "2026-05-20T09:00:08.500Z",
      completed_at: "2026-05-20T09:00:09.000Z",
      duration_ms: 500,
    },
  ],
  outcome: "success",
  last_compiled_at: "2026-05-20T09:00:09.000Z",
};

async function mockActivityEndpoint(page: Page): Promise<void> {
  await page.route(
    `**/api/artifacts/${ARTIFACT_ID}/activity`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ACTIVITY),
      });
    },
  );
}

async function mockLibraryList(page: Page): Promise<void> {
  await page.route("**/api/library**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: ARTIFACT_ID,
            title: "E2E Test Artifact — Activity Tooltip",
            compile_status: "success",
            last_compiled_at: "2026-05-20T09:00:09.000Z",
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

test.describe("Activity timeline tooltip — desktop", () => {
  test(
    "hover over Library card badge opens activity timeline",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockLibraryList(page);
      await mockActivityEndpoint(page);

      await page.goto("/library");
      await expect(
        page.getByRole("heading", { name: "Library" }),
      ).toBeVisible({ timeout: 10_000 });

      const libraryCard = page.locator(
        `[data-testid='library-card'][data-artifact-id="${ARTIFACT_ID}"]`,
      );
      await expect(libraryCard).toBeVisible({ timeout: 10_000 });

      const badge = libraryCard.locator(
        "[data-testid='library-card-status-badge']",
      );
      await expect(badge).toBeVisible();

      // Hover to trigger tooltip (Popover may open on hover or focus)
      await badge.hover();

      // Tooltip / Popover should become visible
      const tooltip = page.locator("[data-testid='activity-history-tooltip']");
      await expect(tooltip).toBeVisible({ timeout: 5_000 });

      // Should show stage timeline entries
      for (const s of MOCK_ACTIVITY.stages) {
        await expect(
          tooltip.locator(`[data-stage="${s.stage}"]`),
        ).toBeVisible();
      }
    },
  );

  test(
    "click Library card badge opens activity timeline",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockLibraryList(page);
      await mockActivityEndpoint(page);

      await page.goto("/library");
      await expect(
        page.getByRole("heading", { name: "Library" }),
      ).toBeVisible({ timeout: 10_000 });

      const badge = page
        .locator(
          `[data-testid='library-card'][data-artifact-id="${ARTIFACT_ID}"]`,
        )
        .locator("[data-testid='library-card-status-badge']");

      await badge.click();

      const tooltip = page.locator("[data-testid='activity-history-tooltip']");
      await expect(tooltip).toBeVisible({ timeout: 5_000 });
    },
  );

  test(
    "Escape key closes activity timeline tooltip",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockLibraryList(page);
      await mockActivityEndpoint(page);

      await page.goto("/library");
      await expect(
        page.getByRole("heading", { name: "Library" }),
      ).toBeVisible({ timeout: 10_000 });

      const badge = page
        .locator(
          `[data-testid='library-card'][data-artifact-id="${ARTIFACT_ID}"]`,
        )
        .locator("[data-testid='library-card-status-badge']");

      await badge.click();

      const tooltip = page.locator("[data-testid='activity-history-tooltip']");
      await expect(tooltip).toBeVisible({ timeout: 5_000 });

      // Keyboard Escape should dismiss the Popover
      await page.keyboard.press("Escape");
      await expect(tooltip).not.toBeVisible({ timeout: 3_000 });
    },
  );
});

test.describe("Activity timeline tooltip — mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 Pro

  test(
    "tap on Library card badge opens activity timeline on mobile",
    async ({ authenticatedPage: page }) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      await mockLibraryList(page);
      await mockActivityEndpoint(page);

      await page.goto("/library");
      await expect(
        page.getByRole("heading", { name: "Library" }),
      ).toBeVisible({ timeout: 10_000 });

      const badge = page
        .locator(
          `[data-testid='library-card'][data-artifact-id="${ARTIFACT_ID}"]`,
        )
        .locator("[data-testid='library-card-status-badge']");

      await expect(badge).toBeVisible({ timeout: 10_000 });

      // Tap (click in Playwright) on mobile viewport
      await badge.tap();

      const tooltip = page.locator("[data-testid='activity-history-tooltip']");
      await expect(tooltip).toBeVisible({ timeout: 5_000 });

      // Tooltip should still contain stage timeline
      await expect(
        tooltip.locator("[data-stage='compile']"),
      ).toBeVisible();
    },
  );
});
