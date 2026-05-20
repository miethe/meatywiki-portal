/**
 * MSW v2 handlers for the compile-events endpoints.
 *
 * Exports:
 *   - compileEventsHandlers: array of MSW handlers for use in tests
 *   - mockCompileSuccess(artifactId): factory that returns an SSE handler
 *     streaming a success sequence (classify → extract → compile → terminal)
 *   - mockCompileFailure(artifactId, errorCode): factory that streams an
 *     error sequence (classify → extract → terminal/failed)
 *   - mockActivityHistory(artifactId): REST handler for the activity endpoint
 *
 * All SSE handlers return the full event stream synchronously as a single
 * text body — MSW's Node.js handler doesn't stream incrementally, so the
 * full text is returned and the browser SSE parser splits it on \n\n.
 *
 * Usage in tests:
 *   server.use(mockCompileSuccess("art_test_01"));
 *   server.use(mockCompileFailure("art_test_01", "EXTRACTION_FAILED"));
 *
 * Reference: docs/api/compile-events-contract.md (in meatywiki repo).
 */

import { http, HttpResponse } from "msw";

const API_BASE = "http://127.0.0.1:8765";

// ---------------------------------------------------------------------------
// Stub types
// ---------------------------------------------------------------------------

interface WorkflowStageEventStub {
  id: string;
  artifact_id: string | null;
  run_id: string | null;
  workflow: string;
  stage: string;
  status: string;
  created_at: string;
  payload: Record<string, unknown>;
}

function makeEvent(
  overrides: Partial<WorkflowStageEventStub> & { id: string; stage: string; status: string },
): WorkflowStageEventStub {
  return {
    artifact_id: "art_test_default",
    run_id: "run_test_default",
    workflow: "compile",
    created_at: new Date().toISOString(),
    payload: {},
    ...overrides,
  };
}

function sseFrame(event: WorkflowStageEventStub): string {
  return `id: ${event.id}\nevent: workflow_stage_event\ndata: ${JSON.stringify(event)}\n\n`;
}

function heartbeat(): string {
  return `: ping\n\n`;
}

// ---------------------------------------------------------------------------
// Success sequence factory
// ---------------------------------------------------------------------------

/**
 * Returns an MSW handler that streams a success compile sequence for the
 * given artifactId:
 *   classify/started → classify/completed → extract/started → extract/completed
 *   → compile/started → compile/completed → terminal/completed
 */
