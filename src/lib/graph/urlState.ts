/**
 * urlState.ts — Full URL state model for the vault graph page (P4-07).
 *
 * Encodes/decodes all 8 graph-state dimensions per interaction spec §13:
 *   1. node_id         — deep-link target (UUID)
 *   2. focus_mode      — off|flow|upstream|downstream|k-hop
 *   3. focus_k         — integer 1–5 (only relevant for k-hop)
 *   4. grouping        — grouping axis key
 *   5. mode            — static|dynamic
 *   6. layout_cache_key — FNV-1a hash string from layoutCache
 *   7. filters         — base64(minJSON) for client-side FilterState dims
 *   8. state_hash      — localStorage key when URL > 1800 chars
 *
 * Direct (readable) params (NOT in base64):
 *   ws[], types[], edges[], freshness[], project[], domain[],
 *   date_from, date_to, updated_from, updated_to, q
 *
 * Client-side dims (in base64 blob):
 *   fidelity_min, fscore_min, fscore_max, conf_min, conf_max,
 *   lifecycle, status, verif, tags, sem_node, sem_k
 *
 * Ceiling guard: if url.length > 1800, replace filters blob with
 *   state_hash = fnv1a(JSON.stringify(filterState)).toString(16)
 *   and persist full state to localStorage["graph:shared:{hash}"].
 *
 * On hydration when localStorage entry is missing: returns unfiltered
 * defaults and sets a 'expired' flag so the page can show a toast.
 */

export type FocusMode = "off" | "flow" | "upstream" | "downstream" | "k-hop";
export type GraphMode = "static" | "dynamic";

// Grouping keys — must stay in sync with useGroupingMode / GraphGroupingSelector
export type GroupingMode =
  | "workspace"
  | "artifact_type"
  | "project"
  | "domain"
  | "lens_cluster"
  | "temporal"
  | "semantic_cluster"
  | "none";

// ---------------------------------------------------------------------------
// FilterState — complete interface per filter contract §4
// ---------------------------------------------------------------------------

export interface FilterState {
  // Server-side (also as direct URL params)
  ws?: string[];
  types?: string[];
  edges?: string[];
  freshness?: string[];
  project?: string[];
  domain?: string[];
  date_from?: string;
  date_to?: string;
  updated_from?: string;
  updated_to?: string;
  q?: string;

  // Client-side (serialised into base64 blob)
  fidelity_min?: number;
  fscore_min?: number;
  fscore_max?: number;
  conf_min?: number;
  conf_max?: number;
  lifecycle?: string[];
  status?: string[];
  verif?: string[];
  tags?: string[];
  sem_node?: string;
  sem_k?: number;
}

// ---------------------------------------------------------------------------
// GraphUrlState — the full set of URL-encodable graph state
// ---------------------------------------------------------------------------

