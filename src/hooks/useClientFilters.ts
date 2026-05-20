/**
 * useClientFilters — apply client-side filter dimensions (8–14) to a loaded
 * graphology graph by toggling each node's `hidden` attribute.
 *
 * This hook does NOT trigger a server refetch. It operates purely on the
 * in-memory graphology instance and calls sigma.refresh() once after all
 * nodes have been updated.
 *
 * Dimensions handled (filter contract §1):
 *   8  — fidelity_level   (node.fidelity_level: F0..F4 enum → numeric 0..4)
 *   9  — freshness_score  (node.freshness_score: 0..1 float)
 *   10 — classification_confidence (0..1 float)
 *   11 — lifecycle_stage  (set membership)
 *   12 — status           (set membership)
 *   13 — verification_status (set membership)
 *   14 — tags             (any-match)
 *
 * Performance:
 *   - O(N) single pass over graph nodes, early-exit predicate chain.
 *   - 10K nodes × ~7 checks ≈ 70K comparisons — well under one animation frame.
 *   - Updates debounced at 100ms so typing in sliders/tag inputs doesn't
 *     trigger mid-keystroke recomputes.
 *   - sigma.refresh() called once at the end, not per-node.
 *
 * Usage:
 *   Call inside a component that is a descendant of <SigmaContainer>. The
 *   hook reads the sigma instance via useSigma() (react-sigma v3 context).
 *   Pass the full GraphFiltersValues object; only client dims are read.
 *
 * Coordination with P3-03 (useGraphFilterState):
 *   P3-03 manages URL state and the unified filter values object. This hook
 *   only reads the client-dim keys; server-dim changes are handled by
 *   useVaultGraph (refetch). If useGraphFilterState is not yet available,
 *   VaultGraphPageClient passes graphFilterValues directly.
 *
 * v2.2 — graph explorer client filter wiring (P3-04).
 */

"use client";

import { useEffect, useRef } from "react";
import { useSigma } from "@react-sigma/core";
import type { GraphFiltersValues } from "@/components/graph/GraphFilters";
import { isSigmaKilled } from "@/lib/graph/sigmaLifecycle";

// ---------------------------------------------------------------------------
// Fidelity level → numeric index mapping
// ---------------------------------------------------------------------------

/** Map F0..F4 string to a 0..4 integer for range comparison. */
const FIDELITY_NUMERIC: Record<string, number> = {
  F0: 0,
  F1: 1,
  F2: 2,
  F3: 3,
  F4: 4,
};

/**
 * Convert a `fidelity_min` slider value (0.0..1.0, stepped at 0.25) to the
 * minimum fidelity band integer. The slider maps:
 *   0.00 → F0 (min=0), 0.25 → F1 (min=1), 0.50 → F2 (min=2),
 *   0.75 → F3 (min=3), 1.00 → F4 (min=4).
 */
function fidelitySliderToMinInt(sliderVal: number): number {
  return Math.round(sliderVal * 4);
}

// ---------------------------------------------------------------------------
// Per-node predicate
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the node should be VISIBLE (i.e. `hidden` = false).
 *
 * All checks use the graphology node attributes set by buildVaultGraph.
 * Missing attributes are treated as "passes the filter" so that older API
 * responses (which omit extended DTO fields) show all nodes rather than
 * hiding everything.
 *
 * Filter contract §1 predicate semantics:
 *   - Numeric ranges: node value must fall within [min, max] (inclusive).
 *   - Empty arrays: no filter active → all values pass.
 *   - Non-empty arrays: node value must be present in the set (any-match for tags).
 */
function matchesClientFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attrs: Record<string, any>,
  filters: GraphFiltersValues,
): boolean {
  // ── Dim 8: fidelity_level ─────────────────────────────────────────────────
  if (filters.fidelity_min > 0) {
    const rawLevel: string | null | undefined = attrs.fidelity_level;
    const nodeLevel = rawLevel != null ? (FIDELITY_NUMERIC[rawLevel] ?? 0) : 0;
    const minLevel = fidelitySliderToMinInt(filters.fidelity_min);
    if (nodeLevel < minLevel) return false;
  }

  // ── Dim 9: freshness_score ────────────────────────────────────────────────
  // Only applies if the attribute is present (older responses omit it).
  if (filters.fscore_min > 0 || filters.fscore_max < 1) {
    const rawScore: number | null | undefined = attrs.freshness_score;
    if (rawScore != null) {
      if (rawScore < filters.fscore_min || rawScore > filters.fscore_max) return false;
    }
    // If freshness_score is absent, node passes (defensive default).
  }

  // ── Dim 10: classification_confidence ─────────────────────────────────────
  if (filters.conf_min > 0 || filters.conf_max < 1) {
    const rawConf: number | null | undefined = attrs.classification_confidence;
    if (rawConf != null) {
      if (rawConf < filters.conf_min || rawConf > filters.conf_max) return false;
    }
    // Absent → passes.
  }

  // ── Dim 11: lifecycle_stage ───────────────────────────────────────────────
  if (filters.lifecycle.length > 0) {
    const rawLifecycle: string | null | undefined = attrs.lifecycle_stage ?? attrs.lifecycle;
    if (rawLifecycle == null || !filters.lifecycle.includes(rawLifecycle)) return false;
  }

  // ── Dim 12: status ────────────────────────────────────────────────────────
  if (filters.status.length > 0) {
    const rawStatus: string | null | undefined = attrs.status;
    if (rawStatus == null || !filters.status.includes(rawStatus)) return false;
  }

  // ── Dim 13: verification_status ───────────────────────────────────────────
  if (filters.verif.length > 0) {
    const rawVerif: string | null | undefined =
      attrs.verification_status ?? attrs.verif_status ?? attrs.verif;
    if (rawVerif == null || !filters.verif.includes(rawVerif)) return false;
  }

  // ── Dim 14: tags (any-match) ──────────────────────────────────────────────
  if (filters.tags.length > 0) {
    const rawTags: string[] | null | undefined = attrs.tags;
    if (!Array.isArray(rawTags) || rawTags.length === 0) return false;
    const hasAnyTag = filters.tags.some((t) => rawTags.includes(t));
    if (!hasAnyTag) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useClientFilters` — apply dims 8–14 to the sigma/graphology graph by
 * toggling `hidden` on each node, then calling sigma.refresh().
 *
 * Must be called from a component rendered inside `<SigmaContainer>` so that
 * `useSigma()` can resolve the instance.
 *
 * @param filterValues - The full GraphFiltersValues object (only client dims are read).
 */
export function useClientFilters(filterValues: GraphFiltersValues): void {
  const sigma = useSigma();

  // Store the latest filter values in a ref so the debounced callback always
  // reads the most recent snapshot without capturing stale closures.
  const filterRef = useRef<GraphFiltersValues>(filterValues);
  filterRef.current = filterValues;

  // Debounce timer ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Cancel any pending debounced update before scheduling a new one.
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;

      // Guard against the @react-sigma/core killed-instance window. The
      // captured `sigma` closure can outlive its instance when the
      // SigmaContainer `graph` prop changes ref (parent cleanup kills the
      // instance before subsequent renders propagate a new sigma). Skipping
      // here is safe — the next render will mount this effect again with the
      // fresh sigma. See src/lib/graph/sigmaLifecycle.ts.
      if (isSigmaKilled(sigma)) return;

      const graph = sigma.getGraph();
      if (graph.order === 0) return;

      const currentFilters = filterRef.current;

      // Single O(N) pass: update `hidden` attribute for every node.
      graph.forEachNode((nodeId, attrs) => {
        const filterVisible = matchesClientFilters(attrs, currentFilters);
        // P3-11: a node is visible iff it passes client filters AND is not
        // cluster-collapsed. `clusterHidden` is set by useClusterExpandCollapse;
        // when absent it defaults to false (backward compatible).
        const clusterHidden: boolean = attrs.clusterHidden === true;
        const visible = filterVisible && !clusterHidden;
        // Only call setNodeAttribute when the value actually changes to avoid
        // unnecessary graphology change events.
        if (attrs.hidden !== !visible) {
          graph.setNodeAttribute(nodeId, "hidden", !visible);
        }
      });

      // One sigma.refresh() at the end — not per-node.
      sigma.refresh();
    }, 100);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    sigma,
    // Client dims 8–14 — react only to these keys, not the full object.
    // Using primitive values for deps avoids stale-closure/deep-equality issues.
    filterValues.fidelity_min,
    filterValues.fscore_min,
    filterValues.fscore_max,
    filterValues.conf_min,
    filterValues.conf_max,
    // Arrays: join to a stable string dep so React compares by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    filterValues.lifecycle.join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    filterValues.status.join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    filterValues.verif.join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    filterValues.tags.join(","),
  ]);
}
