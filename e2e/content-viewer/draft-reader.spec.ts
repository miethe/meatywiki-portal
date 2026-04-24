/**
 * PU7-02 — Draft Reader E2E Tests
 *
 * Validates ArticleViewer (from @miethe/ui) rendering in the Draft Reader tab
 * of the artifact detail page. Tests cover:
 *
 *   1.  Markdown content renders correctly (headings, paragraphs, emphasis)
 *   2.  Frontmatter is hidden (frontmatter="hide") — no YAML block in output
 *   3.  Frontmatter content stripped — title/date keys not rendered as visible text
 *   4.  Empty state shown when draft_content is null
 *   5.  Empty state shown when draft_content is undefined (missing from response)
 *   6.  HTML content renders structural elements
 *   7.  Sanitization active — <script> tag stripped from Draft panel DOM
 *   8.  Sanitization active — window.__pwned remains undefined (Draft path)
 *   9.  No dangerouslySetInnerHTML React warnings in console
 *   10. No console errors during Draft Reader rendering
 *
 * Mocking strategy: page.route() network interception — no live backend required.
 */

import { test as base, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture IDs
// ---------------------------------------------------------------------------

const DRAFT_MARKDOWN_ID = "01PU702000000000000000MKDN";
const DRAFT_FRONTMATTER_ID = "01PU702000000000000000FMTR";
const DRAFT_EMPTY_NULL_ID = "01PU702000000000000000ENUL";
const DRAFT_EMPTY_UNDEF_ID = "01PU702000000000000000EUND";
const DRAFT_HTML_ID = "01PU702000000000000000HTML";
const DRAFT_XSS_ID = "01PU702000000000000000XSSS";

// ---------------------------------------------------------------------------
// Fixture content
// ---------------------------------------------------------------------------

const DRAFT_MARKDOWN_CONTENT = `# Draft Synthesis Title

This draft has **bold text**, _italic emphasis_, and a list:

- Item alpha
- Item beta
- Item gamma

## Draft Subheading

A code snippet inline: \`const draft = true;\`
`;

// Content with YAML frontmatter that must be hidden in the Draft Reader.
const DRAFT_WITH_FRONTMATTER = `---
title: "Draft Article Title"
date: "2026-04-23"
status: draft
tags:
  - research
  - synthesis
---

# Body Heading

The body content appears here. The frontmatter block above must not be visible
in the rendered output when frontmatter="hide" is active.
`;

const DRAFT_HTML_CONTENT = `<h1>Draft HTML</h1>
<p>HTML draft with <strong>bold</strong> formatting.</p>
<ol>
  <li>First step</li>
  <li>Second step</li>
</ol>`;

const DRAFT_XSS_CONTENT = `<script>window.__pwned = true;</script><p>Draft safe paragraph</p>`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DetailOverrides {
  id: string;
  draft_content: string | null | undefined;
  compiled_content?: string | null;
}

function makeDetail(overrides: DetailOverrides) {
  return {
    id: overrides.id,
    workspace: "library",
    type: "concept",
    subtype: null,
    title: "Draft Reader Test Artifact",
    status: "draft",
    schema_version: "1.0",
    created: "2026-04-01T10:00:00Z",
    updated: "2026-04-23T12:00:00Z",
    file_path: "wiki/concepts/draft-test.md",
    slug: "draft-test",
    summary: "PU7-02 Draft Reader E2E fixture.",
    content_hash: "sha256:pu702",
    frontmatter_jsonb: { tags: ["test"] },
    raw_content: "# Raw\n\nPlaceholder.",
    compiled_content: overrides.compiled_content ?? "<p>Compiled placeholder.</p>",
    draft_content: overrides.draft_content,
    artifact_edges: [],
    metadata: {
      fidelity: "medium",
      freshness: "current",
      verification_state: "unverified",
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

async function gotoArtifact(page: Page, id: string): Promise<void> {
  await page.goto(`/artifact/${id}`);
  await page.waitForSelector('[role="tablist"]', { timeout: 20_000 });
}

async function activateDraftTab(page: Page): Promise<void> {
  const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
  await tabList.getByRole("tab", { name: "Draft" }).click();
  await page.waitForSelector('[role="tabpanel"][id*="draft"]:not([hidden])', {
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

test.describe("PU7-02: Draft Reader — ArticleViewer rendering", () => {
  // ── 1. Markdown content renders ───────────────────────────────────────────

  test("1. draft markdown renders headings, bold, italic, lists, and inline code", async ({
    page,
  }) => {
    const detail = makeDetail({ id: DRAFT_MARKDOWN_ID, draft_content: DRAFT_MARKDOWN_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_MARKDOWN_ID, detail);
    await gotoArtifact(page, DRAFT_MARKDOWN_ID);
    await activateDraftTab(page);

    const panel = page.getByRole("tabpanel", { name: /Draft/i });

    await expect(panel.locator("h1", { hasText: "Draft Synthesis Title" })).toBeVisible();
    await expect(panel.locator("h2", { hasText: "Draft Subheading" })).toBeVisible();
    await expect(panel.locator("strong")).toBeVisible();
    await expect(panel.locator("em")).toBeVisible();
    await expect(panel.locator("ul li").first()).toBeVisible();
    await expect(panel.locator("code")).toBeVisible();
  });

  // ── 2. Frontmatter hidden — YAML block not rendered ───────────────────────

  test("2. frontmatter block is not rendered in the Draft panel (frontmatter='hide')", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: DRAFT_FRONTMATTER_ID,
      draft_content: DRAFT_WITH_FRONTMATTER,
    });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_FRONTMATTER_ID, detail);
    await gotoArtifact(page, DRAFT_FRONTMATTER_ID);
    await activateDraftTab(page);

    const panel = page.getByRole("tabpanel", { name: /Draft/i });

    // The body content is rendered
    await expect(panel.locator("h1", { hasText: "Body Heading" })).toBeVisible();

    // The raw YAML delimiters must not appear as visible text
    await expect(panel.getByText("---")).not.toBeVisible();
  });

  // ── 3. Frontmatter keys not leaked into rendered output ───────────────────

  test("3. frontmatter key/value pairs are not visible in the rendered body", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: DRAFT_FRONTMATTER_ID,
      draft_content: DRAFT_WITH_FRONTMATTER,
    });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_FRONTMATTER_ID, detail);
    await gotoArtifact(page, DRAFT_FRONTMATTER_ID);
    await activateDraftTab(page);

    const panel = page.getByRole("tabpanel", { name: /Draft/i });

    // The YAML values for title/date must not appear as rendered text inside
    // the markdown body. gray-matter strips these before ReactMarkdown sees them.
    await expect(panel.getByText("Draft Article Title")).not.toBeVisible();
    await expect(panel.getByText("2026-04-23")).not.toBeVisible();
  });

  // ── 4. Empty state — draft_content null ──────────────────────────────────

  test("4. shows empty state when draft_content is null", async ({ page }) => {
    const detail = makeDetail({ id: DRAFT_EMPTY_NULL_ID, draft_content: null });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_EMPTY_NULL_ID, detail);
    await gotoArtifact(page, DRAFT_EMPTY_NULL_ID);
    await activateDraftTab(page);

    const panel = page.getByRole("tabpanel", { name: /Draft/i });
    await expect(panel.getByRole("status")).toBeVisible();
    await expect(panel.getByText(/No draft content/i)).toBeVisible();
  });

  // ── 5. Empty state — draft_content undefined ──────────────────────────────

  test("5. shows empty state when draft_content is undefined/absent", async ({
    page,
  }) => {
    const detail = makeDetail({ id: DRAFT_EMPTY_UNDEF_ID, draft_content: undefined });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_EMPTY_UNDEF_ID, detail);
    await gotoArtifact(page, DRAFT_EMPTY_UNDEF_ID);
    await activateDraftTab(page);

    const panel = page.getByRole("tabpanel", { name: /Draft/i });
    await expect(panel.getByRole("status")).toBeVisible();
    await expect(panel.getByText(/No draft content/i)).toBeVisible();
  });

  // ── 6. HTML content structural rendering ─────────────────────────────────

  test("6. HTML draft content renders structural elements correctly", async ({
    page,
  }) => {
    const detail = makeDetail({ id: DRAFT_HTML_ID, draft_content: DRAFT_HTML_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_HTML_ID, detail);
    await gotoArtifact(page, DRAFT_HTML_ID);
    await activateDraftTab(page);

    const panel = page.getByRole("tabpanel", { name: /Draft/i });

    await expect(panel.locator("h1", { hasText: "Draft HTML" })).toBeVisible();
    await expect(panel.locator("strong")).toBeVisible();
    await expect(panel.locator("ol li").first()).toBeVisible();
  });

  // ── 7. Sanitization — script tag stripped ────────────────────────────────

  test("7. <script> tag is not present in Draft panel DOM when draft_content contains XSS", async ({
    page,
  }) => {
    const detail = makeDetail({ id: DRAFT_XSS_ID, draft_content: DRAFT_XSS_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_XSS_ID, detail);
    await gotoArtifact(page, DRAFT_XSS_ID);
    await activateDraftTab(page);

    const panel = page.getByRole("tabpanel", { name: /Draft/i });
    await expect(panel.locator("script")).toHaveCount(0);
  });

  // ── 8. Sanitization — window.__pwned undefined ────────────────────────────

  test("8. window.__pwned remains undefined after XSS attempt in Draft Reader", async ({
    page,
  }) => {
    const detail = makeDetail({ id: DRAFT_XSS_ID, draft_content: DRAFT_XSS_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_XSS_ID, detail);
    await gotoArtifact(page, DRAFT_XSS_ID);
    await activateDraftTab(page);

    await page.getByRole("tabpanel", { name: /Draft/i }).waitFor();

    const pwned = await page.evaluate(
      () => (window as unknown as Record<string, unknown>)["__pwned"],
    );
    expect(pwned).toBeUndefined();
  });

  // ── 9. No dangerouslySetInnerHTML React warnings ──────────────────────────

  test("9. no dangerouslySetInnerHTML React warnings in console during Draft rendering", async ({
    page,
    consoleErrors,
  }) => {
    const detail = makeDetail({ id: DRAFT_MARKDOWN_ID, draft_content: DRAFT_MARKDOWN_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_MARKDOWN_ID, detail);
    await gotoArtifact(page, DRAFT_MARKDOWN_ID);
    await activateDraftTab(page);

    await page.getByRole("tabpanel", { name: /Draft/i }).waitFor();

    // Specifically assert no dangerouslySetInnerHTML warnings — this was the
    // ArtifactBody anti-pattern that PU6-04 removed.
    const dshWarnings = consoleErrors.filter((msg) =>
      msg.toLowerCase().includes("dangerouslysetinnerhtml"),
    );
    expect(dshWarnings).toHaveLength(0);
  });

  // ── 10. No console errors during Draft rendering ──────────────────────────

  test("10. no console errors or warnings during Draft Reader rendering", async ({
    page,
    consoleErrors,
  }) => {
    const detail = makeDetail({ id: DRAFT_MARKDOWN_ID, draft_content: DRAFT_MARKDOWN_CONTENT });
    await seedAuth(page);
    await mockArtifact(page, DRAFT_MARKDOWN_ID, detail);
    await gotoArtifact(page, DRAFT_MARKDOWN_ID);
    await activateDraftTab(page);

    const panel = page.getByRole("tabpanel", { name: /Draft/i });
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