export interface GraphUrlState {
  node_id?: string;
  focus_mode?: FocusMode;
  focus_k?: number;
  grouping?: GroupingMode;
  mode?: GraphMode;
  layout_cache_key?: string;
  filters?: FilterState;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const URL_MAX_LENGTH = 1800;
const LS_PREFIX = "graph:shared:";

/** Client-side-only filter keys — go into the base64 blob. */
const CLIENT_FILTER_KEYS: Array<keyof FilterState> = [
  "fidelity_min",
  "fscore_min",
  "fscore_max",
  "conf_min",
  "conf_max",
  "lifecycle",
  "status",
  "verif",
  "tags",
  "sem_node",
  "sem_k",
];

// ---------------------------------------------------------------------------
// FNV-1a hash — 32-bit, enough for localStorage key disambiguation
// ---------------------------------------------------------------------------

/**
 * FNV-1a 32-bit hash of a string. Returns a non-negative integer.
 *
 * We use this both as the layout_cache_key hashing function (per ADR SPIKE 2)
 * and as the state_hash fingerprint for the ceiling guard.
 *
 * Reference: https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Multiply by FNV prime (32-bit) with wrapping arithmetic.
    // Using Math.imul for correct 32-bit signed multiplication.
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit integer.
  return hash >>> 0;
}

// ---------------------------------------------------------------------------
// FilterState serialisation helpers
// ---------------------------------------------------------------------------

/**
 * Serialise only the client-side (base64-blob) dimensions of a FilterState.
 * Returns empty string when no client dims are set.
 */
function serializeClientFilters(state: FilterState): string {
  const blob: Record<string, unknown> = {};
  for (const key of CLIENT_FILTER_KEYS) {
    const val = state[key];
    if (val !== undefined) blob[key] = val;
  }
  if (Object.keys(blob).length === 0) return "";
  try {
    return btoa(JSON.stringify(blob));
  } catch {
    return "";
  }
}

/**
 * Deserialise a base64 filters blob back into client-side FilterState dims.
 * Returns empty object on any error.
 */
function deserializeClientFilters(encoded: string): Partial<FilterState> {
  if (!encoded) return {};
  try {
    return JSON.parse(atob(encoded)) as Partial<FilterState>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// buildUrl — canonical URL producer
// ---------------------------------------------------------------------------

/**
 * Build a canonical URL string for the given graph state.
 *
 * If the resulting URL exceeds URL_MAX_LENGTH (1800 chars):
 *   - The full FilterState is serialised to localStorage under
 *     `graph:shared:{hash}` where hash = fnv1a(JSON.stringify(filters)).
 *   - The `filters` base64 param is replaced by `state_hash={hash}`.
 *   - Direct filter params (ws[], types[], etc.) are still included.
 *
 * @param pathname  The page pathname (e.g. "/graph/vault")
 * @param state     The graph URL state to encode
 * @returns         The full URL string (origin-relative)
 */
export function buildUrl(pathname: string, state: GraphUrlState): string {
  const params = new URLSearchParams();

  // ── interaction params ──
  if (state.node_id) params.set("node_id", state.node_id);
  if (state.focus_mode && state.focus_mode !== "off") {
    params.set("focus_mode", state.focus_mode);
  }
  if (state.focus_k !== undefined && state.focus_k !== 2) {
    params.set("focus_k", String(state.focus_k));
  }
  if (state.grouping && state.grouping !== "workspace") {
    params.set("grouping", state.grouping);
  }
  if (state.mode && state.mode !== "static") {
    params.set("mode", state.mode);
  }
  if (state.layout_cache_key) {
    params.set("layout_cache_key", state.layout_cache_key);
  }

  // ── direct filter params ──
  const f = state.filters ?? {};
  for (const ws of f.ws ?? []) params.append("ws[]", ws);
  for (const t of f.types ?? []) params.append("types[]", t);
  for (const e of f.edges ?? []) params.append("edges[]", e);
  for (const fr of f.freshness ?? []) params.append("freshness[]", fr);
  for (const p of f.project ?? []) params.append("project[]", p);
  for (const d of f.domain ?? []) params.append("domain[]", d);
  if (f.date_from) params.set("date_from", f.date_from);
  if (f.date_to) params.set("date_to", f.date_to);
  if (f.updated_from) params.set("updated_from", f.updated_from);
  if (f.updated_to) params.set("updated_to", f.updated_to);
  if (f.q) params.set("q", f.q);

  // ── client-side filter blob ──
  const clientBlob = serializeClientFilters(f);
  if (clientBlob) params.set("filters", clientBlob);

  // Sort keys for canonical order
  params.sort();

  const candidateUrl = `${pathname}?${params.toString()}`;

  // ── ceiling guard ──
  if (candidateUrl.length > URL_MAX_LENGTH && state.filters) {
    const hash = fnv1a(JSON.stringify(state.filters)).toString(16);
    // Persist full FilterState to localStorage under the hash key
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(`${LS_PREFIX}${hash}`, JSON.stringify(state.filters));
      } catch {
        // localStorage full — fall through and include filters in URL anyway
        return candidateUrl;
      }
    }
    // Rebuild params: replace filters blob with state_hash
    params.delete("filters");
    params.set("state_hash", hash);
    params.sort();
    return `${pathname}?${params.toString()}`;
  }

  return candidateUrl;
}

// ---------------------------------------------------------------------------
// parseUrl — canonical URL consumer
// ---------------------------------------------------------------------------

export interface ParsedUrlState {
  state: GraphUrlState;
  /** True when state_hash was present but localStorage entry is missing. */
  filterStateExpired: boolean;
}

/**
 * Parse a URL (or URLSearchParams) into a GraphUrlState.
 *
 * Missing params fall back to documented defaults:
 *   - focus_mode  → "off"
 *   - focus_k     → 2
 *   - grouping    → "workspace"
 *   - mode        → "static" (consumer must honour prefers-reduced-motion)
 *
 * When state_hash is present:
 *   - Attempts to restore FilterState from localStorage.
 *   - Sets filterStateExpired = true if the entry is missing.
 */
export function parseUrl(
  search: string | URLSearchParams | URL,
): ParsedUrlState {
  let params: URLSearchParams;
  if (search instanceof URL) {
    params = search.searchParams;
  } else if (search instanceof URLSearchParams) {
    params = search;
  } else {
    params = new URLSearchParams(search);
  }

  let filterStateExpired = false;

  // ── interaction params ──
  const node_id = params.get("node_id") ?? undefined;
  const rawFocusMode = params.get("focus_mode");
  const focus_mode: FocusMode =
    rawFocusMode === "flow" ||
    rawFocusMode === "upstream" ||
    rawFocusMode === "downstream" ||
    rawFocusMode === "k-hop"
      ? rawFocusMode
      : "off";

  const rawFocusK = params.get("focus_k");
  const focus_k = rawFocusK !== null ? Math.min(5, Math.max(1, parseInt(rawFocusK, 10))) : 2;

  const rawGrouping = params.get("grouping");
  const validGroupings: GroupingMode[] = [
    "workspace",
    "artifact_type",
    "project",
    "domain",
    "lens_cluster",
    "temporal",
    "semantic_cluster",
    "none",
  ];
  const grouping: GroupingMode = validGroupings.includes(rawGrouping as GroupingMode)
    ? (rawGrouping as GroupingMode)
    : "workspace";

  const rawMode = params.get("mode");
  const mode: GraphMode = rawMode === "dynamic" ? "dynamic" : "static";

  const layout_cache_key = params.get("layout_cache_key") ?? undefined;

  // ── filters ──
  let filters: FilterState = {};

  // Direct params
  const ws = params.getAll("ws[]");
  const types = params.getAll("types[]");
  const edges = params.getAll("edges[]");
  const freshness = params.getAll("freshness[]");
  const project = params.getAll("project[]");
  const domain = params.getAll("domain[]");
  const date_from = params.get("date_from") ?? undefined;
  const date_to = params.get("date_to") ?? undefined;
  const updated_from = params.get("updated_from") ?? undefined;
  const updated_to = params.get("updated_to") ?? undefined;
  const q = params.get("q") ?? undefined;

  if (ws.length) filters.ws = ws;
  if (types.length) filters.types = types;
  if (edges.length) filters.edges = edges;
  if (freshness.length) filters.freshness = freshness;
  if (project.length) filters.project = project;
  if (domain.length) filters.domain = domain;
  if (date_from) filters.date_from = date_from;
  if (date_to) filters.date_to = date_to;
  if (updated_from) filters.updated_from = updated_from;
  if (updated_to) filters.updated_to = updated_to;
  if (q) filters.q = q;

  // Client-side dims from base64 blob or state_hash localStorage
  const stateHash = params.get("state_hash");
  if (stateHash) {
    // Ceiling-guard restoration path
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(`${LS_PREFIX}${stateHash}`);
      if (stored) {
        try {
          const full = JSON.parse(stored) as FilterState;
          filters = { ...filters, ...full };
        } catch {
          filterStateExpired = true;
        }
      } else {
        filterStateExpired = true;
      }
    } else {
      // SSR: can't access localStorage
      filterStateExpired = true;
    }
  } else {
    const filtersBlob = params.get("filters");
    if (filtersBlob) {
      const clientDims = deserializeClientFilters(filtersBlob);
      filters = { ...filters, ...clientDims };
    }
  }

  return {
    state: {
      node_id,
      focus_mode,
      focus_k,
      grouping,
      mode,
      layout_cache_key,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    },
    filterStateExpired,
  };
}

// ---------------------------------------------------------------------------
// Convenience: snapshot current window.location into a GraphUrlState
// ---------------------------------------------------------------------------

/**
 * Read the current window.location.search and return the parsed GraphUrlState.
 * Safe to call from useEffect (client-only).
 */
export function readCurrentUrlState(): ParsedUrlState {
  if (typeof window === "undefined") {
    return { state: { focus_mode: "off", focus_k: 2, grouping: "workspace", mode: "static" }, filterStateExpired: false };
  }
  return parseUrl(window.location.search);
}
