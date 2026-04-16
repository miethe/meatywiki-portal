import { http, HttpResponse } from "msw";

const API_BASE = "http://127.0.0.1:8787";

/**
 * MSW request handlers — stubs for the Portal backend API.
 *
 * P3-11 expands these with full response shapes matching the backend
 * OpenAPI schema (Service-Mode v2).
 *
 * Handler naming: mirror backend route structure from portal-v1 design spec §5.
 */
export const handlers = [
  // Health check
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({ status: "ok" });
  }),

  // Auth
  http.post(`${API_BASE}/api/auth/session`, () => {
    return HttpResponse.json({ ok: true });
  }),

  // Artifacts (P2-09 surface)
  http.get(`${API_BASE}/api/artifacts`, () => {
    return HttpResponse.json({ items: [], next_cursor: null, total: 0 });
  }),

  http.get(`${API_BASE}/api/artifacts/:id`, ({ params }) => {
    return HttpResponse.json({
      id: params["id"],
      title: "Stub artifact",
      artifact_type: "note",
      lifecycle_status: "raw",
    });
  }),

  // Intake (P2-06 surface)
  http.post(`${API_BASE}/api/intake/note`, () => {
    return HttpResponse.json({ run_id: "stub-run-id", status: "queued" });
  }),

  http.post(`${API_BASE}/api/intake/url`, () => {
    return HttpResponse.json({ run_id: "stub-run-id", status: "queued" });
  }),

  // Workflows (P2-04 surface)
  http.get(`${API_BASE}/api/workflows`, () => {
    return HttpResponse.json({ items: [], next_cursor: null });
  }),
];
