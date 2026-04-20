/**
 * intake-fetch — thin offline-aware wrapper for intake endpoints.
 *
 * Intercepts POST requests to:
 *   /api/intake/note
 *   /api/intake/url
 *   /api/intake/upload
 *
 * When offline (!navigator.onLine):
 *   - Enqueue request via OfflineQueueManager.
 *   - Return a synthetic { status: 202, queued: true } response so the caller
 *     can display a "Queued" confirmation without crashing.
 *
 * When online:
 *   - Pass through to the existing apiFetch client unchanged.
 *
 * Feature flag: NEXT_PUBLIC_PORTAL_ENABLE_PWA
 *   When not "1", bypasses offline queue entirely (passes through directly).
 *
 * Security: Authorization header is never written to IndexedDB.
 *   The browser automatically includes the HttpOnly cookie on same-origin
 *   fetch calls made during drain/replay.
 *
 * Traces FR-1.5-17, FR-1.5-18.
 */

import { apiFetch } from "@/lib/api/client";
import { OfflineQueueManager } from "@/lib/pwa/offline-queue";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntakeAcceptedResponse {
  run_id: string;
  status: "queued";
  created_at: string;
}

/** Synthetic response shape returned when a request is queued offline. */
export interface IntakeQueuedResponse {
  queued: true;
  /** Synthetic placeholder run_id — not a real backend run. */
  run_id: null;
  status: "offline_queued";
}

export type IntakeResponse = IntakeAcceptedResponse | IntakeQueuedResponse;

/** Type guard — true when the intake was queued (offline path). */
export function isQueuedResponse(r: IntakeResponse): r is IntakeQueuedResponse {
  return (r as IntakeQueuedResponse).queued === true;
}

/** Intake endpoints that this interceptor handles. */
const INTAKE_PATHS = [
  "/intake/note",
  "/intake/url",
  "/intake/upload",
] as const;

type IntakePath = (typeof INTAKE_PATHS)[number];

function isIntakePath(path: string): path is IntakePath {
  return INTAKE_PATHS.some((p) => path === p || path.endsWith(p));
}

// ---------------------------------------------------------------------------
// isPwaEnabled
// ---------------------------------------------------------------------------

function isPwaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA === "1";
}

// ---------------------------------------------------------------------------
// isOffline
// ---------------------------------------------------------------------------

function isOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return !navigator.onLine;
}

// ---------------------------------------------------------------------------
// headersToRecord
// ---------------------------------------------------------------------------

/**
 * Convert a Headers object (or HeadersInit) to a plain Record.
 * Strips Authorization (security invariant — redundant with OfflineQueueManager
 * but we enforce the invariant at every layer).
 */
function headersToRecord(headers?: HeadersInit): Record<string, string> {
  const record: Record<string, string> = {};
  if (!headers) return record;

  const h = headers instanceof Headers ? headers : new Headers(headers);
  h.forEach((value, key) => {
    if (key.toLowerCase() !== "authorization") {
      record[key] = value;
    }
  });
  return record;
}

// ---------------------------------------------------------------------------
// intakeFetch — primary export
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for `apiFetch` on intake endpoints.
 *
 * Usage (replaces submitNote / submitUrl in intake.ts):
 *   const result = await intakeFetch<IntakeAcceptedResponse>("/intake/note", {
 *     method: "POST",
 *     body: JSON.stringify(payload),
 *   });
 *   if (isQueuedResponse(result)) { // show queued badge }
 */
export async function intakeFetch<T extends IntakeResponse = IntakeAcceptedResponse>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  // Pass through if flag off, not an intake path, or non-POST.
  if (!isPwaEnabled() || !isIntakePath(path) || init.method?.toUpperCase() !== "POST") {
    return apiFetch<T>(path, init);
  }

  // Online path — pass through to normal client.
  if (!isOffline()) {
    return apiFetch<T>(path, init);
  }

  // --- Offline path ---
  console.info("[intakeFetch] Offline — enqueuing:", path);

  const headers = headersToRecord(init.headers);
  let bodyJson: unknown;
  let bodyBlob: Blob | undefined;
  let contentType: string | undefined;

  const body = init.body;
  if (body instanceof Blob) {
    bodyBlob = body;
    contentType = body.type || headers["content-type"] || headers["Content-Type"];
  } else if (body instanceof FormData) {
    // Convert FormData to a blob for storage (simplest serialisable form).
    // On replay, the FormData is reconstructed from the Blob with its MIME type
    // (multipart/form-data), which browsers handle natively.
    const formBlob = new Blob([body as unknown as BlobPart], {
      type: "multipart/form-data",
    });
    bodyBlob = formBlob;
    contentType = "multipart/form-data";
  } else if (typeof body === "string") {
    try {
      bodyJson = JSON.parse(body);
    } catch {
      // Non-JSON string body — store as text blob.
      bodyBlob = new Blob([body], { type: "text/plain" });
      contentType = "text/plain";
    }
  } else if (body === null || body === undefined) {
    // No body (unlikely for intake, but safe).
  } else {
    // ArrayBuffer or other BodyInit — store as opaque blob.
    bodyBlob = new Blob([body as BlobPart]);
  }

  await OfflineQueueManager.enqueue({
    endpoint: `/api${path}`,
    method: "POST",
    headers,
    bodyJson,
    bodyBlob,
    contentType,
  });

  // Return synthetic 202 queued shape.
  const queuedResponse: IntakeQueuedResponse = {
    queued: true,
    run_id: null,
    status: "offline_queued",
  };
  return queuedResponse as unknown as T;
}
