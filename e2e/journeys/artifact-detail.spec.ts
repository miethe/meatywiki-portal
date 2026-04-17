/**
 * Journey 4: Artifact Detail — 3 reader tabs
 *
 * Covers:
 *   - Navigating to /artifact/:id renders the detail screen
 *   - Three reader tabs are present: Source, Knowledge, Draft
 *   - Switching tabs changes the visible reader panel
 *   - Each tab panel has distinct content (panels are not all simultaneously visible)
 *   - Breadcrumb navigation is present
 *   - Action buttons group is accessible
 *
 * Backend dependency: required (skips gracefully if unreachable).
 *
 * Strategy: the test navigates directly to /artifact/:id using a known artifact
 * ID from the library if available, falling back to the stub ID from MSW handlers
 * ("01HXYZ0000000000000000001"). In CI with a real backend the test picks the
 * first artifact ID returned by GET /api/artifacts.
 */

import { test, expect, API_URL, TEST_TOKEN } from "../support/fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch the first artifact ID from the live backend for navigation. */
async function fetchFirstArtifactId(): Promise<string | null> {
  try {
    const resp = await fetch(`${API_URL}/api/artifacts?limit=1`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return null;
    const body = (await resp.json()) as {
      data: { items: { id: string }[] };
    };
    return body.data?.items?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Journey 4: Artifact Detail — reader tabs", () => {
  test.describe.configure({ mode: "serial" });

  test("artifact detail page renders heading and breadcrumb", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    const id = (await fetchFirstArtifactId()) ?? "01HXYZ0000000000000000001";

    await page.goto(`/artifact/${id}`);

    // Breadcrumb is present
    await expect(page.getByRole("navigation", { name: /Breadcrumb/i })).toBeVisible({
      timeout: 10_000,
    });

    // Detail page should not still show a loading spinner after load
    await expect(page.getByRole("status", { name: /Loading artifact/i })).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test("three reader tabs are visible: Source, Knowledge, Draft", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    const id = (await fetchFirstArtifactId()) ?? "01HXYZ0000000000000000001";
    await page.goto(`/artifact/${id}`);

    // Wait for tab list to render
    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    // All three tabs must be present
    await expect(tabList.getByRole("tab", { name: "Source" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Knowledge" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Draft" })).toBeVisible();
  });

  test("Source tab is selected by default and shows a panel", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    const id = (await fetchFirstArtifactId()) ?? "01HXYZ0000000000000000001";
    await page.goto(`/artifact/${id}`);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    const sourceTab = tabList.getByRole("tab", { name: "Source" });

    // Source tab is the default selected tab
    await expect(sourceTab).toHaveAttribute("aria-selected", "true");

    // Its panel is visible
    const sourcePanel = page.getByRole("tabpanel", {
      name: /Source/i,
    });
    await expect(sourcePanel).toBeVisible();
  });

  test("clicking Knowledge tab switches the visible panel", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    const id = (await fetchFirstArtifactId()) ?? "01HXYZ0000000000000000001";
    await page.goto(`/artifact/${id}`);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    // Click Knowledge tab
    await tabList.getByRole("tab", { name: "Knowledge" }).click();

    // Knowledge tab becomes selected
    await expect(
      tabList.getByRole("tab", { name: "Knowledge" }),
    ).toHaveAttribute("aria-selected", "true");

    // Source tab is no longer selected
    await expect(
      tabList.getByRole("tab", { name: "Source" }),
    ).toHaveAttribute("aria-selected", "false");

    // Knowledge panel is now visible
    const knowledgePanel = page.getByRole("tabpanel", {
      name: /Knowledge/i,
    });
    await expect(knowledgePanel).toBeVisible();
  });

  test("clicking Draft tab switches the visible panel", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    const id = (await fetchFirstArtifactId()) ?? "01HXYZ0000000000000000001";
    await page.goto(`/artifact/${id}`);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    // Click Draft tab
    await tabList.getByRole("tab", { name: "Draft" }).click();

    await expect(
      tabList.getByRole("tab", { name: "Draft" }),
    ).toHaveAttribute("aria-selected", "true");

    const draftPanel = page.getByRole("tabpanel", { name: /Draft/i });
    await expect(draftPanel).toBeVisible();
  });

  test("tab panels are exclusive — only one panel is visible at a time", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    const id = (await fetchFirstArtifactId()) ?? "01HXYZ0000000000000000001";
    await page.goto(`/artifact/${id}`);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 15_000 });

    // Start on Source tab
    await tabList.getByRole("tab", { name: "Source" }).click();

    // Count visible tabpanels — should be exactly 1
    const visiblePanels = page.locator('[role="tabpanel"]:visible');
    await expect(visiblePanels).toHaveCount(1);

    // Switch to Knowledge
    await tabList.getByRole("tab", { name: "Knowledge" }).click();
    await expect(visiblePanels).toHaveCount(1);

    // Switch to Draft
    await tabList.getByRole("tab", { name: "Draft" }).click();
    await expect(visiblePanels).toHaveCount(1);
  });

  test("action buttons group is accessible", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    const id = (await fetchFirstArtifactId()) ?? "01HXYZ0000000000000000001";
    await page.goto(`/artifact/${id}`);

    // Wait for detail to load
    await page.waitForSelector('[role="tablist"]', { timeout: 15_000 });

    // Action group (aria-label="Artifact actions") must be present
    const actionsGroup = page.getByRole("group", { name: /Artifact actions/i });
    await expect(actionsGroup).toBeVisible();

    // At least one action button should exist
    const actionButtons = actionsGroup.getByRole("button");
    expect(await actionButtons.count()).toBeGreaterThan(0);
  });
});
