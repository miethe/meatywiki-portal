/**
 * filterUrlCodec — encode/decode client-side graph filter dims to/from a
 * base64 URL parameter.
 *
 * Client dims (8–14) are serialised as a single `filters` URL param to
 * separate them from server dims (1–7) which use individual query params.
 * P3-03 (useGraphFilterState) owns the URL read/write lifecycle; this module
 * provides the pure encode/decode helpers so both P3-03 and P3-04 share a
 * single serialisation contract.
 *
 * Encoding: JSON → UTF-8 bytes → base64url (URL-safe variant, no padding).
 * Decoding: reverse; falls back to `null` on any parse error so callers can
 * treat a missing / corrupted `filters` param as "no client filters active".
 *
 * Filter contract §2 (portal-v2.2-graph-filter-contract.md):
 *   Dims 8–14 live in the `filters` base64 blob.
 *   Server dims 1–7 use individual query params (P3-03 territory).
 *
 * v2.2 — graph explorer client filter serialisation (P3-04).
 */

import type { GraphFiltersValues } from "@/components/graph/GraphFilters";

// ---------------------------------------------------------------------------
// Client-dim subset type
// ---------------------------------------------------------------------------

/**
 * The subset of GraphFiltersValues that belongs to the client side (dims 8–14).
 * Only these fields are serialised into the `filters` base64 URL param.
 */
export interface ClientFilterDims {
  /** Dim 8: fidelity_level minimum (0 = no filter, i.e. F0+). */
  fidelity_min: number;
  /** Dim 9: freshness_score range. */
  fscore_min: number;
  fscore_max: number;
  /** Dim 10: classification_confidence range. */
  conf_min: number;
  conf_max: number;
  /** Dim 11: lifecycle_stage — empty = no filter. */
  lifecycle: string[];
  /** Dim 12: status — empty = no filter. */
  status: string[];
  /** Dim 13: verification_status — empty = no filter. */
  verif: string[];
  /** Dim 14: tags — empty = no filter. */
  tags: string[];
}

/** Default (no-filter) values for client dims. */
export const CLIENT_FILTER_DEFAULTS: ClientFilterDims = {
  fidelity_min: 0,
  fscore_min: 0,
  fscore_max: 1,
  conf_min: 0,
  conf_max: 1,
  lifecycle: [],
  status: [],
  verif: [],
  tags: [],
};

// ---------------------------------------------------------------------------
// Extract client dims from the full filter values object
// ---------------------------------------------------------------------------

/**
 * Pluck only the client-side dimensions from the full GraphFiltersValues object.
 * This is a pure projection — no mutation.
 */
export function extractClientDims(values: GraphFiltersValues): ClientFilterDims {
  return {
    fidelity_min: values.fidelity_min,
    fscore_min: values.fscore_min,
    fscore_max: values.fscore_max,
    conf_min: values.conf_min,
    conf_max: values.conf_max,
    lifecycle: values.lifecycle,
    status: values.status,
    verif: values.verif,
    tags: values.tags,
  };
}

// ---------------------------------------------------------------------------
// Encode: client dims → base64url string
// ---------------------------------------------------------------------------

/**
 * Serialise the client-dim subset to a URL-safe base64 string.
 *
 * Uses `btoa` (available in all modern browsers and Node 18+). The JSON is
 * compacted (no whitespace) to minimise URL length. The result uses base64url
 * encoding (replaces `+` → `-`, `/` → `_`, strips `=` padding) per RFC 4648 §5.
 */
export function encodeClientFilters(dims: ClientFilterDims): string {
  const json = JSON.stringify(dims);
  // btoa operates on binary strings; encode UTF-8 manually for safety.
  const b64 = btoa(unescape(encodeURIComponent(json)));
  // base64url: no padding, URL-safe chars
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Decode: base64url string → client dims (or null on failure)
// ---------------------------------------------------------------------------

/**
 * Decode a `filters` URL param back to ClientFilterDims.
 *
 * Returns `null` if the value is absent, empty, or cannot be decoded/parsed.
 * Callers should treat `null` as "no client filters active" (use defaults).
 *
 * Partial objects are accepted: missing keys fall back to `CLIENT_FILTER_DEFAULTS`,
 * preventing crashes when a future version adds new dims to the codec.
 */
export function decodeClientFilters(b64: string | null | undefined): ClientFilterDims | null {
  if (!b64) return null;
  try {
    // Re-pad and restore standard base64 chars before decoding.
    const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (padded.length % 4)) % 4;
    const padded64 = padded + "=".repeat(padding);
    const json = decodeURIComponent(escape(atob(padded64)));
    const parsed: Partial<ClientFilterDims> = JSON.parse(json);

    // Merge with defaults so missing keys don't cause runtime errors.
    return {
      fidelity_min: typeof parsed.fidelity_min === "number" ? parsed.fidelity_min : CLIENT_FILTER_DEFAULTS.fidelity_min,
      fscore_min: typeof parsed.fscore_min === "number" ? parsed.fscore_min : CLIENT_FILTER_DEFAULTS.fscore_min,
      fscore_max: typeof parsed.fscore_max === "number" ? parsed.fscore_max : CLIENT_FILTER_DEFAULTS.fscore_max,
      conf_min: typeof parsed.conf_min === "number" ? parsed.conf_min : CLIENT_FILTER_DEFAULTS.conf_min,
      conf_max: typeof parsed.conf_max === "number" ? parsed.conf_max : CLIENT_FILTER_DEFAULTS.conf_max,
      lifecycle: Array.isArray(parsed.lifecycle) ? parsed.lifecycle : CLIENT_FILTER_DEFAULTS.lifecycle,
      status: Array.isArray(parsed.status) ? parsed.status : CLIENT_FILTER_DEFAULTS.status,
      verif: Array.isArray(parsed.verif) ? parsed.verif : CLIENT_FILTER_DEFAULTS.verif,
      tags: Array.isArray(parsed.tags) ? parsed.tags : CLIENT_FILTER_DEFAULTS.tags,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Predicate: are all client dims at their default (no-filter) values?
// ---------------------------------------------------------------------------

/**
 * Returns `true` when all client dims are at their no-filter defaults.
 * Useful to skip encoding (omit the `filters` param from the URL entirely).
 */
export function isClientFilterDefault(dims: ClientFilterDims): boolean {
  const d = CLIENT_FILTER_DEFAULTS;
  return (
    dims.fidelity_min === d.fidelity_min &&
    dims.fscore_min === d.fscore_min &&
    dims.fscore_max === d.fscore_max &&
    dims.conf_min === d.conf_min &&
    dims.conf_max === d.conf_max &&
    dims.lifecycle.length === 0 &&
    dims.status.length === 0 &&
    dims.verif.length === 0 &&
    dims.tags.length === 0
  );
}
