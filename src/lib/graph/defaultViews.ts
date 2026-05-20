/**
 * defaultViews.ts — 7 read-only built-in graph view presets.
 *
 * These are never persisted to localStorage (they live in code).
 * Each has a stable `id` prefixed with "preset:" to distinguish from
 * user-saved views.
 *
 * Preset catalogue:
 *   preset:all              — All artifacts (no filters, full graph)
 *   preset:recent           — Recent activity (fresh + stale freshness, last 30 days)
 *   preset:unverified       — Unverified artifacts only
 *   preset:core             — Knowledge core (concepts, syntheses, topics)
 *   preset:low-confidence   — Low extraction confidence (conf_max = 0.7)
 *   preset:research-threads — Research workspace artifacts
 *   preset:fit-selection    — No filters; fit-selection camera preset (active on selection)
 *
 * v2.2 — graph explorer default views (P3-06, P4-06 ext).
 */

import { GRAPH_FILTERS_DEFAULT, type GraphFiltersValues } from "@/components/graph/GraphFilters";
import type { SavedView } from "./savedViews";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO-8601 date string N days before today (UTC). */
function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// Default presets
// ---------------------------------------------------------------------------

/**
 * "All artifacts" — a clean slate with no active filters.
 * Applies the graph defaults as-is so the full vault is visible.
 */
const presetAll: SavedView = {
  id: "preset:all",
  name: "All artifacts",
  filter: { ...GRAPH_FILTERS_DEFAULT },
  cameraPreset: "default",
  grouping: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * "Recent activity" — artifacts updated in the last 30 days, showing only
 * fresh and stale freshness classes.
 */
const presetRecent: SavedView = {
  id: "preset:recent",
  name: "Recent activity",
  filter: {
    ...GRAPH_FILTERS_DEFAULT,
    freshness: ["fresh", "stale"] as GraphFiltersValues["freshness"],
    updated_from: daysAgo(30),
  },
  cameraPreset: "recent-activity",
  grouping: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * "Unverified" — artifacts whose verification_status is 'unverified'.
 * Useful for triaging content that needs a human review pass.
 */
const presetUnverified: SavedView = {
  id: "preset:unverified",
  name: "Unverified",
  filter: {
    ...GRAPH_FILTERS_DEFAULT,
    verif: ["unverified"] as GraphFiltersValues["verif"],
  },
  cameraPreset: null,
  grouping: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * "Knowledge core" — the conceptual backbone of the vault: concepts,
 * syntheses, and topics only. Good for understanding the high-level structure.
 */
const presetCore: SavedView = {
  id: "preset:core",
  name: "Knowledge core",
  filter: {
    ...GRAPH_FILTERS_DEFAULT,
    types: ["concept", "synthesis", "topic"] as GraphFiltersValues["types"],
  },
  cameraPreset: "high-fidelity-core",
  grouping: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * "Low confidence" — artifacts where classification confidence is below the
 * review threshold (conf_max clamped to 0.7).  Camera preset frames nodes in
 * the low-confidence-review cluster.
 */
const presetLowConfidence: SavedView = {
  id: "preset:low-confidence",
  name: "Low confidence",
  filter: {
    ...GRAPH_FILTERS_DEFAULT,
    conf_max: 0.7,
  },
  cameraPreset: "low-confidence-review",
  grouping: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * "Research threads" — artifacts in the 'research' workspace.
 * Camera preset pans to nodes whose workspace attribute is 'research'.
 */
const presetResearchThreads: SavedView = {
  id: "preset:research-threads",
  name: "Research threads",
  filter: {
    ...GRAPH_FILTERS_DEFAULT,
    ws: ["research"] as GraphFiltersValues["ws"],
  },
  cameraPreset: "research-threads",
  grouping: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * "Fit selection" — no filters; applies the fit-selection camera preset.
 * Useful after a lasso selection to frame the chosen nodes.  Appears disabled
 * (or is a no-op) when no selection is active — the camera preset handles that
 * gracefully by falling back to the default view.
 */
const presetFitSelection: SavedView = {
  id: "preset:fit-selection",
  name: "Fit selection",
  filter: { ...GRAPH_FILTERS_DEFAULT },
  cameraPreset: "fit-selection",
  grouping: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Exported list (ordered for display)
// ---------------------------------------------------------------------------

/** Read-only built-in view presets, shown at the top of the SavedViewsMenu. */
export const DEFAULT_VIEWS: readonly SavedView[] = [
  presetAll,
  presetRecent,
  presetUnverified,
  presetCore,
  presetLowConfidence,
  presetResearchThreads,
  presetFitSelection,
] as const;

/**
 * Check whether a given view id belongs to a default preset.
 * Used by SavedViewsMenu to suppress the delete button on preset rows.
 */
export function isDefaultView(id: string): boolean {
  return id.startsWith("preset:");
}
