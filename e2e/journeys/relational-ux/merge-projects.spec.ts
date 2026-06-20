/**
 * E2E: Portal v2.6 — Merge projects flow (P5-01 coverage).
 *
 * Scenario:
 *   Navigate to /projects/:id → click "Advanced" → "Merge projects" →
 *   pick target project → set surviving name → confirm →
 *   assert navigation to the surviving project URL.
 *
 * All network calls are stubbed — no live backend required.
 *
 * Stubs:
 *   GET  /api/projects/:source_id           — source ContextPack
 *   GET  /api/projects/                     — project list for target picker
 *   GET  /api/projects/:source_id/versions  — version history (unused in merge)
 *   POST /api/projects/:source_id/merge     — merge action (202 → survivor)
 *   GET  /api/artifacts**                   — artifact list (empty)
 *
 * Assumed aria / testid anchors (all role/text based):
 *   - "Advanced" button triggers the dropdown menu
 *   - "Merge projects" dropdown item triggers MergeProjectsDialog
 *   - Dialog title: "Merge Project"
 *   - combobox button with aria-haspopup="listbox" for target project picker
 *   - "Surviving project name" label for the name text input
 *   - "Confirm merge" button inside the dialog
 *   - After success: navigation → /projects/:surviving_id
 *
 * data-testid values assumed to exist (to be added if missing):
 *   None — all selectors are role/text based.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const SOURCE_PACK_ID = "proj-source-alpha";
const TARGET_PACK_ID = "proj-target-beta";
const SURVIVOR_PACK_ID = TARGET_PACK_ID; // backend returns target as survivor
const SURVIVING_NAME = "Merged Alpha+Beta";

const TOKEN = process.env.MEATYWIKI_PORTAL_TOKEN ?? "test-token-e2e";

const sourcePack = {
  pack_id: SOURCE_PACK_ID,
  name: "Project Alpha",
  description: "Source project to be merged.",
  artifact_ids: ["art-1", "art-2"],
  artifact_count: 2,
  version: 1,
  created_at: "2026-05-01T10:00:00Z",
  updated_at: "2026-05-10T12:00:00Z",
};

const targetPack = {
  pack_id: TARGET_PACK_ID,
  name: "Project Beta",
  description: "Surviving target project.",
  artifact_ids: ["art-3"],
  artifact_count: 1,
  version: 2,
  created_at: "2026-04-01T08:00:00Z",
  updated_at: "2026-05-09T09:00:00Z",
};

const mergeResult = {
  surviving_pack_id: SURVIVOR_PACK_ID,
  absorbed_artifact_count: 2,
  archived_pack_id: SOURCE_PACK_ID,
};

// The survivor project (returned when navigating to /projects/:survivor)
const survivorPack = {
  ...targetPack,
  name: SURVIVING_NAME,
  artifact_count: 3,
};

// ---------------------------------------------------------------------------
// Route setup
// ---------------------------------------------------------------------------

async function seedAuth(page: Page): Promise<void> {
  await page.context().addCookies(
    ["127.0.0.1", "localhost"].map((domain) => ({
      name: "portal_session",
      value: TOKEN,
      domain,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}

async function fulfillJson(
  route: import("@playwright/test").Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function setupMergeMocks(page: Page): Promise<void> {
  await page.route("**/api/auth/session", async (route) => {
    await fulfillJson(route, { authenticated: true });
  });

  await page.route("**/api/projects/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());

    // POST .../merge → 200 merge result
    if (req.method() === "POST" && url.pathname.includes("/merge")) {
      return fulfillJson(route, mergeResult, 200);
    }

    if (req.method() !== "GET") return route.continue();

    // GET .../versions
    if (url.pathname.endsWith("/versions")) {
      return fulfillJson(route, { data: [], cursor: null });
    }

    // GET specific source project
    if (url.pathname.endsWith(`/${SOURCE_PACK_ID}`)) {
      return fulfillJson(route, sourcePack);
    }

    // GET specific survivor / target project
    if (url.pathname.endsWith(`/${TARGET_PACK_ID}`)) {
      return fulfillJson(route, survivorPack);
    }

    // GET project list (for target picker in MergeProjectsDialog)
    if (url.pathname.endsWith("/projects/") || url.pathname.endsWith("/projects")) {
      return fulfillJson(route, {
        data: [
          {
            id: TARGET_PACK_ID,
            name: targetPack.name,
            artifact_count: targetPack.artifact_count,
          },
        ],
        cursor: null,
      });
    }

    return fulfillJson(route, { error: "not_found" }, 404);
  });

  // Project options endpoint (useProjectOptions hook)
  await page.route("**/api/projects**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") return route.continue();
    const url = new URL(req.url());
    // Already handled above; this catches any remaining patterns
    if (url.pathname.includes("/merge")) return route.continue();
    await fulfillJson(route, {
      data: [
        {
          id: TARGET_PACK_ID,
          name: targetPack.name,
          artifact_count: targetPack.artifact_count,
        },
      ],
      cursor: null,
    });
  });

  await page.route("**/api/artifacts**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    await fulfillJson(route, { data: { items: [], cursor: null } });
  });

  await page.route("**/api/workflow-events**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Portal v2.6 — Merge projects", () => {
  test("Advanced → Merge → pick target → set name → confirm → routes to survivor", async ({
    page,
  }) => {
    await seedAuth(page);
    await setupMergeMocks(page);

    // Navigate to the source project detail page
    await page.goto(`/projects/${SOURCE_PACK_ID}`);

    // Wait for the project name to confirm page load
    await expect(page.getByRole("heading", { name: "Project Alpha" })).toBeVisible({
      timeout: 15_000,
    });

    // 1. Open Advanced dropdown
    const advancedBtn = page.getByRole("button", { name: /advanced/i });
    await expect(advancedBtn).toBeVisible({ timeout: 8_000 });
    await advancedBtn.click();

    // 2. Click "Merge projects" item
    const mergeItem = page.getByRole("menuitem", { name: /merge projects/i });
    await expect(mergeItem).toBeVisible({ timeout: 5_000 });
    await mergeItem.click();

    // 3. MergeProjectsDialog opens
    const mergeDialog = page.getByRole("dialog", { name: /merge project/i });
    await expect(mergeDialog).toBeVisible({ timeout: 5_000 });

    // 4. Pick target project via the combobox
    //    The combobox trigger has role="combobox" inside the dialog
    const comboboxTrigger = mergeDialog.getByRole("combobox");
    await expect(comboboxTrigger).toBeVisible({ timeout: 5_000 });
    await comboboxTrigger.click();

    // Select "Project Beta" from the dropdown list
    const targetOption = page
      .getByRole("option", { name: /project beta/i })
      .or(page.getByRole("listitem").filter({ hasText: /project beta/i }))
      .first();
    await expect(targetOption).toBeVisible({ timeout: 5_000 });
    await targetOption.click();

    // 5. Name field should auto-fill with target name; change it to SURVIVING_NAME
    const nameInput = mergeDialog.getByLabel(/surviving project name/i);
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await expect(nameInput).toHaveValue(/project beta/i, { timeout: 3_000 });

    await nameInput.fill(SURVIVING_NAME);

    // 6. Confirm merge
    const confirmBtn = mergeDialog.getByRole("button", { name: /confirm merge/i });
    await expect(confirmBtn).toBeEnabled({ timeout: 3_000 });
    await confirmBtn.click();

    // 7. After a successful merge the dialog should close and the app
    //    should navigate to the surviving project's URL.
    await expect(page).toHaveURL(new RegExp(`/projects/${SURVIVOR_PACK_ID}`), {
      timeout: 15_000,
    });
  });

  test("same-project merge (409) shows error inside dialog without closing it", async ({
    page,
  }) => {
    await seedAuth(page);
    await setupMergeMocks(page);

    // Patch the merge endpoint to return 409 for this test
    await page.route("**/api/projects/**/merge", async (route) => {
      await fulfillJson(route, { detail: "Cannot merge a project into itself." }, 409);
    });

    await page.goto(`/projects/${SOURCE_PACK_ID}`);
    await expect(page.getByRole("heading", { name: "Project Alpha" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("button", { name: /advanced/i }).click();
    await page.getByRole("menuitem", { name: /merge projects/i }).click();

    const mergeDialog = page.getByRole("dialog", { name: /merge project/i });
    await expect(mergeDialog).toBeVisible({ timeout: 5_000 });

    await mergeDialog.getByRole("combobox").click();
    await page
      .getByRole("option", { name: /project beta/i })
      .or(page.getByRole("listitem").filter({ hasText: /project beta/i }))
      .first()
      .click();

    await mergeDialog.getByLabel(/surviving project name/i).fill(SURVIVING_NAME);
    await mergeDialog.getByRole("button", { name: /confirm merge/i }).click();

    // Error alert should appear inside the dialog
    const errorAlert = mergeDialog.getByRole("alert");
    await expect(errorAlert).toBeVisible({ timeout: 8_000 });

    // Dialog should remain open (no navigation happened)
    await expect(mergeDialog).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(`/projects/${SURVIVOR_PACK_ID}`));
  });
});
