import { http, HttpResponse } from "msw";

/**
 * MSW v2 request handlers — baseline stubs for the Portal backend API.
 *
 * These handlers cover the core API surface (health, auth, artifacts,
 * intake, workflows, SSE stream) so screen tests in Batch 3 can import
 * `handlers` and add / override per-test handlers without scaffolding MSW
 * from scratch.
 *
 * Response shapes mirror the backend OpenAPI schema (Service-Mode v2,
 * design spec §5) using the `ServiceModeEnvelope` structure:
 *   { data: { items: T[], cursor: string | null } }
 *
 * All handlers use MSW v2 API: `http.*` (NOT v1 `rest.*`).
 *
 * Reference: src/meatywiki/portal/api/ — artifacts.py, workflows.py,
 *   intake.py, sse.py.
 */

const API_BASE = "http://127.0.0.1:8765";

// ---------------------------------------------------------------------------
// Shared stub factories
// ---------------------------------------------------------------------------

function makeArtifactCard(overrides: Partial<ArtifactCardStub> = {}): ArtifactCardStub {
  return {
    id: "01HXYZ0000000000000000001",
    workspace: "inbox",
    type: "note",
    subtype: null,
    title: "Stub artifact",
    status: "raw",
    schema_version: "1.0.0",
    created: "2026-04-01T00:00:00Z",
    updated: "2026-04-16T00:00:00Z",
    file_path: "raw/stub-artifact.md",
    metadata: null,
    ...overrides,
  };
}

