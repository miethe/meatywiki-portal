/**
 * Workflows API — typed wrappers around GET /api/workflows/runs.
 *
 * Backend endpoint: GET /api/workflows/runs
 *   - Implemented in meatywiki/portal/api/workflows.py (P2-03 / P2-04 scope).
 *   - The current backend only ships GET /api/workflows/templates; the runs
 *     list endpoint is anticipated per the design spec workflow_runs table
 *     (§4). This client is written to the expected contract so P3-07 is ready
 *     to consume it as soon as the backend route lands.
 *
 * Query params supported (design spec §5 cursor pagination):
 *   status — filter by WorkflowRunStatus (comma-separated allowed)
 *   since  — ISO-8601 timestamp; return runs with started_at >= since
 *   cursor — opaque pagination cursor (backend: keyset on started_at DESC, id DESC)
 *   limit  — max items per page (default: 50)
 *
 * Response shape: ServiceModeEnvelope<WorkflowRun>
 */

import { apiFetch } from "./client";
import type { WorkflowRun, WorkflowRunStatus, ServiceModeEnvelope } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Query parameter shape
// ---------------------------------------------------------------------------

export interface ListWorkflowsParams {
  /** Filter by one or more statuses (comma-separated on the wire, e.g. "running,pending"). */
  status?: WorkflowRunStatus | WorkflowRunStatus[];
  /** ISO-8601 lower bound for started_at. Defaults to 24 h ago when omitted server-side. */
  since?: string;
  /** Opaque cursor for keyset pagination. */
  cursor?: string | null;
  /** Max items per page. Backend default: 50. */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an ISO-8601 string for N hours ago. */
export function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// listWorkflows
// ---------------------------------------------------------------------------

/**
 * Fetch a cursor-paginated page of workflow runs.
 *
 * To get active + recent runs for the Workflows Dashboard, call with:
 *   listWorkflows({ since: hoursAgo(24) })
 *
 * To get only running/pending runs (for the top-bar badge count):
 *   listWorkflows({ status: ["running", "pending"] })
 */
export async function listWorkflows(
  params: ListWorkflowsParams = {},
): Promise<ServiceModeEnvelope<WorkflowRun>> {
  const { status, since, cursor, limit = 50 } = params;

  const query = new URLSearchParams();

  if (status) {
    const statusStr = Array.isArray(status) ? status.join(",") : status;
    query.set("status", statusStr);
  }
  if (since) query.set("since", since);
  if (cursor) query.set("cursor", cursor);
  query.set("limit", String(limit));

  const qs = query.toString();
  const path = `/workflows/runs${qs ? `?${qs}` : ""}`;

  return apiFetch<ServiceModeEnvelope<WorkflowRun>>(path);
}
