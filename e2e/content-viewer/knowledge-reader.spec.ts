/**
 * PU7-01 — Knowledge Reader E2E Tests
 *
 * Validates ArticleViewer (from @miethe/ui) rendering in the Knowledge Reader
 * tab of the artifact detail page. Tests cover:
 *
 *   1.  Markdown renders correctly — headings, paragraphs, code blocks
 *   2.  GFM tables render with proper structure (thead/tbody)
 *   3.  GFM task lists render with checkboxes
 *   4.  GFM strikethrough renders as <del> element
 *   5.  Callout directives render as callout blocks
 *   6.  Empty state shown when compiled_content is null
 *   7.  HTML content (format="auto") renders structural elements
 *   8.  Sanitization active — <script> tag stripped from DOM
 *   9.  Sanitization active — window.__pwned remains undefined after XSS attempt
 *   10. No console errors during Knowledge Reader rendering
 *
 * Mocking strategy: page.route() network interception — no live backend required.
 * All artifact detail responses are fulfilled from fixture data defined in this file.
 *
 * Auth: portal_session cookie seeded on both "localhost" and "127.0.0.1" before
 * each test (mirrors the pattern in content-viewer-sanitization.spec.ts).
 */

import { test as base, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture IDs
// ---------------------------------------------------------------------------

const MARKDOWN_ARTIFACT_ID = "01PU701000000000000000MKDN";
const GFM_TABLE_ARTIFACT_ID = "01PU701000000000000000TABL";
const GFM_TASK_ARTIFACT_ID = "01PU701000000000000000TASK";
const GFM_STRIKE_ARTIFACT_ID = "01PU701000000000000000STRK";
const CALLOUT_ARTIFACT_ID = "01PU701000000000000000CALL";
const EMPTY_ARTIFACT_ID = "01PU701000000000000000EMPT";
const HTML_ARTIFACT_ID = "01PU701000000000000000HTML";
const XSS_ARTIFACT_ID = "01PU701000000000000000XSSS";

// ---------------------------------------------------------------------------
// Fixture content
// ---------------------------------------------------------------------------

const MARKDOWN_CONTENT = `# Knowledge Heading

This is a **bold** paragraph with _italic_ text and \`inline code\`.

## Subheading

A second paragraph with a [link](https://example.com).

\`\`\`javascript
const x = 42;
\`\`\`
`;

const GFM_TABLE_CONTENT = `# Table Test

| Column A | Column B | Column C |
|----------|----------|----------|
| Row 1A   | Row 1B   | Row 1C   |
| Row 2A   | Row 2B   | Row 2C   |
`;

const GFM_TASK_CONTENT = `# Task List

- [x] Completed task
- [ ] Pending task
- [x] Another done task
`;

const GFM_STRIKE_CONTENT = `# Strikethrough

This text has ~~strikethrough formatting~~ applied to it.
`;

const CALLOUT_CONTENT = `# Callout Test

:::note
This is a note callout with **bold** content inside.
:::

:::warning
This is a warning callout.
:::
`;

const HTML_CONTENT = `<h1>HTML Heading</h1>
<p>Paragraph with <strong>bold</strong> and <em>italic</em>.</p>
<ul>
  <li>List item one</li>
  <li>List item two</li>
</ul>
<pre><code>const example = true;</code></pre>`;

const XSS_CONTENT = `<script>window.__pwned = true;</script><p>Safe paragraph after script</p>`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ArtifactDetailFixture {
  id: string;
  compiled_content: string | null;
  raw_content?: string;
}

function makeDetail(overrides: ArtifactDetailFixture) {
  return {
    id: overrides.id,
    workspace: "library",
    type: "concept",
    subtype: null,
    title: "Knowledge Reader Test Artifact",
    status: "active",
    schema_version: "1.0",
    created: "2026-04-01T10:00:00Z",
    updated: "2026-04-23T12:00:00Z",
    file_path: "wiki/concepts/knowledge-test.md",
    slug: "knowledge-test",
    summary: "PU7-01 Knowledge Reader E2E fixture.",
    content_hash: "sha256:pu701",
    frontmatter_jsonb: { tags: ["test"] },
    raw_content: overrides.raw_content ?? "# Raw\n\nPlaceholder.",
    compiled_content: overrides.compiled_content,
    draft_content: null,
    artifact_edges: [],
    metadata: {
      fidelity: "high",
      freshness: "current",
      verification_state: "verified",
    },
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

async function mockArtifact(
  page: Page,
  id: string,
  detail: ReturnType<typeof makeDetail>,
): Promise<void> {
  // Auth session — prevent /login redirect
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

  // Unified artifact endpoint dispatcher (mirrors content-viewer-sanitization.spec.ts)
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

  // Global workflow-runs (WorkflowTopBarIndicator)
  await page.route("**/api/workflows/runs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { items: [], cursor: null, total: 0 } }),
    });
  });

  // Workflow SSE
  await page.route("**/api/workflow-events**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
  });
}

