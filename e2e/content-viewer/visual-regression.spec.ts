/**
 * PU7-04 — Visual Regression Tests (ArticleViewer Baseline Capture)
 *
 * Absorbs the deferred PU6-06 baseline capture task. This spec:
 *
 *   1. Captures baseline snapshots of the Knowledge Reader with ArticleViewer
 *      on the first run (`--update-snapshots`).
 *   2. Subsequent runs compare rendered output against stored baselines.
 *   3. Validates Knowledge Reader, Draft Reader, and empty-state screens.
 *
 * Snapshot locations (Playwright default):
 *   e2e/content-viewer/visual-regression.spec.ts-snapshots/
 *   (one per project name, e.g. knowledge-reader-chromium.png)
 *
 * Update baselines when ArticleViewer output intentionally changes:
 *   pnpm playwright test e2e/content-viewer/visual-regression.spec.ts --update-snapshots
 *
 * Threshold: maxDiffPixelRatio = 0.02 (2% pixel tolerance) to accommodate
 * minor anti-aliasing and font-rendering differences across environments.
 * Set PLAYWRIGHT_SNAPSHOT_THRESHOLD=0 to enforce pixel-perfect in CI.
 *
 * Mocking strategy: page.route() interception — fully offline, no backend.
 * Auth: portal_session seeded before each test.
 *
 * Viewport: 1280×800 for all snapshot captures (stable, desktop baseline).
 * Mobile snapshots deferred to the PWA/mobile test suite.
 *
 * Tests:
 *   1. Knowledge Reader — markdown article (headings, GFM table, code block)
 *   2. Knowledge Reader — HTML content (structural elements)
 *   3. Knowledge Reader — empty state (no compiled_content)
 *   4. Draft Reader — markdown synthesis draft
 *   5. Draft Reader — empty state (no draft_content)
 *   6. Knowledge + Draft side-by-side navigation (two snapshots in one test)
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture IDs + content
// ---------------------------------------------------------------------------

const VR_MARKDOWN_ID = "01PU704000000000000000MKDN";
const VR_HTML_ID = "01PU704000000000000000HTML";
const VR_EMPTY_KNOW_ID = "01PU704000000000000000EKNW";
const VR_DRAFT_ID = "01PU704000000000000000DRFT";
const VR_EMPTY_DRAFT_ID = "01PU704000000000000000EDFT";
const VR_BOTH_ID = "01PU704000000000000000BOTH";

const MARKDOWN_CONTENT = `# ArticleViewer Baseline

A paragraph with **bold**, _italic_, and \`inline code\`.

## GFM Table

| Column A | Column B | Column C |
|:---------|:--------:|----------:|
| Left     | Center   | Right     |
| Alpha    | Beta     | Gamma     |

## Code Block

\`\`\`typescript
interface ArtifactViewer {
  content: string;
  format: 'auto' | 'html' | 'markdown';
  sanitize: boolean;
}
\`\`\`

## Task List

- [x] Baseline captured
- [x] ArticleViewer integrated
- [ ] Visual regressions monitored
`;

const HTML_CONTENT = `<h1>HTML Baseline</h1>
<p>A paragraph with <strong>bold</strong> and <em>italic</em> content.</p>
<ul>
  <li>Unordered item one</li>
  <li>Unordered item two</li>
</ul>
<blockquote>
  <p>A blockquote for visual baseline comparison.</p>
</blockquote>`;

const DRAFT_CONTENT = `# Draft Synthesis Baseline

This is the **draft content** baseline for visual regression.

## Key Points

1. First synthesis insight
2. Second synthesis insight
3. Third synthesis insight

> A notable quote from the source material.
`;

// ---------------------------------------------------------------------------
// Snapshot threshold
// ---------------------------------------------------------------------------

const MAX_DIFF = parseFloat(process.env.PLAYWRIGHT_SNAPSHOT_THRESHOLD ?? "0.02");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDetail(overrides: {
  id: string;
  compiled_content: string | null;
  draft_content?: string | null;
}) {
  return {
    id: overrides.id,
    workspace: "library",
    type: "concept",
    subtype: null,
    title: "Visual Regression Test Artifact",
    status: "active",
    schema_version: "1.0",
    created: "2026-04-01T10:00:00Z",
    updated: "2026-04-23T12:00:00Z",
    file_path: "wiki/concepts/vr-test.md",
    slug: "vr-test",
    summary: "PU7-04 visual regression baseline fixture.",
    content_hash: "sha256:pu704",
    frontmatter_jsonb: { tags: ["visual-test"] },
    raw_content: "# Raw placeholder",
    compiled_content: overrides.compiled_content,
    draft_content: overrides.draft_content ?? null,
    artifact_edges: [],
    metadata: { fidelity: "high", freshness: "current", verification_state: "verified" },
  };
}

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
  detail: ReturnType<typeof makeDetail>,
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
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail),
      });
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

async function gotoAndWaitForTabList(page: Page, id: string): Promise<void> {
  await page.goto(`/artifact/${id}`);
  await page.waitForSelector('[role="tablist"]', { timeout: 20_000 });
}

async function activateTab(page: Page, tabName: string): Promise<void> {
  const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
  await tabList.getByRole("tab", { name: tabName }).click();
  // Wait for the panel to become visible (not hidden attr)
  const slug = tabName.toLowerCase().replace(/\s+/g, "-");
  await page.waitForSelector(`[role="tabpanel"][id*="${slug}"]:not([hidden])`, {
    timeout: 8_000,
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe("PU7-04: Visual Regression — ArticleViewer Baseline", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // ── 1. Knowledge Reader — markdown article ────────────────────────────────

  test("1. Knowledge Reader markdown baseline snapshot", async ({ page }) => {
    const detail = makeDetail({ id: VR_MARKDOWN_ID, compiled_content: MARKDOWN_CONTENT });
    await seedAuth(page);
    await installMocks(page, VR_MARKDOWN_ID, detail);
    await gotoAndWaitForTabList(page, VR_MARKDOWN_ID);
    await activateTab(page, "Knowledge");

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    // Wait for ArticleViewer to fully render (GFM table is a reliable signal)
    await expect(panel.locator("table")).toBeVisible({ timeout: 10_000 });

    await expect(panel).toHaveScreenshot("knowledge-reader-markdown.png", {
      maxDiffPixelRatio: MAX_DIFF,
    });
  });

  // ── 2. Knowledge Reader — HTML content ───────────────────────────────────

  test("2. Knowledge Reader HTML content baseline snapshot", async ({ page }) => {
    const detail = makeDetail({ id: VR_HTML_ID, compiled_content: HTML_CONTENT });
    await seedAuth(page);
    await installMocks(page, VR_HTML_ID, detail);
    await gotoAndWaitForTabList(page, VR_HTML_ID);
    await activateTab(page, "Knowledge");

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    await expect(panel.locator("blockquote")).toBeVisible({ timeout: 10_000 });

    await expect(panel).toHaveScreenshot("knowledge-reader-html.png", {
      maxDiffPixelRatio: MAX_DIFF,
    });
  });

  // ── 3. Knowledge Reader — empty state ────────────────────────────────────

  test("3. Knowledge Reader empty state baseline snapshot", async ({ page }) => {
    const detail = makeDetail({ id: VR_EMPTY_KNOW_ID, compiled_content: null });
    await seedAuth(page);
    await installMocks(page, VR_EMPTY_KNOW_ID, detail);
    await gotoAndWaitForTabList(page, VR_EMPTY_KNOW_ID);
    await activateTab(page, "Knowledge");

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    await expect(panel.getByRole("status")).toBeVisible({ timeout: 10_000 });

    await expect(panel).toHaveScreenshot("knowledge-reader-empty.png", {
      maxDiffPixelRatio: MAX_DIFF,
    });
  });

  // ── 4. Draft Reader — markdown synthesis ─────────────────────────────────

  test("4. Draft Reader markdown baseline snapshot", async ({ page }) => {
    const detail = makeDetail({
      id: VR_DRAFT_ID,
      compiled_content: "<p>Compiled placeholder.</p>",
      draft_content: DRAFT_CONTENT,
    });
    await seedAuth(page);
    await installMocks(page, VR_DRAFT_ID, detail);
    await gotoAndWaitForTabList(page, VR_DRAFT_ID);
    await activateTab(page, "Draft");

    const panel = page.getByRole("tabpanel", { name: /Draft/i });
    await expect(panel.locator("h1", { hasText: "Draft Synthesis Baseline" })).toBeVisible({
      timeout: 10_000,
    });

    await expect(panel).toHaveScreenshot("draft-reader-markdown.png", {
      maxDiffPixelRatio: MAX_DIFF,
    });
  });

  // ── 5. Draft Reader — empty state ────────────────────────────────────────

  test("5. Draft Reader empty state baseline snapshot", async ({ page }) => {
    const detail = makeDetail({
      id: VR_EMPTY_DRAFT_ID,
      compiled_content: "<p>Compiled content exists.</p>",
      draft_content: null,
    });
    await seedAuth(page);
    await installMocks(page, VR_EMPTY_DRAFT_ID, detail);
    await gotoAndWaitForTabList(page, VR_EMPTY_DRAFT_ID);
    await activateTab(page, "Draft");

    const panel = page.getByRole("tabpanel", { name: /Draft/i });
    await expect(panel.getByRole("status")).toBeVisible({ timeout: 10_000 });

    await expect(panel).toHaveScreenshot("draft-reader-empty.png", {
      maxDiffPixelRatio: MAX_DIFF,
    });
  });

  // ── 6. Knowledge → Draft navigation (two panels, one test) ───────────────

  test("6. Knowledge and Draft readers match baseline after tab switch", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: VR_BOTH_ID,
      compiled_content: MARKDOWN_CONTENT,
      draft_content: DRAFT_CONTENT,
    });
    await seedAuth(page);
    await installMocks(page, VR_BOTH_ID, detail);
    await gotoAndWaitForTabList(page, VR_BOTH_ID);

    // Snapshot Knowledge tab
    await activateTab(page, "Knowledge");
    const knowledgePanel = page.getByRole("tabpanel", { name: /Knowledge/i });
    await expect(knowledgePanel.locator("table")).toBeVisible({ timeout: 10_000 });
    await expect(knowledgePanel).toHaveScreenshot("knowledge-after-navigation.png", {
      maxDiffPixelRatio: MAX_DIFF,
    });

    // Switch to Draft and snapshot
    await activateTab(page, "Draft");
    const draftPanel = page.getByRole("tabpanel", { name: /Draft/i });
    await expect(draftPanel.locator("h1", { hasText: "Draft Synthesis Baseline" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(draftPanel).toHaveScreenshot("draft-after-navigation.png", {
      maxDiffPixelRatio: MAX_DIFF,
    });
  });
});
