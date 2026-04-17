/**
 * Shared Playwright route mocks + fixture data for the Research workspace
 * E2E suite (P4-11).
 *
 * All HTTP + SSE is mocked at the network layer so the Research journeys run
 * without a live portal backend. Callers pass a Page and a RouteMockConfig
 * describing what each journey needs.
 *
 * Mocked endpoints:
 *   GET  /api/artifacts                      — Library / Review queue
 *   GET  /api/artifacts/:id                  — Artifact detail
 *   GET  /api/artifacts/:id/edges            — Backlinks + contradiction flag
 *   POST /api/workflows/synthesize           — Synthesis kickoff (202)
 *   GET  /api/workflows/:run_id/stream       — SSE; handled via EventSource stub
 *   GET  /api/workflow-events                — legacy global SSE (route-level 200)
 *
 * SSE strategy: the native EventSource is stubbed via page.addInitScript()
 * before any app code runs. The stub reads a window.__sseScript array injected
 * by the test and dispatches events synchronously to the subscribed instance.
 * This avoids all native-fetch streaming quirks and keeps tests deterministic.
 */

import type { Page, Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixture artifacts
// ---------------------------------------------------------------------------

export const ARTIFACT_A_ID = "01HXYZ0000000000000000001";
export const ARTIFACT_B_ID = "01HXYZ0000000000000000002";
export const ARTIFACT_STALE_ID = "01HXYZ000000000000000STAL";
export const ARTIFACT_OUTDATED_ID = "01HXYZ000000000000000OUTD";
export const ARTIFACT_CURRENT_ID = "01HXYZ000000000000000CURR";
export const ARTIFACT_MISSING_ID = "01HXYZ000000000000000MISS";
export const ARTIFACT_CONTRADICTS_ID = "01HXYZ000000000000000CNTR";
export const SYNTHESIS_RUN_ID = "run_synth_test_001";
export const NEW_SYNTH_ARTIFACT_ID = "01HXYZ000000000000000SYNT";

interface ArtifactOverrides {
  id?: string;
  title?: string;
  type?: string;
  status?: "draft" | "active" | "archived" | "stale";
  workspace?: "inbox" | "library" | "research" | "blog" | "projects";
  frontmatter_jsonb?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function makeArtifactCard(overrides: ArtifactOverrides = {}) {
  return {
    id: overrides.id ?? ARTIFACT_A_ID,
    workspace: overrides.workspace ?? "research",
    type: overrides.type ?? "concept",
    subtype: null,
    title: overrides.title ?? "Sample Research Concept",
    status: overrides.status ?? "active",
    schema_version: "1.0",
    created: "2026-04-01T10:00:00Z",
    updated: "2026-04-15T12:00:00Z",
    file_path: "wiki/concepts/sample.md",
    metadata: overrides.metadata ?? {
      fidelity: "high",
      freshness: "current",
      verification_state: "verified",
    },
  };
}

export function makeArtifactDetail(overrides: ArtifactOverrides = {}) {
  const card = makeArtifactCard(overrides);
  return {
    ...card,
    summary: "A concise summary of the artifact.",
    slug: "sample-concept",
    content_hash: "sha256:abc",
    frontmatter_jsonb: overrides.frontmatter_jsonb ?? {
      tags: ["research", "sample"],
      lens_freshness: "fresh",
    },
    raw_content: "# Sample\n\nBody content.",
    compiled_content: "<h1>Sample</h1><p>Body content.</p>",
    draft_content: null,
    artifact_edges: [],
  };
}

// ---------------------------------------------------------------------------
// Edge fixture builder
// ---------------------------------------------------------------------------

export interface EdgeSpec {
  artifact_id: string;
  type:
    | "derived_from"
    | "supports"
    | "relates_to"
    | "supersedes"
    | "contradicts"
    | "contains";
  title?: string | null;
  subtype?: string | null;
}

// ---------------------------------------------------------------------------
// Config shapes
// ---------------------------------------------------------------------------

export interface ArtifactsListFilter {
  /** Match on query params (raw searchParams object) to return specific data. */
  match?: (url: URL) => boolean;
  body: unknown;
}

export interface RouteMockConfig {
  /** GET /api/artifacts — list responses (ordered; first match wins). */
  artifactsList?: ArtifactsListFilter[];
  /** GET /api/artifacts/:id — keyed by id. */
  artifactDetail?: Record<string, unknown>;
  /** GET /api/artifacts/:id/edges — keyed by id. */
  artifactEdges?: Record<string, { incoming: EdgeSpec[]; outgoing: EdgeSpec[] }>;
  /**
   * POST /api/workflows/synthesize — response body. When present, the mock
   * returns 202 Accepted with this JSON.
   */
  synthesizeResponse?: {
    run_id: string;
    status: "queued";
    created_at: string;
  };
}

// ---------------------------------------------------------------------------
// Route mock installer
// ---------------------------------------------------------------------------

/**
 * Installs route handlers for the Research workspace endpoints.
 * Must be called BEFORE `page.goto()` so the first navigation sees the mocks.
 */
export async function installResearchMocks(
  page: Page,
  config: RouteMockConfig,
): Promise<void> {
  // Ensure the session cookie is attached for the actual test host. The
  // shared `authenticatedPage` fixture seeds it on "localhost"; when the
  // Playwright base URL uses 127.0.0.1 (default) the cookie is NOT visible
  // to the Next.js server layout (it reads cookies via next/headers with
  // the exact request host), which causes redirect(/login) → (/) → (/inbox).
  // We re-seed via the page URL, letting Playwright derive the domain.
  const token = process.env.MEATYWIKI_PORTAL_TOKEN ?? "test-token-e2e";
  const hosts = ["127.0.0.1", "localhost"];
  await page.context().addCookies(
    hosts.map((domain) => ({
      name: "portal_session",
      value: token,
      domain,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );

  // Auth session — avoid any login redirect
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

  // --- GET /api/artifacts (list) ---------------------------------------
  await page.route("**/api/artifacts?**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    const filters = config.artifactsList ?? [];
    const match = filters.find((f) => !f.match || f.match(url));
    const body = match?.body ?? { data: [], cursor: null };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  // Bare `/api/artifacts` (no query string) — same handler
  await page.route("**/api/artifacts", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const filters = config.artifactsList ?? [];
    const match = filters[0];
    const body = match?.body ?? { data: [], cursor: null };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  // --- GET /api/artifacts/:id and /edges -------------------------------
  await page.route("**/api/artifacts/*", async (route: Route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = route.request().url();
    // /edges endpoint
    if (url.endsWith("/edges") || url.includes("/edges?")) {
      const id = extractArtifactId(url, /\/artifacts\/([^/?]+)\/edges/);
      const edges = config.artifactEdges?.[id];
      if (edges) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            artifact_id: id,
            incoming: edges.incoming,
            outgoing: edges.outgoing,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            artifact_id: id,
            incoming: [],
            outgoing: [],
          }),
        });
      }
      return;
    }
    // Plain /artifacts/:id
    const id = extractArtifactId(url, /\/artifacts\/([^/?]+)/);
    const detail = config.artifactDetail?.[id];
    if (detail) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: detail }),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "not_found" }),
      });
    }
  });

  // Separate explicit route for /edges (wildcard above usually catches it,
  // but making it explicit ensures deterministic behaviour under Chromium).
  await page.route("**/api/artifacts/*/edges**", async (route: Route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = route.request().url();
    const id = extractArtifactId(url, /\/artifacts\/([^/?]+)\/edges/);
    const edges = config.artifactEdges?.[id];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        artifact_id: id,
        incoming: edges?.incoming ?? [],
        outgoing: edges?.outgoing ?? [],
      }),
    });
  });

  // --- POST /api/workflows/synthesize ---------------------------------
  await page.route("**/api/workflows/synthesize", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const resp = config.synthesizeResponse ?? {
      run_id: SYNTHESIS_RUN_ID,
      status: "queued" as const,
      created_at: new Date().toISOString(),
    };
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify(resp),
    });
  });

  // --- GET /api/workflow-events (global SSE, if any code path hits it) -
  await page.route("**/api/workflow-events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "",
    });
  });

  // --- GET /api/workflows/:run_id/stream — caught by EventSource stub --
  // The EventSource is replaced in-page (see installEventSourceStub), so this
  // network request is never actually issued. We still catch it as a safety
  // net in case any code path falls back to fetch().
  await page.route("**/api/workflows/*/stream**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "",
    });
  });
}

