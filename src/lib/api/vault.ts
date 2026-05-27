/**
 * Vault API — typed wrappers around vault reconciliation endpoints.
 *
 * Endpoints:
 *   POST /api/vault/reconcile-check  — check or apply vault/overlay drift
 *     body: { dry_run: boolean; confirm: boolean }
 *     query: ?detail=true  — include per-file drift items in response
 *
 * Backend: meatywiki/portal/api/vault.py (P4 scope).
 */

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconcileDriftItem {
  artifact_id: string;
  title: string;
  drift_type: "added" | "modified" | "deleted";
  diff_summary?: string;
}

export interface ReconcileCheckResponse {
  summary: {
    added: number;
    modified: number;
    deleted: number;
    unchanged: number;
  };
  /** null when the request did not include ?detail=true */
  drift_items: ReconcileDriftItem[] | null;
  applied: boolean;
}

export interface ReconcileCheckBody {
  dry_run: boolean;
  confirm: boolean;
}

// ---------------------------------------------------------------------------
// API function
// ---------------------------------------------------------------------------

/**
 * POST /api/vault/reconcile-check
 *
 * @param body  { dry_run, confirm }
 * @param detail  When true, adds ?detail=true to include per-file drift items.
 */
export async function checkReconcileDrift(
  body: ReconcileCheckBody,
  detail = false,
): Promise<ReconcileCheckResponse> {
  const qs = detail ? "?detail=true" : "";
  return apiFetch<ReconcileCheckResponse>(`/vault/reconcile-check${qs}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
