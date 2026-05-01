/**
 * Intake API — typed wrappers for POST /api/intake/note, /api/intake/url,
 * and /api/intake/upload.
 *
 * Backend endpoints (portal/api/intake.py):
 *   POST /api/intake/note   → 202 { run_id, status: "queued", created_at }
 *   POST /api/intake/url    → 202 { run_id, status: "queued", created_at }
 *   POST /api/intake/upload → 202 { run_id, status: "queued", created_at }
 *
 * Offline behaviour (P4-02, FR-1.5-17):
 *   When NEXT_PUBLIC_PORTAL_ENABLE_PWA=1 and navigator.onLine is false,
 *   submissions are enqueued in IndexedDB via intakeFetch and return a
 *   synthetic { queued: true, run_id: null, status: "offline_queued" }
 *   response. Callers should use isQueuedResponse() to branch UI accordingly.
 *
 * Tag normalisation: tags are trimmed, lowercased, and deduplicated before
 * being sent to the backend (mirrors the backend's _parse_tags helper logic).
 */

import { intakeFetch } from "@/lib/pwa/intake-fetch";
import type { IntakeResponse } from "@/lib/pwa/intake-fetch";
import { apiFetch } from "@/lib/api/client";

// Re-export helpers so callers don't need to know about the pwa module.
export { isQueuedResponse } from "@/lib/pwa/intake-fetch";
export type { IntakeResponse, IntakeQueuedResponse } from "@/lib/pwa/intake-fetch";

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

export interface IntakeAcceptedResponse {
  run_id: string;
  status: "queued";
  created_at: string;
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export interface SubmitNoteParams {
  /** Raw note text (required, min 1 char). */
  text: string;
  /** Optional tags — normalised (trim + lowercase + dedupe) before sending. */
  tags?: string[];
}

export interface SubmitUrlParams {
  /** Fully-qualified URL (required). */
  url: string;
  /** Optional title override. */
  title?: string;
  /** Optional tags — normalised (trim + lowercase + dedupe) before sending. */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Tag normalisation helper
// ---------------------------------------------------------------------------

/**
 * Normalise a raw tags array:
 *   - Trim whitespace
 *   - Lowercase
 *   - Remove empty strings
 *   - Deduplicate (preserves first occurrence order)
 */
export function normaliseTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of raw) {
    const normalised = tag.trim().toLowerCase();
    if (normalised && !seen.has(normalised)) {
      seen.add(normalised);
      result.push(normalised);
    }
  }
  return result;
}

/**
 * Parse a comma-separated tag string into a normalised array.
 * Returns an empty array for empty/whitespace-only input.
 */
export function parseTagString(raw: string): string[] {
  if (!raw.trim()) return [];
  return normaliseTags(raw.split(","));
}

// ---------------------------------------------------------------------------
// submitNote
// ---------------------------------------------------------------------------

/**
 * POST /api/intake/note
 *
 * Enqueues a plain-text note intake job.
 * Returns 202 Accepted with run_id for SSE stream subscription.
 *
 * When offline (and PWA enabled), returns IntakeQueuedResponse instead.
 * Use isQueuedResponse() to distinguish.
 */
export async function submitNote(
  params: SubmitNoteParams,
): Promise<IntakeResponse> {
  const body: Record<string, unknown> = { text: params.text };

  if (params.tags && params.tags.length > 0) {
    body.tags = normaliseTags(params.tags);
  }

  return intakeFetch<IntakeResponse>("/intake/note", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// submitUrl
// ---------------------------------------------------------------------------

/**
 * POST /api/intake/url
 *
 * Enqueues a URL intake job.
 * Returns 202 Accepted with run_id for SSE stream subscription.
 *
 * When offline (and PWA enabled), returns IntakeQueuedResponse instead.
 */
export async function submitUrl(
  params: SubmitUrlParams,
): Promise<IntakeResponse> {
  const body: Record<string, unknown> = { url: params.url };

  if (params.title?.trim()) {
    body.title = params.title.trim();
  }

  if (params.tags && params.tags.length > 0) {
    body.tags = normaliseTags(params.tags);
  }

  return intakeFetch<IntakeResponse>("/intake/url", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// submitUpload
// ---------------------------------------------------------------------------

/**
 * POST /api/intake/upload
 *
 * Uploads a file (audio, document, image) as a Blob.
 * Returns 202 Accepted with run_id.
 *
 * When offline (and PWA enabled), stores the Blob in IndexedDB and returns
 * IntakeQueuedResponse. IndexedDB natively supports Blob storage.
 *
 * Note: files >25 MB should be rejected by the caller before calling this
 * function (P4-03 audio capture UI handles this validation).
 */
export async function submitUpload(
  blob: Blob,
  contentType: string,
): Promise<IntakeResponse> {
  return intakeFetch<IntakeResponse>("/intake/upload", {
    method: "POST",
    body: blob,
    headers: { "Content-Type": contentType },
  });
}

// ---------------------------------------------------------------------------
// Approval/rejection interfaces
// ---------------------------------------------------------------------------

/** A single intake job awaiting approval. */
export interface IntakePendingItem {
  run_id: string;
  artifact_type: string;
  status: string;
  created_at: string;
  payload: Record<string, unknown>;
}

/** Response shape for GET /api/intake/pending. */
export interface IntakePendingListResponse {
  items: IntakePendingItem[];
  count: number;
}

// ---------------------------------------------------------------------------
// listPending
// ---------------------------------------------------------------------------

/** Fetch all intake jobs awaiting approval from GET /api/intake/pending. */
export async function listPending(): Promise<IntakePendingListResponse> {
  return apiFetch<IntakePendingListResponse>("/intake/pending", {
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// approveIntake
// ---------------------------------------------------------------------------

/** Approve a pending intake job via POST /api/intake/{run_id}/approve. */
export async function approveIntake(
  runId: string,
): Promise<{ status: string; run_id: string }> {
  return apiFetch<{ status: string; run_id: string }>(
    `/intake/${runId}/approve`,
    { method: "POST" },
  );
}

// ---------------------------------------------------------------------------
// rejectIntake
// ---------------------------------------------------------------------------

/** Reject a pending intake job via POST /api/intake/{run_id}/reject. */
export async function rejectIntake(
  runId: string,
): Promise<{ status: string; run_id: string }> {
  return apiFetch<{ status: string; run_id: string }>(
    `/intake/${runId}/reject`,
    { method: "POST" },
  );
}

// ---------------------------------------------------------------------------
// scanInbox
// ---------------------------------------------------------------------------

/** Trigger a manual inbox directory scan via POST /api/admin/inbox/scan. */
export async function scanInbox(): Promise<{ files_enqueued: number }> {
  return apiFetch<{ files_enqueued: number }>("/admin/inbox/scan", {
    method: "POST",
  });
}
