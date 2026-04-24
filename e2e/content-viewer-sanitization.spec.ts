/**
 * P6-05 — Content-Viewer Sanitization E2E Suite
 *
 * Verifies that ArtifactBody's DOMPurify gate (P6-03/P6-04) strips XSS vectors
 * in the Knowledge and Draft reader tabs before they reach the DOM.
 *
 * Mocking strategy: page.route() network interception (same pattern as
 * e2e/support/research-mocks.ts, established in P4-11). All artifact detail
 * responses are fulfilled from fixture data; no live backend is required. The
 * suite does NOT use skipIfBackendDown — it runs fully offline.
 *
 * Auth: portal_session cookie is seeded on both "localhost" and "127.0.0.1"
 * before each test (mirrors installResearchMocks auth approach). No backend
 * reachability check needed.
 *
 * PORTAL_ALLOW_NETWORK / PORTAL_DISABLE_AUTH: neither env var affects this
 * suite. Sanitization happens client-side in ArtifactBody regardless of
 * backend network policy. CI can run this suite without those vars set.
 *
 * Test count: 10
 *   1.  [Knowledge] safe HTML — structural elements preserved
 *   2.  [Knowledge] script tag stripped from DOM
 *   3.  [Knowledge] window.__pwned remains undefined after script-bearing content
 *   4.  [Knowledge] safe paragraph text visible alongside stripped script
 *   5.  [Knowledge] inline onerror handler stripped (window.__xss undefined)
 *   6.  [Knowledge] javascript: href neutralised on anchor
 *   7.  [Draft]     script tag stripped in Draft tab
 *   8.  [Draft]     window.__pwned remains undefined in Draft tab path
 *   9.  [All tabs]  no console.error during safe-HTML artifact navigation
 *   10. [All tabs]  no console.error during script-bearing artifact navigation
 */

