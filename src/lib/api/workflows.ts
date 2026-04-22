/**
 * Workflows API — typed wrappers around workflow endpoints.
 *
 * Endpoints:
 *   GET  /api/workflows/runs     — list runs (design spec §5 cursor pagination)
 *   POST /api/workflows/synthesize — enqueue research_synthesis_v1 (P4-02)
 *
 * Backend: meatywiki/portal/api/workflows.py (P2-03 / P2-04 / P4-02 scope).
 *
 * Query params supported (GET /runs):
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
// Synthesize — POST /api/workflows/synthesize (P4-02)
// ---------------------------------------------------------------------------

export interface SynthesizeParams {
  /** Template ID — always "research_synthesis_v1" in v1. */
  template_id?: string;
  /** One or more artifact ULIDs to gather as synthesis inputs. */
  sources: string[];
  /** Optional glob / path scope for the compile stage. */
  scope?: string;
  /** Optional free-text focus hint forwarded to the engine. */
  focus?: string;
  /**
   * Synthesis type selected in the 2-step wizard (ADR-DPI-005).
   * Values: "summary" | "analysis" | "compare" | "synthesize"
   *
   * ENDPOINT GAP: Not yet consumed by research_synthesis_v1 workflow
   * template. Collected by wizard and forwarded — backend DTO must be
   * expanded to accept and pass to the engine prompt (ADR-DPI-005 §3).
   */
  type?: string;
  /**
   * Response depth hint (ADR-DPI-005).
   * Values: "brief" | "standard" | "deep" | "exhaustive"
   *
   * ENDPOINT GAP: Not yet consumed by research_synthesis_v1 workflow template.
   */
  depth?: string;
  /**
   * Tone/style hint (ADR-DPI-005).
   * Values: "neutral" | "academic" | "conversational" | "critical"
   *
   * ENDPOINT GAP: Not yet consumed by research_synthesis_v1 workflow template.
   */
  tone?: string;
  /**
   * Free-text constraints forwarded verbatim to the synthesis prompt (ADR-DPI-005).
   *
   * ENDPOINT GAP: Not yet consumed by research_synthesis_v1 workflow template.
   */
  constraints?: string;
}

export interface SynthesizeAcceptedResponse {
  run_id: string;
  status: "queued";
  created_at: string;
}

/**
 * POST /api/workflows/synthesize
 *
 * Enqueues a research_synthesis_v1 workflow run.
 * Returns 202 Accepted with a run_id that can be subscribed to via SSE:
 *   GET /api/workflows/{run_id}/stream
 */
export async function submitSynthesis(
  params: SynthesizeParams,
): Promise<SynthesizeAcceptedResponse> {
  const body: Record<string, unknown> = {
    template_id: params.template_id ?? "research_synthesis_v1",
    sources: params.sources,
  };
  if (params.scope?.trim()) body.scope = params.scope.trim();
  if (params.focus?.trim()) body.focus = params.focus.trim();
  // ADR-DPI-005 extended fields — forwarded but not yet consumed by backend
  if (params.type) body.type = params.type;
  if (params.depth) body.depth = params.depth;
  if (params.tone) body.tone = params.tone;
  if (params.constraints?.trim()) body.constraints = params.constraints.trim();

  return apiFetch<SynthesizeAcceptedResponse>("/workflows/synthesize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

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
