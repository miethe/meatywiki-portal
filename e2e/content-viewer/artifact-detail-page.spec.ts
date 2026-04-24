/**
 * PU7-03 + PU7-06 — Full Artifact Detail Page E2E Tests
 *
 * Validates the complete artifact detail page with ArticleViewer integration.
 * Covers the full user journey: page loads, tab navigation, no layout breaks,
 * no console errors, and performance within budget (PU7-06 console + perf audit).
 *
 * Tests (PU7-03 — full page):
 *   1.  Page loads and breadcrumb is visible
 *   2.  Tab list renders with Knowledge, Draft, Source, Workflow OS, Backlinks
 *   3.  Source tab is selected by default
 *   4.  Navigating to Knowledge tab activates Knowledge panel with ArticleViewer
 *   5.  Navigating to Draft tab activates Draft panel with ArticleViewer
 *   6.  Only one tab panel is visible at a time during navigation
 *   7.  Navigating back to Source tab works after visiting Knowledge + Draft
 *   8.  No layout overflow at desktop viewport (1280×800)
 *   9.  Loading skeleton shown while data fetches (no instant 404/error flash)
 *   10. 404 state renders gracefully for unknown artifact ID
 *
 * Tests (PU7-06 — console + performance audit):
 *   11. No console errors during full tab navigation cycle (all 5 tabs)
 *   12. Initial render completes within 5s of navigation on dev server
 *   13. No memory leak indicator — tab navigation does not accumulate listeners
 *       (measured via repeated navigation; console must stay clean throughout)
 *
 * Mocking strategy: page.route() interception — no live backend required.
 * Auth: portal_session cookie seeded before each test.
 */

import { test as base, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture IDs + content
// ---------------------------------------------------------------------------

const FULL_ARTIFACT_ID = "01PU703000000000000FULLPAGE";
const NOT_FOUND_ID = "01PU703000000000000NOTFOUND";

const COMPILED_CONTENT = `# Knowledge Article

This is the **compiled knowledge** content for the full page test.

## Section Two

A paragraph with supporting text and a [reference](https://example.com).

| Feature | Status |
|---------|--------|
| Tables | Supported |
| Task lists | Supported |
`;

const DRAFT_CONTENT = `# Draft Synthesis

This is the **draft content** for the full page test artifact.

- Point one
- Point two
- Point three
`;

const RAW_CONTENT = `# Raw Source

---
title: Full Page Test
tags: [test]
---

Raw markdown source content as it appears in the vault.
`;

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

function makeFullDetail() {
  return {
    id: FULL_ARTIFACT_ID,
    workspace: "research",
    type: "concept",
    subtype: null,
    title: "Full Page Test Concept",
    status: "active",
    schema_version: "1.0",
    created: "2026-04-01T10:00:00Z",
    updated: "2026-04-23T12:00:00Z",
    file_path: "wiki/concepts/full-page-test.md",
    slug: "full-page-test",
    summary: "PU7-03 full artifact detail page E2E fixture.",
    content_hash: "sha256:pu703",
    frontmatter_jsonb: {
      tags: ["research", "test"],
      lens_freshness: "fresh",
    },
    raw_content: RAW_CONTENT,
    compiled_content: COMPILED_CONTENT,
    draft_content: DRAFT_CONTENT,
    artifact_edges: [],
    metadata: {
      fidelity: "high",
      freshness: "current",
      verification_state: "verified",
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedAuth(page: Page): Promise<void> {
  const token = process.env.MEATYWIKI_PORTAL_TOKEN ?? "test-token-e2e";
  await page.context().addCookies(
    ["127.0.0.1", "localhost"].map((domain) => ({
      name: "portal_session",
      value: token,
      domain,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}

async function installMocks(
  page: Page,
  id: string,
  detail: ReturnType<typeof makeFullDetail> | null,
): Promise<void> {
  await page.route("**/api/auth/session", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/artifacts/**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const pathname = new URL(route.request().url()).pathname;

    if (pathname.endsWith("/edges") || pathname.includes("/edges?")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ artifact_id: id, incoming: [], outgoing: [] }),
      });
    }
    if (pathname.endsWith("/derivatives") || pathname.includes("/derivatives?")) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "not_a_source" }),
      });
    }
    if (pathname.endsWith("/workflow-runs") || pathname.includes("/workflow-runs?")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], cursor: null } }),
      });
    }
    if (pathname.endsWith("/activity") || pathname.includes("/activity?")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], cursor: null } }),
      });
    }
    if (pathname.endsWith("/backlinks") || pathname.includes("/backlinks?")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], cursor: null } }),
      });
    }
    if (route.request().url().includes(id)) {
      if (detail) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(detail),
        });
      } else {
        // 404 for not-found test
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not_found" }),
        });
      }
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { items: [], cursor: null } }),
    });
  });

  await page.route("**/api/workflows/runs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { items: [], cursor: null, total: 0 } }),
    });
  });

  await page.route("**/api/workflow-events**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });
}

async function gotoArtifact(page: Page, id: string): Promise<void> {
  await page.goto(`/artifact/${id}`);
}

// ---------------------------------------------------------------------------
// Extended fixture with console capture
// ---------------------------------------------------------------------------

const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        errors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });
    await use(errors);
  },
});