import { test as base, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAFE_ARTIFACT_ID = "01SANITIZE000000000000SAFE";
const XSS_SCRIPT_ARTIFACT_ID = "01SANITIZE000000000000SCRP";
const XSS_HANDLER_ARTIFACT_ID = "01SANITIZE000000000000HNDL";
const XSS_HREF_ARTIFACT_ID = "01SANITIZE000000000000HREF";

// Safe HTML that DOMPurify must preserve.
const SAFE_HTML = [
  "<h1>Safe Heading</h1>",
  "<h2>Sub Heading</h2>",
  "<p>Paragraph text with <strong>bold</strong> and <em>italic</em>.</p>",
  '<ul><li>Item one</li><li>Item two</li></ul>',
  '<ol><li>First</li><li>Second</li></ol>',
  '<pre><code>const x = 1;</code></pre>',
  '<a href="https://example.com">External link</a>',
  '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" alt="A safe image">',
  '<table><thead><tr><th>Col A</th><th>Col B</th></tr></thead>',
  '<tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>',
].join("\n");

// Script injection — the <script> block must be stripped.
const SCRIPT_HTML =
  "<script>window.__pwned = true;</script><p>Hello sanitized world</p>";

// Inline event handler — must be stripped by DOMPurify.
const HANDLER_HTML =
  '<img src="x" onerror="window.__xss=1" alt="trigger"><p>Handler test</p>';

// javascript: href — DOMPurify strips/neutralises the href value.
const HREF_HTML =
  '<a href="javascript:alert(1)">Dangerous link</a><p>Href test</p>';

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

interface FixtureOverrides {
  id: string;
  compiled_content: string;
  draft_content?: string | null;
}

function makeDetail(overrides: FixtureOverrides) {
  return {
    id: overrides.id,
    workspace: "library",
    type: "concept",
    subtype: null,
    title: "Sanitization Test Artifact",
    status: "active",
    schema_version: "1.0",
    created: "2026-04-01T10:00:00Z",
    updated: "2026-04-23T12:00:00Z",
    file_path: "wiki/concepts/sanity-test.md",
    slug: "sanity-test",
    summary: "Used by the P6-05 sanitization E2E suite.",
    content_hash: "sha256:test",
    frontmatter_jsonb: { tags: ["test"] },
    raw_content: "# Raw\n\nRaw content placeholder.",
    compiled_content: overrides.compiled_content,
    draft_content: overrides.draft_content ?? null,
    artifact_edges: [],
    metadata: {
      fidelity: "high",
      freshness: "current",
      verification_state: "verified",
    },
  };
}

// ---------------------------------------------------------------------------
// Network mock installer (lightweight, local to this file)
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

async function mockArtifactDetail(
  page: Page,
  id: string,
  detail: ReturnType<typeof makeDetail>,
): Promise<void> {
  // Auth session — prevent /login redirect from Next.js middleware
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

  // Unified artifact handler — Playwright glob matching can be unreliable when
  // mixing specific patterns with wildcards in the same page context, so we use
  // a single wildcard route and dispatch internally based on URL inspection.
  // This mirrors the pattern in e2e/support/research-mocks.ts (installResearchMocks).
  await page.route("**/api/artifacts/**", async (route) => {
    const method = route.request().method();
    if (method !== "GET") return route.continue();
    const url = route.request().url();
    const parsed = new URL(url);
    const pathname = parsed.pathname; // e.g. /api/artifacts/01SANIT.../edges

    // /api/artifacts/:id/edges
    if (pathname.endsWith("/edges") || pathname.includes("/edges?")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ artifact_id: id, incoming: [], outgoing: [] }),
      });
      return;
    }

    // /api/artifacts/:id/derivatives
    if (pathname.endsWith("/derivatives") || pathname.includes("/derivatives?")) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "not_a_source" }),
      });
      return;
    }

    // /api/artifacts/:id/workflow-runs
    if (pathname.endsWith("/workflow-runs") || pathname.includes("/workflow-runs?")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], cursor: null } }),
      });
      return;
    }

    // /api/artifacts/:id/activity
    if (pathname.endsWith("/activity") || pathname.includes("/activity?")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [], cursor: null } }),
      });
      return;
    }

    // /api/artifacts/:id (plain detail endpoint — no trailing path segment)
    // Returns the artifact detail object directly (no ServiceModeEnvelope wrapper,
    // matching the backend contract documented in src/lib/api/artifacts.ts §getArtifact).
    if (url.includes(id)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(detail),
      });
      return;
    }

    // Any other /api/artifacts/* request — return empty list
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { items: [], cursor: null } }),
    });
  });

  // Global workflow-runs endpoint — polled by WorkflowTopBarIndicator.
  // Must be intercepted before the request leaves the browser (Playwright
  // network interception runs before the browser sends the request to the
  // Next.js dev server, so this prevents the server-side ETIMEDOUT on the
  // backend rewrite). Without this the Next.js proxy hangs 20 s per call.
  await page.route("**/api/workflows/runs**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { items: [], cursor: null, total: 0 } }),
    });
  });

  // Workflow events SSE (global top-bar listener, if any)
  await page.route("**/api/workflow-events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "",
    });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to the artifact detail page and wait for tab list. */
async function gotoArtifact(page: Page, id: string): Promise<void> {
  await page.goto(`/artifact/${id}`);
  // Wait for the tab list to be rendered — confirms the client island is hydrated
  await page.waitForSelector('[role="tablist"]', { timeout: 20_000 });
}

/** Click the Knowledge tab and wait for its panel. */
async function activateKnowledgeTab(page: Page): Promise<void> {
  const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
  await tabList.getByRole("tab", { name: "Knowledge" }).click();
  await page.waitForSelector('[role="tabpanel"][id*="knowledge"]', {
    timeout: 5_000,
  });
}

/** Click the Draft tab and wait for its panel. */
async function activateDraftTab(page: Page): Promise<void> {
  const tabList = page.getByRole("tablist", { name: /Artifact readers/i });
  await tabList.getByRole("tab", { name: "Draft" }).click();
  await page.waitForSelector('[role="tabpanel"][id*="draft"]', {
    timeout: 5_000,
  });
}

// ---------------------------------------------------------------------------
// Extended fixture — captures console errors per test
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