function extractArtifactId(url: string, re: RegExp): string {
  const m = url.match(re);
  return m ? decodeURIComponent(m[1]!) : "";
}

// ---------------------------------------------------------------------------
// EventSource stub (installed via addInitScript)
// ---------------------------------------------------------------------------

/**
 * Schedules a scripted SSE "conversation" for the next EventSource opened in
 * the page. Must be called BEFORE the app opens the EventSource (i.e. BEFORE
 * the user clicks "Launch synthesis"). It is safe to call multiple times;
 * each call queues events for the next connection.
 *
 * Each script entry is delivered with `delayMs` milliseconds between events
 * (measured from the previous entry) to simulate a real stream.
 */
export interface SSEScriptEntry {
  delayMs: number;
  data: unknown;
  id?: string;
}

export async function installEventSourceStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type EntryShape = { delayMs: number; data: unknown; id?: string };
    interface ExtWindow extends Window {
      __sseScripts?: EntryShape[][];
    }
    const w = window as unknown as ExtWindow;
    if (!w.__sseScripts) w.__sseScripts = [];

    class StubEventSource {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;

      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSED = 2;

      readyState = 0;
      url: string;
      withCredentials = false;
      onopen: ((ev: Event) => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      private listeners = new Map<string, Set<(ev: Event) => void>>();
      private closed = false;

      constructor(url: string) {
        this.url = url;
        const scripts = w.__sseScripts ?? [];
        const script = scripts.shift() ?? [];
        // open on next tick
        setTimeout(() => {
          if (this.closed) return;
          this.readyState = 1;
          this.onopen?.(new Event("open"));
          this.dispatchEvent(new Event("open"));
        }, 0);
        // schedule events
        let acc = 0;
        for (const entry of script) {
          acc += entry.delayMs;
          setTimeout(() => {
            if (this.closed) return;
            const payload = JSON.stringify(entry.data);
            const init: MessageEventInit = {
              data: payload,
              lastEventId: entry.id ?? "",
            };
            const msgEv = new MessageEvent("message", init);
            this.onmessage?.(msgEv);
            this.dispatchEvent(msgEv);
          }, acc);
        }
      }

      addEventListener(type: string, cb: (ev: Event) => void) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type)!.add(cb);
      }
      removeEventListener(type: string, cb: (ev: Event) => void) {
        this.listeners.get(type)?.delete(cb);
      }
      dispatchEvent(ev: Event): boolean {
        const set = this.listeners.get(ev.type);
        if (set) for (const cb of set) cb(ev);
        return true;
      }
      close() {
        this.closed = true;
        this.readyState = 2;
      }
    }

    (window as unknown as { EventSource: unknown }).EventSource =
      StubEventSource;
  });
}

/**
 * Queue a script for the NEXT EventSource the page opens.
 * Must be called AFTER installEventSourceStub and BEFORE the app connects.
 */
export async function queueSSEScript(
  page: Page,
  script: SSEScriptEntry[],
): Promise<void> {
  await page.evaluate((s) => {
    interface ExtWindow extends Window {
      __sseScripts?: unknown[][];
    }
    const w = window as unknown as ExtWindow;
    if (!w.__sseScripts) w.__sseScripts = [];
    w.__sseScripts.push(s as unknown[]);
  }, script);
}

/**
 * Pre-install stub + queue one script in a single call. Useful in beforeEach.
 */
export async function setupSSE(
  page: Page,
  script: SSEScriptEntry[],
): Promise<void> {
  await installEventSourceStub(page);
  // Also seed the very first script via addInitScript so it's available on
  // the first JS evaluation (before any user interaction).
  await page.addInitScript((initial) => {
    interface ExtWindow extends Window {
      __sseScripts?: unknown[][];
    }
    const w = window as unknown as ExtWindow;
    if (!w.__sseScripts) w.__sseScripts = [];
    w.__sseScripts.push(initial as unknown[]);
  }, script as unknown);
}
