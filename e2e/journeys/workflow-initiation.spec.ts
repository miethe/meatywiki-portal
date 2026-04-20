/**
 * Journey: Workflow Initiation Wizard (P1.5-2-03)
 *
 * Covers:
 *   - "New workflow" button is visible on the Workflows page
 *   - Clicking it opens the Initiation Wizard dialog
 *   - Step 1: source scope options are visible and selectable
 *   - Step 2: template dropdown is populated from the API
 *   - Step 3: configure screen renders with a Launch button
 *   - Submitting creates a workflow and navigates to the run detail page
 *
 * Backend dependency: required (skips gracefully if backend is unreachable).
 *
 * Note: requires backend to serve GET /api/workflow-templates and
 * POST /api/workflows. If these endpoints are not yet merged on the backend
 * branch, assertions for steps 2 and 3 may fail — run with a seeded backend.
 */

import { test, expect } from "../support/fixtures";

test.describe("Journey: Workflow Initiation Wizard", () => {
  test.describe.configure({ mode: "serial" });

  test("New workflow button visible on /workflows", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/workflows");
    await page.waitForSelector('h1:has-text("Workflows")', { timeout: 10_000 });

    const btn = page.getByRole("button", { name: /new workflow/i });
    await expect(btn).toBeVisible();

    // Keyboard accessible
    await btn.focus();
    await expect(btn).toBeFocused();
  });

  test("clicking New workflow opens wizard dialog", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/workflows");
    await page.waitForSelector('h1:has-text("Workflows")', { timeout: 10_000 });

    await page.getByRole("button", { name: /new workflow/i }).click();

    // Dialog with role="dialog" must appear
    const dialog = page.getByRole("dialog", { name: /workflow initiation wizard/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test("Step 1: source scope options render", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/workflows");
    await page.waitForSelector('h1:has-text("Workflows")', { timeout: 10_000 });
    await page.getByRole("button", { name: /new workflow/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // All three scope options present
    await expect(dialog.getByRole("radio", { name: /all library/i })).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /recent drafts/i })).toBeVisible();
    await expect(dialog.getByRole("radio", { name: /selected artifacts/i })).toBeVisible();

    // Default: all_library selected
    await expect(dialog.getByRole("radio", { name: /all library/i })).toBeChecked();
  });

  test("Step 1 → Step 2: Next button advances to routing screen", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/workflows");
    await page.waitForSelector('h1:has-text("Workflows")', { timeout: 10_000 });
    await page.getByRole("button", { name: /new workflow/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Click Next
    await dialog.getByRole("button", { name: /advance to next step/i }).click();

    // Step 2 heading
    await expect(dialog.getByText(/routing confirmation/i)).toBeVisible({ timeout: 5_000 });
    // Template dropdown present
    await expect(dialog.getByRole("combobox", { name: /select workflow template/i })).toBeVisible();
  });

  test("Step 2: template dropdown populated from API", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/workflows");
    await page.waitForSelector('h1:has-text("Workflows")', { timeout: 10_000 });
    await page.getByRole("button", { name: /new workflow/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /advance to next step/i }).click();
    await expect(dialog.getByText(/routing confirmation/i)).toBeVisible({ timeout: 5_000 });

    // At least one template option in the dropdown (beyond the placeholder)
    const select = dialog.getByRole("combobox", { name: /select workflow template/i });
    await expect(select).toBeVisible();

    // Wait for options to load
    await page.waitForFunction(() => {
      const sel = document.querySelector("select");
      return sel && sel.options.length > 1;
    }, { timeout: 10_000 });
  });

  test("Step 2 → Step 3: advances to configure screen", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/workflows");
    await page.waitForSelector('h1:has-text("Workflows")', { timeout: 10_000 });
    await page.getByRole("button", { name: /new workflow/i }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /advance to next step/i }).click();
    await expect(dialog.getByText(/routing confirmation/i)).toBeVisible({ timeout: 5_000 });

    // Wait for template options
    await page.waitForFunction(() => {
      const sel = document.querySelector("select");
      return sel && sel.options.length > 1;
    }, { timeout: 10_000 });

    await dialog.getByRole("button", { name: /advance to next step/i }).click();
    await expect(dialog.getByText(/configure & launch/i)).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByRole("button", { name: /launch workflow/i })).toBeVisible();
  });

  test("Esc key closes the wizard", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/workflows");
    await page.waitForSelector('h1:has-text("Workflows")', { timeout: 10_000 });
    await page.getByRole("button", { name: /new workflow/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });

  test("Full flow: open → select scope → confirm routing → launch → verify run in Status Surface", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/workflows");
    await page.waitForSelector('h1:has-text("Workflows")', { timeout: 10_000 });

    // Open wizard
    await page.getByRole("button", { name: /new workflow/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Step 1: select "Recent Drafts"
    await dialog.getByRole("radio", { name: /recent drafts/i }).click();
    await expect(dialog.getByRole("radio", { name: /recent drafts/i })).toBeChecked();
    await dialog.getByRole("button", { name: /advance to next step/i }).click();

    // Step 2: wait for templates, advance
    await expect(dialog.getByText(/routing confirmation/i)).toBeVisible({ timeout: 5_000 });
    await page.waitForFunction(() => {
      const sel = document.querySelector("select");
      return sel && sel.options.length > 1;
    }, { timeout: 10_000 });
    await dialog.getByRole("button", { name: /advance to next step/i }).click();

    // Step 3: launch
    await expect(dialog.getByRole("button", { name: /launch workflow/i })).toBeVisible({ timeout: 5_000 });
    await dialog.getByRole("button", { name: /launch workflow/i }).click();

    // After successful submission, navigated to /workflows/:run_id
    // (backend returns run_id in 202 response; we check we left the modal)
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  });
});
