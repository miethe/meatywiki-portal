/**
 * Search API — typed wrapper around GET /api/search.
 *
 * Backend contract (M-03 / Wave 1 audit):
 *   - ?q=<text>&mode=fts|semantic|hybrid&limit=<n>&cursor=<token>
 *   - 200: { data: ArtifactCard[], cursor: string | null, degraded?: boolean }
 *   - 409: { error: { code: "embeddings_not_ready", message: string } }
 *     Returned when mode=semantic or mode=hybrid and the embeddings index is empty.
 *     FTS mode and "embeddings warm" 200 paths are unchanged.
 *     200 hybrid/semantic where embeddings provider transiently errors continue to
 *     degrade silently (degraded=true on the response) — no banner needed for those.
 *
 * Usage:
 *   try {
 *     const result = await search({ q: "...", mode: "semantic" });
 *   } catch (e) {
 *     if (isEmbeddingsNotReadyError(e)) { ... }
 *   }
 */

import { apiFetch, ApiError } from "./client";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Search mode
// ---------------------------------------------------------------------------

export type SearchMode = "fts" | "semantic" | "hybrid";

// ---------------------------------------------------------------------------
// Request params
// ---------------------------------------------------------------------------

export interface SearchParams {
  /** Full-text query string */
  q: string;
  /** Search mode — defaults to "fts" when omitted */
  mode?: SearchMode;
  /** Pagination cursor — opaque token from previous response */
  cursor?: string | null;
  /** Page size */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface SearchResult {
  data: ArtifactCard[];
  cursor: string | null;
  /**
   * When true, the backend executed a degraded search path (e.g. semantic fell
   * back to FTS because the embeddings provider had a transient error). The
   * results are still valid FTS results; no user-visible error needed.
   */
  degraded?: boolean;
}

// ---------------------------------------------------------------------------
// Typed error for 409 embeddings_not_ready
// ---------------------------------------------------------------------------

export class EmbeddingsNotReadyError extends Error {
  constructor(message?: string) {
    super(message ?? "Embeddings haven't been generated for your vault.");
    this.name = "EmbeddingsNotReadyError";
  }
}

/**
 * Type guard — narrows an unknown thrown value to EmbeddingsNotReadyError.
 *
 * Usage:
 *   catch (e) {
 *     if (isEmbeddingsNotReadyError(e)) { ... }
 *   }
 */
export function isEmbeddingsNotReadyError(
  e: unknown,
): e is EmbeddingsNotReadyError {
  return e instanceof EmbeddingsNotReadyError;
}

// ---------------------------------------------------------------------------
// API function
// ---------------------------------------------------------------------------

/**
 * Execute a search query against GET /api/search.
 *
 * Throws `EmbeddingsNotReadyError` when the backend returns 409 with
 * `error.code === "embeddings_not_ready"`. All other non-2xx statuses
 * propagate as `ApiError`.
 */
export async function search(params: SearchParams): Promise<SearchResult> {
  const { q, mode = "fts", cursor, limit = 20 } = params;

  const query = new URLSearchParams();
  query.set("q", q);
  query.set("mode", mode);
  if (cursor) query.set("cursor", cursor);
  query.set("limit", String(limit));

  const path = `/search?${query.toString()}`;

  try {
    return await apiFetch<SearchResult>(path, { method: "GET" });
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.status === 409 &&
      isEmbeddingsNotReadyBody(err.body)
    ) {
      const body = err.body as EmbeddingsNotReadyBody;
      throw new EmbeddingsNotReadyError(body.error.message);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface EmbeddingsNotReadyBody {
  error: { code: "embeddings_not_ready"; message: string };
}

function isEmbeddingsNotReadyBody(body: unknown): body is EmbeddingsNotReadyBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b["error"] !== "object" || b["error"] === null) return false;
  const err = b["error"] as Record<string, unknown>;
  return err["code"] === "embeddings_not_ready";
}
