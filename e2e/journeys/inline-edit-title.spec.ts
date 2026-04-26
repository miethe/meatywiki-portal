/**
 * E2E smoke test: inline title edit on the Artifact Detail screen (P2-07).
 *
 * Scenario:
 *   1. Navigate to a known artifact detail page.
 *   2. Click the title field to enter inline-edit mode.
 *   3. Type a new title value and press Enter.
 *   4. Verify the "Saved" toast appears.
 *   5. Reload the page and verify the new title persists.
 *
 * Infrastructure notes:
 *   - Requires a live backend (MEATYWIKI_PORTAL_API_URL + MEATYWIKI_PORTAL_TOKEN).
 *   - Uses the skipIfBackendDown fixture to skip gracefully when the backend is
 *     unreachable, so frontend-only CI pipelines stay green.
 *   - Requires a real (seeded) artifact in the backend for the PATCH to succeed.
 *     The test fetches the first artifact from GET /api/artifacts to obtain a
 *     live ID; if the library is empty it falls back to test.skip() with a
 *     descriptive message.
 *   - The test restores the original title after the assertion so it does not
 *     leave the vault in a dirty state.
 *
 * Fixture seeding prerequisite (before un-skipping in CI):
 *   A seeded artifact must exist in the test vault.  The backend test fixture
 *   mechanism is not yet wired for E2E; once it is, replace the dynamic ID
 *   lookup with a deterministic fixture ID and remove the restore step.
 *
 * To run locally:
 *   pnpm e2e --grep "inline title edit"
 */

import { test, expect, API_URL, TEST_TOKEN } from "../support/fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch the first artifact ID and title from the live backend. */
async function fetchFirstArtifact(): Promise<{ id: string; title: string } | null> {
  try {
    const resp = await fetch(`${API_URL}/api/artifacts?limit=1`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const body = (await resp.json()) as {
      data: { items: { id: string; title: string }[] };
    };
    const first = body.data?.items?.[0];
    if (!first?.id) return null;
    return { id: first.id, title: first.title ?? "Untitled" };
  } catch {
    return null;
  }
}

/** PATCH the artifact title directly via API (used for teardown restore). */
async function restoreTitle(id: string, title: string): Promise<void> {
  try {
    // Fetch the current ETag first so the PATCH If-Match header is valid.
    const headResp = await fetch(`${API_URL}/api/artifacts/${id}`, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      signal: AbortSignal.timeout(4000),
    });
    const etag = headResp.headers.get("ETag") ?? "";

    await fetch(`${API_URL}/api/artifacts/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TEST_TOKEN}`,
        "Content-Type": "application/json",
        "If-Match": etag,
      },
      body: JSON.stringify({ title }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Best-effort teardown — do not fail the test if restore fails.
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Inline title edit — E2E smoke", () => {
  test.describe.configure({ mode: "serial" });

  test(
    "edit title on detail page, verify value persists after reload",
    async ({
      authenticatedPage: page,
      skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
    }) => {
      // ---- Step 1: Obtain a real artifact ID from the backend ----
      const artifact = await fetchFirstArtifact();
      if (!artifact) {
        test.skip(
          true,
          "No artifacts found in the library — seed at least one artifact before running this test. " +
            "The backend fixture mechanism for E2E is not yet wired (see P2-07 test file header).",
        );
        return;
      }

      const { id: artifactId, title: originalTitle } = artifact;
      const newTitle = `${originalTitle} (e2e-${Date.now()})`;

      try {
        // ---- Step 2: Navigate to the artifact detail page ----
        await page.goto(`/artifact/${artifactId}`);

        // Wait for the editable metadata section to render.
        const editableSection = page.getByRole("region", {
          name: /Editable artifact metadata/i,
        });
        await expect(editableSection).toBeVisible({ timeout: 15_000 });

        // ---- Step 3: Click the Title field display area to enter edit mode ----
        // The InlineTextField component renders a display area with role=button
        // and aria-label="Edit Title"; click it to enter edit mode.
        const titleEditButton = editableSection
          .getByRole("button", { name: /edit title/i })
          .first();
        await titleEditButton.click();

        // The text input should now be visible.
        const titleInput = editableSection.getByRole("textbox");
        await expect(titleInput).toBeVisible({ timeout: 5_000 });

        // ---- Step 4: Type the new title and commit with Enter ----
        await titleInput.fill(newTitle);
        await titleInput.press("Enter");

        // ---- Step 5: "Saved" toast should appear ----
        const savedToast = page.getByRole("status", { name: newTitle }).or(
          // The toast has aria-label=toast text and role=status
          page.locator('[role="status"]').filter({ hasText: "Saved" }),
        );
        await expect(savedToast).toBeVisible({ timeout: 10_000 });

        // ---- Step 6: Reload and verify the new title persists ----
        await page.reload();
        await expect(editableSection).toBeVisible({ timeout: 15_000 });

        // The updated title should now appear in the editable metadata section.
        await expect(editableSection).toContainText(newTitle, {
          timeout: 10_000,
        });
      } finally {
        // ---- Teardown: restore original title so the test is idempotent ----
        await restoreTitle(artifactId, originalTitle);
      }
    },
  );
});