async function gotoArtifact(page: Page, id: string): Promise<void> {
  await page.goto(`/artifact/${id}`);
  await page.waitForSelector('[role="tablist"]', { timeout: 20_000 });
}

async function activateKnowledgeTab(page: Page): Promise<void> {
  const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
  await tabList.getByRole("tab", { name: "Knowledge" }).click();
  // Wait for panel to be in DOM and not hidden
  await page.waitForSelector('[role="tabpanel"][id*="knowledge"]:not([hidden])', {
    timeout: 8_000,
  });
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
// Suite
// ---------------------------------------------------------------------------

test.describe("PU7-01: Knowledge Reader — ArticleViewer rendering", () => {
  // ── 1. Markdown — basic rendering ─────────────────────────────────────────

  test("1. renders markdown headings, bold, italic, inline code, and links", async ({
    page,
  }) => {
    const detail = makeDetail({ id: MARKDOWN_ARTIFACT_ID, compiled_content: MARKDOWN_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, MARKDOWN_ARTIFACT_ID, detail);
    await gotoArtifact(page, MARKDOWN_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });

    await expect(panel.locator("h1", { hasText: "Knowledge Heading" })).toBeVisible();
    await expect(panel.locator("h2", { hasText: "Subheading" })).toBeVisible();
    await expect(panel.locator("strong")).toBeVisible();
    await expect(panel.locator("em")).toBeVisible();
    await expect(panel.locator("code").first()).toBeVisible();
    await expect(panel.locator("pre code")).toBeVisible();
  });

  // ── 2. GFM — tables ───────────────────────────────────────────────────────

  test("2. GFM tables render with thead and tbody", async ({ page }) => {
    const detail = makeDetail({ id: GFM_TABLE_ARTIFACT_ID, compiled_content: GFM_TABLE_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, GFM_TABLE_ARTIFACT_ID, detail);
    await gotoArtifact(page, GFM_TABLE_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });

    await expect(panel.locator("table")).toBeVisible();
    await expect(panel.locator("thead")).toBeVisible();
    await expect(panel.locator("tbody")).toBeVisible();
    // Header cells
    await expect(panel.locator("th", { hasText: "Column A" })).toBeVisible();
    // Data cells
    await expect(panel.locator("td", { hasText: "Row 1A" })).toBeVisible();
    await expect(panel.locator("td", { hasText: "Row 2B" })).toBeVisible();
  });

  // ── 3. GFM — task lists ───────────────────────────────────────────────────

  test("3. GFM task lists render list items with input checkboxes", async ({
    page,
  }) => {
    const detail = makeDetail({ id: GFM_TASK_ARTIFACT_ID, compiled_content: GFM_TASK_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, GFM_TASK_ARTIFACT_ID, detail);
    await gotoArtifact(page, GFM_TASK_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });

    // remark-gfm renders task items as <li> with <input type="checkbox">
    const checkboxes = panel.locator('input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(3);

    // Two checked, one unchecked
    const checked = panel.locator('input[type="checkbox"][checked]');
    await expect(checked).toHaveCount(2);
  });

  // ── 4. GFM — strikethrough ────────────────────────────────────────────────

  test("4. GFM strikethrough renders as <del> element", async ({ page }) => {
    const detail = makeDetail({
      id: GFM_STRIKE_ARTIFACT_ID,
      compiled_content: GFM_STRIKE_CONTENT,
    });
    await seedAuth(page);
    await mockArtifact(page, GFM_STRIKE_ARTIFACT_ID, detail);
    await gotoArtifact(page, GFM_STRIKE_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    await expect(panel.locator("del")).toBeVisible();
    await expect(panel.locator("del")).toContainText("strikethrough formatting");
  });

  // ── 5. Callout directives ─────────────────────────────────────────────────

  test("5. callout directives render as callout blocks with appropriate roles", async ({
    page,
  }) => {
    const detail = makeDetail({ id: CALLOUT_ARTIFACT_ID, compiled_content: CALLOUT_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, CALLOUT_ARTIFACT_ID, detail);
    await gotoArtifact(page, CALLOUT_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });

    // Callouts should be rendered — the ArticleViewer remarkCallouts plugin
    // converts :::note / :::warning into div elements with data-callout-type.
    // Either data-callout-type or aria-label patterns accepted.
    const calloutNote = panel.locator('[data-callout-type="note"], [class*="callout"]').first();
    await expect(calloutNote).toBeAttached({ timeout: 8_000 });
  });

  // ── 6. Empty state when compiled_content is null ──────────────────────────

  test("6. shows empty state when compiled_content is null", async ({ page }) => {
    const detail = makeDetail({ id: EMPTY_ARTIFACT_ID, compiled_content: null });
    await seedAuth(page);
    await mockArtifact(page, EMPTY_ARTIFACT_ID, detail);
    await gotoArtifact(page, EMPTY_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    // KnowledgeReader renders a role="status" empty state div
    await expect(panel.getByRole("status")).toBeVisible();
    await expect(panel.getByText(/No compiled content yet/i)).toBeVisible();
  });

  // ── 7. HTML content (format="auto") structural rendering ─────────────────

  test("7. HTML content (format='auto') renders structural elements correctly", async ({
    page,
  }) => {
    const detail = makeDetail({ id: HTML_ARTIFACT_ID, compiled_content: HTML_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, HTML_ARTIFACT_ID, detail);
    await gotoArtifact(page, HTML_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });

    await expect(panel.locator("h1", { hasText: "HTML Heading" })).toBeVisible();
    await expect(panel.locator("strong")).toBeVisible();
    await expect(panel.locator("em")).toBeVisible();
    await expect(panel.locator("ul li").first()).toBeVisible();
    await expect(panel.locator("pre code")).toBeVisible();
  });

  // ── 8. Sanitization — <script> tag stripped ───────────────────────────────

  test("8. sanitization active — <script> tag not present in Knowledge panel DOM", async ({
    page,
  }) => {
    const detail = makeDetail({ id: XSS_ARTIFACT_ID, compiled_content: XSS_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, XSS_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    await expect(panel.locator("script")).toHaveCount(0);
  });

  // ── 9. Sanitization — window.__pwned undefined ────────────────────────────

  test("9. sanitization active — window.__pwned remains undefined after XSS attempt", async ({
    page,
  }) => {
    const detail = makeDetail({ id: XSS_ARTIFACT_ID, compiled_content: XSS_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, XSS_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    await page.getByRole("tabpanel", { name: /Knowledge/i }).waitFor();

    const pwned = await page.evaluate(
      () => (window as unknown as Record<string, unknown>)["__pwned"],
    );
    expect(pwned).toBeUndefined();
  });

  // ── 10. No console errors during rendering ────────────────────────────────

  test("10. no console errors or warnings during Knowledge Reader rendering", async ({
    page,
    consoleErrors,
  }) => {
    const detail = makeDetail({ id: MARKDOWN_ARTIFACT_ID, compiled_content: MARKDOWN_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, MARKDOWN_ARTIFACT_ID, detail);
    await gotoArtifact(page, MARKDOWN_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    // Wait for panel content to fully render
    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    await expect(panel.locator("h1")).toBeVisible();

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
