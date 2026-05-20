/**
 * filterChipFormatters — chip label generators for each of the 16 filter dims.
 *
 * Contract: filter contract §3 (chip label format table).
 *
 * Each formatter receives the current `GraphFiltersValues` and returns:
 *   - `null`  when the dim is at its default (chip should not appear)
 *   - a `ChipSummary` when the dim has a non-default value
 *
 * Truncation rule (§3 note): value lists show up to 2 items, then "+N more".
 *
 * v2.2 — graph explorer filter chips (P3-07).
 */

import { GRAPH_FILTERS_DEFAULT, type GraphFiltersValues } from "./GraphFilters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChipSummary {
  /** Display label for the chip body. */
  label: string;
}

export type FilterDimKey = keyof GraphFiltersValues;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Joins up to `max` items with ", " and appends "+N more" when the list
 * is longer than `max`.
 *
 * Example: joinTruncated(["a","b","c","d"], 2) → "a, b +2"
 */
function joinTruncated(items: string[], max = 2): string {
  if (items.length <= max) return items.join(", ");
  const shown = items.slice(0, max).join(", ");
  const rest = items.length - max;
  return `${shown} +${rest}`;
}

/**
 * Formats a numeric value to at most 2 decimal places, dropping trailing zeros.
 * e.g. 0.50 → "0.5", 1.00 → "1", 0.75 → "0.75"
 */
function fmtNum(v: number): string {
  return parseFloat(v.toFixed(2)).toString();
}

/**
 * Fidelity band label: maps 0.0–1.0 to F0–F4.
 * Snaps to nearest quarter.
 */
function fidelityBand(v: number): string {
  const band = Math.round(v * 4);
  return `F${band}`;
}

// ---------------------------------------------------------------------------
// Per-dimension formatters
// ---------------------------------------------------------------------------

/** dim 1: workspace */
function wsChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.ws.length === 0) return null;
  return { label: `workspace: ${joinTruncated(v.ws)}` };
}

/** dim 2: artifact_type */
function typesChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.types.length === 0) return null;
  return { label: `type: ${joinTruncated(v.types)}` };
}

/** dim 3: edge_type */
function edgesChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.edges.length === 0) return null;
  return { label: `edges: ${joinTruncated(v.edges)}` };
}

/** dim 4: freshness_class */
function freshnessChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.freshness.length === 0) return null;
  return { label: `freshness: ${joinTruncated(v.freshness)}` };
}

/** dim 5: project */
function projectChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.project.length === 0) return null;
  return { label: `project: ${joinTruncated(v.project)}` };
}

/** dim 6: domain */
function domainChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.domain.length === 0) return null;
  return { label: `domain: ${joinTruncated(v.domain)}` };
}

/**
 * dim 7: date_range (created + updated).
 *
 * Contract §3 formats:
 *   created:  "created: [from] → [to]"  / "created: since [from]" / "created: until [to]"
 *   updated:  "updated: since [from]"   / etc.
 *
 * Both sub-dims share one chip key (`date_from`) since they're reset together
 * in VaultGraphPageClient. We return a single combined chip when either is set.
 */
function dateChip(v: GraphFiltersValues): ChipSummary | null {
  const hasCreated = !!(v.date_from || v.date_to);
  const hasUpdated = !!(v.updated_from || v.updated_to);
  if (!hasCreated && !hasUpdated) return null;

  const parts: string[] = [];
  if (hasCreated) {
    if (v.date_from && v.date_to) {
      parts.push(`created: ${v.date_from} → ${v.date_to}`);
    } else if (v.date_from) {
      parts.push(`created: since ${v.date_from}`);
    } else {
      parts.push(`created: until ${v.date_to}`);
    }
  }
  if (hasUpdated) {
    if (v.updated_from && v.updated_to) {
      parts.push(`updated: ${v.updated_from} → ${v.updated_to}`);
    } else if (v.updated_from) {
      parts.push(`updated: since ${v.updated_from}`);
    } else {
      parts.push(`updated: until ${v.updated_to}`);
    }
  }
  return { label: parts.join("; ") };
}

/** dim 8: fidelity_level */
function fidelityChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.fidelity_min <= GRAPH_FILTERS_DEFAULT.fidelity_min) return null;
  return { label: `fidelity: ${fidelityBand(v.fidelity_min)}+` };
}

/** dim 9: freshness_score */
function fscoreChip(v: GraphFiltersValues): ChipSummary | null {
  const isDefault =
    v.fscore_min <= GRAPH_FILTERS_DEFAULT.fscore_min &&
    v.fscore_max >= GRAPH_FILTERS_DEFAULT.fscore_max;
  if (isDefault) return null;
  return { label: `freshness score: ${fmtNum(v.fscore_min)}–${fmtNum(v.fscore_max)}` };
}

