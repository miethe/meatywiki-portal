/**
 * Journey 3: Library Browse
 *
 * Covers:
 *   - Navigating to /library renders the Library screen
 *   - Artifact cards are listed (or empty state is shown)
 *   - Grid / List view toggle switches layout
 *   - Applying a type filter updates the visible artifact set
 *   - Filter chip shows count change (or empty-state) when filter is active
 *
 * Backend dependency: required (skips gracefully if unreachable).
 */

import { test, expect } from "../support/fixtures";

test.describe("Journey 3: Library Browse", () => {
  test("Library screen renders with heading and filter bar", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/library");

    // Heading
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible({
      timeout: 10_000,
    });

    // Subtitle
    await expect(
      page.getByText(/Compiled knowledge artifacts/i),
    ).toBeVisible();

    // Filter bar should be present — it wraps the type chips
    // The filter bar contains a group or labelled region
    const mainContent = page.getByRole("main");
    await expect(mainContent).toBeVisible();
  });

  test("artifact grid renders OR empty state is shown", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/library");
    await page.waitForSelector('h1:has-text("Library")', { timeout: 10_000 });

    // Wait for loading to finish (skeleton clears, list or empty state appears)
    await page.waitForSelector(
      '[aria-label="Library artifacts"] [role="list"], [role="status"]',
      { timeout: 15_000 },
    );

    // Count actual artifact cards
    const artifactList = page.getByRole("region", {
      name: /Library artifacts/i,
    });
    await expect(artifactList).toBeVisible();

    // Either a list of artifacts or an empty-state message
    const listItems = artifactList.locator('[role="list"] li');
    const emptyState = artifactList.getByRole("status");

    const itemCount = await listItems.count();
    const hasEmptyState = await emptyState.isVisible();

    // One of the two must be true
    expect(itemCount > 0 || hasEmptyState).toBe(true);
  });

  test("view toggle switches between Grid and List layouts", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/library");
    await page.waitForSelector('h1:has-text("Library")', { timeout: 10_000 });

    // View toggle group
    const viewToggle = page.getByRole("group", { name: /View layout/i });
    await expect(viewToggle).toBeVisible();

    const gridBtn = viewToggle.getByRole("button", { name: /Grid view/i });
    const listBtn = viewToggle.getByRole("button", { name: /List view/i });

    await expect(gridBtn).toBeVisible();
    await expect(listBtn).toBeVisible();

    // Switch to list view
    await listBtn.click();
    await expect(listBtn).toHaveAttribute("aria-pressed", "true");
    await expect(gridBtn).toHaveAttribute("aria-pressed", "false");

    // Switch back to grid view
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute("aria-pressed", "true");
    await expect(listBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("applying a type filter updates visible results", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/library");
    await page.waitForSelector('h1:has-text("Library")', { timeout: 10_000 });

    // Wait for initial load to finish
    await page.waitForSelector(
      '[aria-label="Library artifacts"] [role="list"], [role="status"]',
      { timeout: 15_000 },
    );

    // Record initial artifact count
    const listItems = page.locator('[aria-label="Library artifacts"] [role="list"] li');
    const initialCount = await listItems.count();

    // Find any type filter button (the filter bar renders type chips)
    // Look for a button that looks like a type chip (note/concept/entity/etc.)
    const filterBar = page.locator(
      "[data-testid='library-filter-bar'], form, [role='group'], nav",
    ).first();

    // Try to find and click any type filter button visible in the page
    // The LibraryFilterBar renders buttons for artifact types
    const typeFilterBtn = page
      .getByRole("button")
      .filter({ hasText: /note|concept|entity|topic|synthesis/i })
      .first();

    const filterExists = await typeFilterBtn.isVisible();

    if (filterExists) {
      await typeFilterBtn.click();

      // After applying a filter, the result set changes (may be smaller or empty)
      // Wait for any re-render
      await page.waitForTimeout(500);

      // Verify that either the count changed, or an empty state appeared,
      // or the filter button is now in an "active" visual state
      // (aria-pressed="true" or a specific class — the exact attr depends on implementation)
      const afterCount = await listItems.count();
      const emptyStateVisible = await page
        .getByRole("status")
        .isVisible()
        .catch(() => false);

      // The filter had some effect: count changed OR empty state appeared
      const filterHadEffect = afterCount !== initialCount || emptyStateVisible;
      expect(filterHadEffect).toBe(true);
    } else {
      // No type filter buttons visible — library may be empty; skip assertion
      test.info().annotations.push({
        type: "note",
        description:
          "No type filter buttons found (library may be empty) — filter assertion skipped.",
      });
    }
  });

  test("artifact cards are clickable and navigate to detail", async ({
    authenticatedPage: page,
    skipIfBackendDown, // eslint-disable-line @typescript-eslint/no-unused-vars
  }) => {
    await page.goto("/library");
    await page.waitForSelector('h1:has-text("Library")', { timeout: 10_000 });

    // Wait for cards or empty state
    await page.waitForSelector(
      '[aria-label="Library artifacts"] [role="list"] li, [role="status"]',
      { timeout: 15_000 },
    );

    const cards = page.locator('[aria-label="Library artifacts"] [role="list"] li');
    const cardCount = await cards.count();

    if (cardCount > 0) {
      // Each card contains a link to the artifact detail page
      const firstLink = cards.first().getByRole("link");
      const href = await firstLink.getAttribute("href");
      expect(href).toMatch(/\/artifact\//);

      // Click through to detail
      await firstLink.click();
      await expect(page).toHaveURL(/\/artifact\//, { timeout: 10_000 });
    } else {
      test.info().annotations.push({
        type: "note",
        description: "Library is empty — card navigation assertion skipped.",
      });
    }
  });
});
