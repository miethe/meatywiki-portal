/**
 * Intake API — typed wrappers for POST /api/intake/note and /api/intake/url.
 *
 * Backend endpoints (portal/api/intake.py):
 *   POST /api/intake/note  → 202 { run_id, status: "queued", created_at }
 *   POST /api/intake/url   → 202 { run_id, status: "queued", created_at }
 *
 * Both endpoints return IntakeAcceptedResponse (202 Accepted). The caller
 * should subscribe to /api/workflows/:run_id/stream (SSE) to track progress.
 *
 * Tag normalisation: tags are trimmed, lowercased, and deduplicated before
 * being sent to the backend (mirrors the backend's _parse_tags helper logic).
 */

import { apiFetch } from "./client";

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
 */
export async function submitNote(
  params: SubmitNoteParams,
): Promise<IntakeAcceptedResponse> {
  const body: Record<string, unknown> = { text: params.text };

  if (params.tags && params.tags.length > 0) {
    body.tags = normaliseTags(params.tags);
  }

  return apiFetch<IntakeAcceptedResponse>("/intake/note", {
    method: "POST",
    body: JSON.stringify(body),
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
 */
export async function submitUrl(
  params: SubmitUrlParams,
): Promise<IntakeAcceptedResponse> {
  const body: Record<string, unknown> = { url: params.url };

  if (params.title?.trim()) {
    body.title = params.title.trim();
  }

  if (params.tags && params.tags.length > 0) {
    body.tags = normaliseTags(params.tags);
  }

  return apiFetch<IntakeAcceptedResponse>("/intake/url", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