test.describe("Content-Viewer Sanitization (P6-05)", () => {
  // ── 1. Safe HTML — structural elements preserved ──────────────────────────

  test("1. [Knowledge] safe HTML elements are preserved in the rendered DOM", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: SAFE_ARTIFACT_ID,
      compiled_content: SAFE_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, SAFE_ARTIFACT_ID, detail);
    await gotoArtifact(page, SAFE_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });

    // Structural elements DOMPurify must retain
    await expect(panel.locator("h1")).toBeVisible();
    await expect(panel.locator("h2")).toBeVisible();
    await expect(panel.locator("p").first()).toBeVisible();
    await expect(panel.locator("ul li").first()).toBeVisible();
    await expect(panel.locator("ol li").first()).toBeVisible();
    await expect(panel.locator("pre code")).toBeVisible();
    await expect(panel.locator('a[href="https://example.com"]')).toBeVisible();
    await expect(panel.locator("table")).toBeVisible();
    // Image with data-URI src is preserved (data URI used to avoid network request in tests)
    await expect(
      panel.locator('img[alt="A safe image"]'),
    ).toBeAttached();
  });

  // ── 2. Script tag stripped ────────────────────────────────────────────────

  test("2. [Knowledge] <script> tag is NOT present in the rendered DOM", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: XSS_SCRIPT_ARTIFACT_ID,
      compiled_content: SCRIPT_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, XSS_SCRIPT_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_SCRIPT_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });

    // No <script> element anywhere in the Knowledge panel
    await expect(panel.locator("script")).toHaveCount(0);
  });

  // ── 3. window.__pwned undefined ───────────────────────────────────────────

  test("3. [Knowledge] window.__pwned remains undefined after script-bearing content renders", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: XSS_SCRIPT_ARTIFACT_ID,
      compiled_content: SCRIPT_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, XSS_SCRIPT_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_SCRIPT_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    // Give the panel time to fully render before evaluating
    await page.getByRole("tabpanel", { name: /Knowledge/i }).waitFor();

    const pwned = await page.evaluate(() => {
      return (window as unknown as Record<string, unknown>)["__pwned"];
    });
    expect(pwned).toBeUndefined();
  });

  // ── 4. Safe paragraph rendered alongside stripped script ─────────────────

  test("4. [Knowledge] safe <p> text is visible while the script sibling is stripped", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: XSS_SCRIPT_ARTIFACT_ID,
      compiled_content: SCRIPT_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, XSS_SCRIPT_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_SCRIPT_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    await expect(panel.getByText("Hello sanitized world")).toBeVisible();
  });

  // ── 5. Inline event handler stripped ─────────────────────────────────────

  test("5. [Knowledge] onerror inline handler stripped — window.__xss remains undefined", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: XSS_HANDLER_ARTIFACT_ID,
      compiled_content: HANDLER_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, XSS_HANDLER_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_HANDLER_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    // Wait for panel render
    await page.getByRole("tabpanel", { name: /Knowledge/i }).waitFor();

    // The img[onerror] attribute must be absent
    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    const img = panel.locator("img");
    // DOMPurify may keep the img element but must strip the event handler attr
    const onerrorAttr = await img
      .getAttribute("onerror")
      .catch(() => null);
    expect(onerrorAttr).toBeNull();

    // The handler must not have executed
    const xss = await page.evaluate(() => {
      return (window as unknown as Record<string, unknown>)["__xss"];
    });
    expect(xss).toBeUndefined();
  });

  // ── 6. javascript: href stripped ─────────────────────────────────────────

  test("6. [Knowledge] javascript: href is neutralised on the rendered anchor", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: XSS_HREF_ARTIFACT_ID,
      compiled_content: HREF_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, XSS_HREF_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_HREF_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    const panel = page.getByRole("tabpanel", { name: /Knowledge/i });
    const anchor = panel.locator("a", { hasText: "Dangerous link" });

    // Either the anchor is removed entirely, or its href no longer starts with javascript:
    const count = await anchor.count();
    if (count > 0) {
      const href = await anchor.getAttribute("href");
      // href must be null, empty, or not a javascript: URL
      expect(href ?? "").not.toMatch(/^javascript:/i);
    }
    // (count === 0 is also acceptable — DOMPurify may remove the element)
  });

  // ── 7. Draft tab — script tag stripped ───────────────────────────────────

  test("7. [Draft] <script> tag is NOT present when script-bearing content is in draft_content", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: XSS_SCRIPT_ARTIFACT_ID,
      compiled_content: "<p>Compiled content placeholder.</p>",
      draft_content: SCRIPT_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, XSS_SCRIPT_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_SCRIPT_ARTIFACT_ID);
    await activateDraftTab(page);

    const panel = page.getByRole("tabpanel", { name: /Draft/i });
    await expect(panel.locator("script")).toHaveCount(0);
  });

  // ── 8. Draft tab — window.__pwned undefined ───────────────────────────────

  test("8. [Draft] window.__pwned remains undefined when script runs through draft_content path", async ({
    page,
  }) => {
    const detail = makeDetail({
      id: XSS_SCRIPT_ARTIFACT_ID,
      compiled_content: "<p>Compiled placeholder.</p>",
      draft_content: SCRIPT_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, XSS_SCRIPT_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_SCRIPT_ARTIFACT_ID);
    await activateDraftTab(page);

    await page.getByRole("tabpanel", { name: /Draft/i }).waitFor();

    const pwned = await page.evaluate(() => {
      return (window as unknown as Record<string, unknown>)["__pwned"];
    });
    expect(pwned).toBeUndefined();
  });

  // ── 9. Console-warning cleanliness — safe artifact ────────────────────────

  test("9. no console.error or console.warn during safe-HTML artifact navigation", async ({
    page,
    consoleErrors,
  }) => {
    const detail = makeDetail({
      id: SAFE_ARTIFACT_ID,
      compiled_content: SAFE_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, SAFE_ARTIFACT_ID, detail);
    await gotoArtifact(page, SAFE_ARTIFACT_ID);
    await activateKnowledgeTab(page);

    // Navigate between tabs to flush any lazy renders
    await activateDraftTab(page);
    await activateKnowledgeTab(page);

    // Filter out known-noisy framework warnings that are unrelated to our code
    const relevant = consoleErrors.filter(
      (msg) =>
        !msg.includes("ReactDOM.render") &&
        !msg.includes("act(") &&
        !msg.includes("Warning: An update to") &&
        // Tailwind/postcss warnings in dev mode
        !msg.includes("Unknown at rule") &&
        // Next.js hydration mismatch in dev (not our code)
        !msg.includes("Hydration failed") &&
        // Pre-existing Next.js metadata themeColor deprecation — in the app's layout
        // metadata export, unrelated to the sanitization gate (P6-03/P6-04/P6-05).
        !msg.includes("themeColor") &&
        !msg.includes("generate-viewport"),
    );
    expect(relevant).toHaveLength(0);
  });

  // ── 10. Console-warning cleanliness — XSS artifact ───────────────────────

  test("10. no console.error or console.warn during script-bearing artifact navigation", async ({
    page,
    consoleErrors,
  }) => {
    const detail = makeDetail({
      id: XSS_SCRIPT_ARTIFACT_ID,
      compiled_content: SCRIPT_HTML,
      draft_content: SCRIPT_HTML,
    });
    await seedAuth(page);
    await mockArtifactDetail(page, XSS_SCRIPT_ARTIFACT_ID, detail);
    await gotoArtifact(page, XSS_SCRIPT_ARTIFACT_ID);
    await activateKnowledgeTab(page);
    await activateDraftTab(page);
    await activateKnowledgeTab(page);

    const relevant = consoleErrors.filter(
      (msg) =>
        !msg.includes("ReactDOM.render") &&
        !msg.includes("act(") &&
        !msg.includes("Warning: An update to") &&
        !msg.includes("Unknown at rule") &&
        !msg.includes("Hydration failed") &&
        // Pre-existing Next.js metadata themeColor deprecation (same as test 9)
        !msg.includes("themeColor") &&
        !msg.includes("generate-viewport"),
    );
    expect(relevant).toHaveLength(0);
  });
});