/** dim 10: classification_confidence */
function confChip(v: GraphFiltersValues): ChipSummary | null {
  const isDefault =
    v.conf_min <= GRAPH_FILTERS_DEFAULT.conf_min &&
    v.conf_max >= GRAPH_FILTERS_DEFAULT.conf_max;
  if (isDefault) return null;

  // Special-case: "low confidence only" preset
  if (v.conf_min === 0 && v.conf_max <= 0.5) {
    return { label: `confidence: <${fmtNum(v.conf_max)}` };
  }
  return { label: `confidence: ${fmtNum(v.conf_min)}–${fmtNum(v.conf_max)}` };
}

/** dim 11: lifecycle_stage */
function lifecycleChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.lifecycle.length === 0) return null;
  return { label: `lifecycle: ${joinTruncated(v.lifecycle)}` };
}

/** dim 12: status */
function statusChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.status.length === 0) return null;
  return { label: `status: ${joinTruncated(v.status)}` };
}

/** dim 13: verification_status */
function verifChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.verif.length === 0) return null;
  return { label: `verified: ${joinTruncated(v.verif)}` };
}

/** dim 14: tags */
function tagsChip(v: GraphFiltersValues): ChipSummary | null {
  if (v.tags.length === 0) return null;
  return { label: `tags: ${joinTruncated(v.tags)}` };
}

/** dim 15: semantic_neighbor — placeholder, never active until SPIKE 2 */
function semChip(v: GraphFiltersValues): ChipSummary | null {
  if (!v.sem_node) return null;
  return { label: `similar to: ${v.sem_node} (k=${v.sem_k})` };
}

/** dim 16: free-text */
function qChip(v: GraphFiltersValues): ChipSummary | null {
  if (!v.q) return null;
  return { label: `search: ${v.q}` };
}

// ---------------------------------------------------------------------------
// Master registry: FilterDimKey → (formatter, human-readable dim label)
//
// The `dimKey` here is the primary FilterState key for that dimension.
// For multi-key dims (date_range: date_from/date_to + updated_from/updated_to),
// we use `date_from` as the representative key.
// ---------------------------------------------------------------------------

export interface FilterDimChipDef {
  /** Primary key into GraphFiltersValues for this dim. */
  dimKey: FilterDimKey;
  /** Human-readable dimension name for ARIA/tooltip. */
  dimLabel: string;
  /** Returns null if the dim is at its default value. */
  formatter: (values: GraphFiltersValues) => ChipSummary | null;
}

/**
 * Ordered chip registry. Order matches filter contract §10 priority order.
 *
 * Dims with multiple keys (date_range) use their primary key here;
 * `onClearDim` in GraphFilterChips is responsible for clearing all sub-keys.
 */
export const FILTER_DIM_CHIP_DEFS: FilterDimChipDef[] = [
  // Primary
  { dimKey: "ws",           dimLabel: "Workspace",                 formatter: wsChip       },
  { dimKey: "types",        dimLabel: "Artifact type",             formatter: typesChip    },
  { dimKey: "edges",        dimLabel: "Edge type",                 formatter: edgesChip    },
  // Secondary
  { dimKey: "freshness",    dimLabel: "Freshness class",           formatter: freshnessChip },
  { dimKey: "project",      dimLabel: "Project",                   formatter: projectChip  },
  { dimKey: "domain",       dimLabel: "Domain",                    formatter: domainChip   },
  { dimKey: "date_from",    dimLabel: "Date range",                formatter: dateChip     },
  // Advanced
  { dimKey: "fidelity_min", dimLabel: "Fidelity level",           formatter: fidelityChip },
  { dimKey: "fscore_min",   dimLabel: "Freshness score",          formatter: fscoreChip   },
  { dimKey: "conf_min",     dimLabel: "Classification confidence", formatter: confChip     },
  { dimKey: "lifecycle",    dimLabel: "Lifecycle stage",           formatter: lifecycleChip },
  { dimKey: "status",       dimLabel: "Status",                    formatter: statusChip   },
  { dimKey: "verif",        dimLabel: "Verification status",       formatter: verifChip    },
  { dimKey: "tags",         dimLabel: "Tags",                      formatter: tagsChip     },
  { dimKey: "sem_node",     dimLabel: "Semantic neighbor",         formatter: semChip      },
  // Always visible (free-text)
  { dimKey: "q",            dimLabel: "Search",                    formatter: qChip        },
];