export function mockCompileSuccess(artifactId: string) {
  return http.get(`${API_BASE}/api/artifacts/${artifactId}/compile/events`, () => {
    const run_id = `run_${artifactId}_01`;
    const now = new Date();

    const events: WorkflowStageEventStub[] = [
      makeEvent({ id: "evt-001", artifact_id: artifactId, run_id, stage: "classify", status: "started", created_at: new Date(now.getTime()).toISOString() }),
      makeEvent({ id: "evt-002", artifact_id: artifactId, run_id, stage: "classify", status: "completed", payload: { duration_ms: 210 }, created_at: new Date(now.getTime() + 200).toISOString() }),
      makeEvent({ id: "evt-003", artifact_id: artifactId, run_id, stage: "extract", status: "started", created_at: new Date(now.getTime() + 400).toISOString() }),
      makeEvent({ id: "evt-004", artifact_id: artifactId, run_id, stage: "extract", status: "completed", payload: { duration_ms: 850, token_count: 512 }, created_at: new Date(now.getTime() + 1300).toISOString() }),
      makeEvent({ id: "evt-005", artifact_id: artifactId, run_id, stage: "compile", status: "started", created_at: new Date(now.getTime() + 1500).toISOString() }),
      makeEvent({ id: "evt-006", artifact_id: artifactId, run_id, stage: "compile", status: "completed", payload: { duration_ms: 2100, model_used: "claude-sonnet-4-6" }, created_at: new Date(now.getTime() + 3600).toISOString() }),
      makeEvent({ id: "evt-007", artifact_id: artifactId, run_id, stage: "terminal", status: "completed", created_at: new Date(now.getTime() + 3700).toISOString() }),
    ];

    const body = heartbeat() + events.map(sseFrame).join("");

    return new HttpResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Failure sequence factory
// ---------------------------------------------------------------------------

/**
 * Returns an MSW handler that streams a failure compile sequence:
 *   classify/started → classify/completed → extract/started → terminal/failed
 */
export function mockCompileFailure(
  artifactId: string,
  errorCode: string = "EXTRACTION_FAILED",
  errorMessage: string = "Failed to extract structured data from artifact.",
) {
  return http.get(`${API_BASE}/api/artifacts/${artifactId}/compile/events`, () => {
    const run_id = `run_${artifactId}_err`;
    const now = new Date();

    const events: WorkflowStageEventStub[] = [
      makeEvent({ id: "evt-001", artifact_id: artifactId, run_id, stage: "classify", status: "started", created_at: new Date(now.getTime()).toISOString() }),
      makeEvent({ id: "evt-002", artifact_id: artifactId, run_id, stage: "classify", status: "completed", payload: { duration_ms: 210 }, created_at: new Date(now.getTime() + 200).toISOString() }),
      makeEvent({ id: "evt-003", artifact_id: artifactId, run_id, stage: "extract", status: "started", created_at: new Date(now.getTime() + 400).toISOString() }),
      makeEvent({
        id: "evt-004",
        artifact_id: artifactId,
        run_id,
        stage: "terminal",
        status: "failed",
        payload: { error_code: errorCode, error_message: errorMessage },
        created_at: new Date(now.getTime() + 600).toISOString(),
      }),
    ];

    const body = heartbeat() + events.map(sseFrame).join("");

    return new HttpResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Activity history handler
// ---------------------------------------------------------------------------

/**
 * Returns an MSW handler for GET /api/artifacts/:id/activity.
 * Returns a fixture history of 4 stage events (DESC order — newest first).
 */
export function mockActivityHistory(artifactId: string) {
  return http.get(`${API_BASE}/api/artifacts/${artifactId}/activity`, ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);

    const now = new Date();
    const items: WorkflowStageEventStub[] = [
      makeEvent({ id: "evt-007", artifact_id: artifactId, run_id: "run_hist_01", stage: "terminal", status: "completed", created_at: new Date(now.getTime() - 1_000).toISOString() }),
      makeEvent({ id: "evt-006", artifact_id: artifactId, run_id: "run_hist_01", stage: "compile", status: "completed", created_at: new Date(now.getTime() - 2_000).toISOString() }),
      makeEvent({ id: "evt-004", artifact_id: artifactId, run_id: "run_hist_01", stage: "extract", status: "completed", created_at: new Date(now.getTime() - 4_000).toISOString() }),
      makeEvent({ id: "evt-001", artifact_id: artifactId, run_id: "run_hist_01", stage: "classify", status: "started", created_at: new Date(now.getTime() - 5_000).toISOString() }),
    ].slice(0, limit);

    return HttpResponse.json({
      items,
      next_cursor: null,
    });
  });
}

// ---------------------------------------------------------------------------
// Inbox with processed extension handler
// ---------------------------------------------------------------------------

/**
 * Returns an MSW handler for GET /api/artifacts?workspace=inbox&include_processed=true
 * that returns both `items` (inbox queue) and `processed` (recently compiled).
 */
export function mockInboxWithProcessed(options: {
  inboxItems?: Array<{ id: string; title: string }>;
  processedItems?: Array<{ id: string; title: string; workspace?: string; compiled_at?: string }>;
} = {}) {
  return http.get(`${API_BASE}/api/artifacts`, ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get("workspace") !== "inbox") {
      // Let other handlers take over if not inbox
      return undefined;
    }
    if (url.searchParams.get("include_processed") !== "true") {
      // Fall through to the default artifacts handler
      return undefined;
    }

    const now = new Date().toISOString();

    const items = (options.inboxItems ?? [
      { id: "art_inbox_01", title: "Inbox note 1" },
    ]).map((i) => ({
      id: i.id,
      workspace: "inbox",
      type: "note",
      subtype: null,
      title: i.title,
      status: "needs_compile",
      schema_version: "1.0.0",
      created: now,
      updated: now,
      file_path: `raw/${i.id}.md`,
      metadata: null,
    }));

    const processed = (options.processedItems ?? [
      { id: "art_processed_01", title: "Processed note 1", workspace: "library" },
    ]).map((p) => ({
      id: p.id,
      workspace: p.workspace ?? "library",
      type: "note",
      subtype: null,
      title: p.title,
      status: "active",
      created: now,
      updated: now,
      file_path: `wiki/concepts/${p.id}.md`,
      compiled_at: p.compiled_at ?? now,
    }));

    return HttpResponse.json({
      items,
      processed,
      cursor: null,
      etag: `W/"stub-inbox-etag"`,
    });
  });
}

// ---------------------------------------------------------------------------
// Default handlers (add to the baseline handlers array)
// ---------------------------------------------------------------------------

/** Baseline compile-events handlers: 404 by default, override per test. */
export const compileEventsHandlers = [
  // Default SSE: return empty stream (no events) so tests that don't care
  // about SSE don't get stuck waiting.
  http.get(`${API_BASE}/api/artifacts/:artifactId/compile/events`, () => {
    const body = heartbeat();
    return new HttpResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }),

  // Default activity endpoint: empty history.
  http.get(`${API_BASE}/api/artifacts/:artifactId/activity`, () => {
    return HttpResponse.json({ items: [], next_cursor: null });
  }),

  // Compile POST: 202 Accepted with a run_id.
  http.post(`${API_BASE}/api/artifacts/:artifactId/compile`, ({ params }) => {
    return HttpResponse.json(
      {
        run_id: `run_${params["artifactId"] as string}_stub`,
        status: "queued",
        artifact_id: params["artifactId"] as string,
      },
      { status: 202 },
    );
  }),
];