function makeWorkflowRun(overrides: Partial<WorkflowRunStub> = {}): WorkflowRunStub {
  return {
    id: "run-stub-01",
    run_id: "run-stub-01",
    template_id: "source_ingest_v1",
    status: "pending",
    created_at: "2026-04-16T00:00:00Z",
    last_event_timestamp: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stub type shapes (mirror backend schemas — no import from Python)
// ---------------------------------------------------------------------------

interface ArtifactMetadataStub {
  fidelity: string | null;
  freshness: string | null;
  verification_state: string | null;
}

interface ArtifactCardStub {
  id: string;
  workspace: string;
  type: string;
  subtype: string | null;
  title: string;
  status: string;
  schema_version: string | null;
  created: string | null;
  updated: string | null;
  file_path: string;
  metadata: ArtifactMetadataStub | null;
}

interface ArtifactDetailStub extends ArtifactCardStub {
  summary: string | null;
  slug: string | null;
  content_hash: string | null;
  frontmatter_jsonb: Record<string, unknown> | null;
  raw_content: string | null;
  compiled_content: string | null;
  draft_content: string | null;
}

interface WorkflowRunStub {
  id: string;
  run_id: string;
  template_id: string;
  status: string;
  created_at: string;
  last_event_timestamp: string | null;
}

interface PaginatedEnvelope<T> {
  data: {
    items: T[];
    cursor: string | null;
    total?: number;
  };
}

function paginated<T>(items: T[], cursor: string | null = null): PaginatedEnvelope<T> {
  return { data: { items, cursor, total: items.length } };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  // ------------------------------------------------------------------
  // Health
  // ------------------------------------------------------------------
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({ status: "ok", version: "1.0.0" });
  }),

  // ------------------------------------------------------------------
  // Auth / Session
  // ------------------------------------------------------------------
  http.post(`${API_BASE}/api/auth/session`, () => {
    return HttpResponse.json({ ok: true });
  }),

  http.delete(`${API_BASE}/api/auth/session`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // ------------------------------------------------------------------
  // Artifacts — list (GET /api/artifacts)
  // Supports query params: workspace, status, type, tags, cursor, limit
  // ------------------------------------------------------------------
  http.get(`${API_BASE}/api/artifacts`, () => {
    const items: ArtifactCardStub[] = [
      makeArtifactCard({ id: "01HXYZ0000000000000000001", workspace: "inbox", title: "First stub artifact" }),
      makeArtifactCard({ id: "01HXYZ0000000000000000002", workspace: "library", type: "concept", title: "Second stub artifact", status: "compiled" }),
    ];
    return HttpResponse.json(paginated(items));
  }),

  // Artifact detail (GET /api/artifacts/:id)
  http.get(`${API_BASE}/api/artifacts/:id`, ({ params }) => {
    const detail: ArtifactDetailStub = {
      ...makeArtifactCard({ id: params["id"] as string }),
      summary: "A stub summary for the artifact.",
      slug: "stub-artifact",
      content_hash: "abc123",
      frontmatter_jsonb: { tags: [], schema_version: "1.0.0" },
      raw_content: "# Stub\n\nRaw content here.",
      compiled_content: "<h1>Stub</h1><p>Compiled content here.</p>",
      draft_content: null,
    };
    return HttpResponse.json({ data: detail });
  }),

  // Promote artifact (POST /api/artifacts/:id/promote)
  http.post(`${API_BASE}/api/artifacts/:id/promote`, ({ params }) => {
    return HttpResponse.json(
      { data: { artifact_id: params["id"], success: true, new_status: "compiled" } },
      { status: 200 },
    );
  }),

  // Link artifact (POST /api/artifacts/:id/link)
  http.post(`${API_BASE}/api/artifacts/:id/link`, () => {
    return HttpResponse.json({ data: { status: "linked" } }, { status: 201 });
  }),

  // Review artifact (POST /api/artifacts/:id/review)
  http.post(`${API_BASE}/api/artifacts/:id/review`, () => {
    return HttpResponse.json({ data: { id: "review-stub-01" } }, { status: 201 });
  }),

  // ------------------------------------------------------------------
  // Intake (POST /api/intake/note, POST /api/intake/url)
  // Returns 202 Accepted with run_id
  // ------------------------------------------------------------------
  http.post(`${API_BASE}/api/intake/note`, () => {
    return HttpResponse.json(
      { data: { run_id: "run-stub-intake-01", status: "queued" } },
      { status: 202 },
    );
  }),

  http.post(`${API_BASE}/api/intake/url`, () => {
    return HttpResponse.json(
      { data: { run_id: "run-stub-intake-02", status: "queued" } },
      { status: 202 },
    );
  }),

  // ------------------------------------------------------------------
  // Workflows — list (GET /api/workflows)
  // ------------------------------------------------------------------
  http.get(`${API_BASE}/api/workflows`, () => {
    const items: WorkflowRunStub[] = [
      makeWorkflowRun({ id: "run-stub-01", status: "running", template_id: "source_ingest_v1" }),
      makeWorkflowRun({ id: "run-stub-02", status: "complete", template_id: "compile_v1" }),
    ];
    return HttpResponse.json(paginated(items));
  }),

  // Workflow templates (GET /api/workflows/templates)
  http.get(`${API_BASE}/api/workflows/templates`, () => {
    return HttpResponse.json(
      paginated([
        {
          template_id: "source_ingest_v1",
          label: "Source Ingest",
          description: "Ingest a raw source into the vault.",
          icon: "inbox",
          param_schema: {},
          engine_method: "ingest",
        },
        {
          template_id: "compile_v1",
          label: "Compile",
          description: "Compile staged artifacts into wiki pages.",
          icon: "book",
          param_schema: {},
          engine_method: "compile",
        },
      ]),
    );
  }),

  // ------------------------------------------------------------------
  // SSE — workflow stream (GET /api/workflows/:run_id/stream)
  //
  // Returns a minimal SSE-formatted text/event-stream response with a
  // single `stage_started` event followed by `workflow_completed`, then
  // closes. Screen tests that need richer sequences should use
  // `server.use(...)` to override this handler.
  // ------------------------------------------------------------------
  http.get(`${API_BASE}/api/workflows/:run_id/stream`, ({ params }) => {
    const runId = params["run_id"] as string;

    const now = new Date().toISOString();

    const events = [
      `id: 1\nevent: stage_started\ndata: ${JSON.stringify({ event_id: "1", run_id: runId, timestamp: now, type: "stage_started", stage: "ingest" })}\n\n`,
      `id: 2\nevent: workflow_completed\ndata: ${JSON.stringify({ event_id: "2", run_id: runId, timestamp: now, type: "workflow_completed", artifact_id: "01HXYZ0000000000000000001" })}\n\n`,
    ].join("");

    return new HttpResponse(events, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }),
];
