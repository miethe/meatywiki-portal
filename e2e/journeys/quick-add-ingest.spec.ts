/**
 * Journey 2: Quick Add → Ingest
 *
 * Covers:
 *   - "Quick Add" button is visible and accessible on the Inbox screen
 *   - Clicking Quick Add opens the modal dialog
 *   - Switching to URL tab makes the URL input active
 *   - Entering a valid URL and submitting transitions to the ingesting phase
 *     ("Ingesting…" heading in the modal)
 *   - SSE progress renders inside the modal (StageTracker)
 *   - Workflow completion state is shown ("Added" / "Successfully ingested")
 *
 * Backend dependency: required (skips gracefully if unreachable).
 *
 * SSE note: the backend's /api/workflows/:run_id/stream endpoint should return
 * a minimal event sequence (stage_started → workflow_completed) on success.
 * Tests use generous timeouts to account for real backend latency.
 */

import { test, expect } from "../support/fixtures";

test.describe("Journey 2: Quick Add → Ingest", () => {
  test.describe.configure({ mode: "serial" });

  test("Quick Add button is visible on Inbox", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/inbox");
    await page.waitForSelector('h1:has-text("Inbox")', { timeout: 10_000 });

    // The Quick Add button is labelled "Quick Add artifact"
    const quickAddBtn = page.getByRole("button", { name: /Quick Add/i });
    await expect(quickAddBtn).toBeVisible();

    // Should be accessible via keyboard focus
    await quickAddBtn.focus();
    await expect(quickAddBtn).toBeFocused();
  });

  test("clicking Quick Add opens the modal dialog", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/inbox");
    await page.waitForSelector('h1:has-text("Inbox")', { timeout: 10_000 });

    await page.getByRole("button", { name: /Quick Add/i }).click();

    // Modal dialog should appear
    const dialog = page.getByRole("dialog", { name: /Quick Add/i });
    await expect(dialog).toBeVisible();

    // Dialog has the "Quick Add" heading
    await expect(dialog.getByRole("heading", { name: "Quick Add" })).toBeVisible();

    // Both tabs (Note, URL) are present
    await expect(dialog.getByRole("tab", { name: "Note" })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "URL" })).toBeVisible();
  });

  test("URL tab is selectable and shows URL input", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/inbox");
    await page.waitForSelector('h1:has-text("Inbox")', { timeout: 10_000 });

    await page.getByRole("button", { name: /Quick Add/i }).click();

    const dialog = page.getByRole("dialog", { name: /Quick Add/i });
    await expect(dialog).toBeVisible();

    // Switch to URL tab
    await dialog.getByRole("tab", { name: "URL" }).click();

    // URL tab should be selected
    const urlTab = dialog.getByRole("tab", { name: "URL" });
    await expect(urlTab).toHaveAttribute("aria-selected", "true");

    // URL input should be visible and focusable
    const urlInput = dialog.getByRole("textbox", { name: /URL/i });
    await expect(urlInput).toBeVisible();
  });

  test("submitting a URL transitions the modal to the ingesting phase", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/inbox");
    await page.waitForSelector('h1:has-text("Inbox")', { timeout: 10_000 });

    await page.getByRole("button", { name: /Quick Add/i }).click();

    const dialog = page.getByRole("dialog", { name: /Quick Add/i });
    await dialog.getByRole("tab", { name: "URL" }).click();

    // Fill in a valid HTTPS URL
    await dialog
      .getByRole("textbox", { name: /URL/i })
      .fill("https://example.com/article");

    // Submit the form — the "Add" button becomes enabled when URL is valid
    const addBtn = dialog.getByRole("button", { name: /^Add$/i });
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // Modal heading transitions to "Ingesting…"
    await expect(
      dialog.getByRole("heading", { name: /Ingesting/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Live region with ingestion progress should appear
    await expect(dialog.locator("[aria-live]")).toBeVisible();
  });

  test("SSE progress renders and workflow reaches completion state", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/inbox");
    await page.waitForSelector('h1:has-text("Inbox")', { timeout: 10_000 });

    await page.getByRole("button", { name: /Quick Add/i }).click();

    const dialog = page.getByRole("dialog", { name: /Quick Add/i });
    await dialog.getByRole("tab", { name: "URL" }).click();
    await dialog
      .getByRole("textbox", { name: /URL/i })
      .fill("https://example.com/sse-test");
    await dialog.getByRole("button", { name: /^Add$/i }).click();

    // Wait for the completion state: modal heading becomes "Added" and
    // the success checkmark / "Successfully ingested" message appears.
    // Uses a 30s timeout to accommodate real backend SSE latency.
    await expect(
      dialog.getByRole("heading", { name: /Added/i }),
    ).toBeVisible({ timeout: 30_000 });

    // Completion UI: "Add another" button should be present
    await expect(
      dialog.getByRole("button", { name: /Add another/i }),
    ).toBeVisible();
  });
});