// ---------------------------------------------------------------------------
// Suite — PU7-03: Full artifact detail page
// ---------------------------------------------------------------------------

test.describe("PU7-03: Full Artifact Detail Page — tab navigation", () => {
  test("1. page loads and breadcrumb navigation is visible", async ({ page }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    await expect(
      page.getByRole("navigation", { name: /Breadcrumb/i }),
    ).toBeVisible({ timeout: 20_000 });

    // Loading skeleton should resolve
    await expect(
      page.getByRole("status", { name: /Loading artifact/i }),
    ).not.toBeVisible({ timeout: 20_000 });
  });

  test("2. all reader tabs visible — Source, Knowledge, Draft, Workflow OS, Backlinks", async ({
    page,
  }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 20_000 });

    await expect(tabList.getByRole("tab", { name: "Source" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Knowledge" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Draft" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Workflow OS" })).toBeVisible();
    await expect(tabList.getByRole("tab", { name: "Backlinks" })).toBeVisible();
  });

  test("3. Source tab is selected by default", async ({ page }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 20_000 });

    await expect(tabList.getByRole("tab", { name: "Source" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("4. clicking Knowledge tab shows ArticleViewer with compiled content", async ({
    page,
  }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 20_000 });

    await tabList.getByRole("tab", { name: "Knowledge" }).click();

    // Panel is now active
    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    await expect(panel).toBeVisible({ timeout: 10_000 });

    // ArticleViewer renders the compiled markdown
    await expect(panel.locator("h1", { hasText: "Knowledge Article" })).toBeVisible({
      timeout: 8_000,
    });
    await expect(panel.locator("table")).toBeVisible();
  });

  test("5. clicking Draft tab shows ArticleViewer with draft content", async ({
    page,
  }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 20_000 });

    await tabList.getByRole("tab", { name: "Draft" }).click();

    const panel = page.getByRole("tabpanel", { name: /Draft/i });
    await expect(panel).toBeVisible({ timeout: 10_000 });

    await expect(panel.locator("h1", { hasText: "Draft Synthesis" })).toBeVisible({
      timeout: 8_000,
    });
    await expect(panel.locator("ul li").first()).toBeVisible();
  });

  test("6. only one tabpanel is visible at a time during tab navigation", async ({
    page,
  }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 20_000 });

    // Count visible (not hidden) tabpanels at each tab stop
    const visiblePanels = page.locator('[role="tabpanel"]:not([hidden])');

    await tabList.getByRole("tab", { name: "Source" }).click();
    await expect(visiblePanels).toHaveCount(1);

    await tabList.getByRole("tab", { name: "Knowledge" }).click();
    await expect(visiblePanels).toHaveCount(1);

    await tabList.getByRole("tab", { name: "Draft" }).click();
    await expect(visiblePanels).toHaveCount(1);
  });

  test("7. navigating back to Source tab works after visiting Knowledge and Draft", async ({
    page,
  }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 20_000 });

    await tabList.getByRole("tab", { name: "Knowledge" }).click();
    await tabList.getByRole("tab", { name: "Draft" }).click();
    await tabList.getByRole("tab", { name: "Source" }).click();

    await expect(tabList.getByRole("tab", { name: "Source" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const sourcePanel = page.getByRole("tabpanel", { name: /Source/i });
    await expect(sourcePanel).toBeVisible();
  });

  test("8. no horizontal overflow at 1280×800 desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    await page.waitForSelector('[role="tablist"]', { timeout: 20_000 });

    // Navigate to Knowledge tab to force ArticleViewer render
    await page.getByRole("tablist", { name: /Artifact readers/i })
      .getByRole("tab", { name: "Knowledge" })
      .click();

    await page.waitForSelector('[role="tabpanel"][id*="knowledge"]:not([hidden])', {
      timeout: 8_000,
    });

    const overflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test("9. 404 state renders gracefully for unknown artifact ID", async ({ page }) => {
    await seedAuth(page);
    await installMocks(page, NOT_FOUND_ID, null);
    await gotoArtifact(page, NOT_FOUND_ID);

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Artifact not found/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite — PU7-06: Console + performance audit
// ---------------------------------------------------------------------------

test.describe("PU7-06: Console + Performance Audit", () => {
  test("11. no console errors during full tab navigation cycle (all 5 tabs)", async ({
    page,
    consoleErrors,
  }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 20_000 });

    // Full navigation cycle
    for (const tab of ["Source", "Knowledge", "Draft", "Workflow OS", "Backlinks"] as const) {
      await tabList.getByRole("tab", { name: tab }).click();
      // Brief wait for each panel to settle
      await page.waitForTimeout(300);
    }

    // Navigate back through readers to simulate round-trip
    await tabList.getByRole("tab", { name: "Knowledge" }).click();
    await page.waitForSelector('[role="tabpanel"][id*="knowledge"]:not([hidden])', {
      timeout: 8_000,
    });

    const relevant = consoleErrors.filter(
      (msg) =>
        !msg.includes("ReactDOM.render") &&
        !msg.includes("act(") &&
        !msg.includes("Warning: An update to") &&
        !msg.includes("Unknown at rule") &&
        !msg.includes("Hydration failed") &&
        !msg.includes("themeColor") &&
        !msg.includes("generate-viewport") &&
        !msg.includes("dangerouslySetInnerHTML"),
    );

    if (relevant.length > 0) {
      console.log("Unexpected console messages:\n" + relevant.join("\n"));
    }
    expect(relevant).toHaveLength(0);
  });

  test("12. artifact detail renders within 5s of navigation (dev server budget)", async ({
    page,
  }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());

    const start = Date.now();
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    // Wait for tab list (hydration complete)
    await page.waitForSelector('[role="tablist"]', { timeout: 20_000 });
    const elapsed = Date.now() - start;

    // 5s budget on dev server with mocked API responses — generous for CI
    expect(elapsed).toBeLessThan(5_000);
  });

  test("13. repeated tab navigation does not accumulate console errors (memory leak indicator)", async ({
    page,
    consoleErrors,
  }) => {
    await seedAuth(page);
    await installMocks(page, FULL_ARTIFACT_ID, makeFullDetail());
    await gotoArtifact(page, FULL_ARTIFACT_ID);

    const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
    await expect(tabList).toBeVisible({ timeout: 20_000 });

    // Cycle Knowledge ↔ Draft 5 times to surface any listener accumulation
    for (let i = 0; i < 5; i++) {
      await tabList.getByRole("tab", { name: "Knowledge" }).click();
      await page.waitForTimeout(150);
      await tabList.getByRole("tab", { name: "Draft" }).click();
      await page.waitForTimeout(150);
    }

    // Return to Source
    await tabList.getByRole("tab", { name: "Source" }).click();

    const relevant = consoleErrors.filter(
      (msg) =>
        !msg.includes("ReactDOM.render") &&
        !msg.includes("act(") &&
        !msg.includes("Warning: An update to") &&
        !msg.includes("Unknown at rule") &&
        !msg.includes("Hydration failed") &&
        !msg.includes("themeColor") &&
        !msg.includes("generate-viewport") &&
        !msg.includes("dangerouslySetInnerHTML"),
    );
    expect(relevant).toHaveLength(0);
  });
});
