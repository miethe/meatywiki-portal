"use client";

/**
 * useClusterAssignment — applies cluster_id to graphology nodes whenever the
 * active grouping mode changes, then calls sigma.refresh() so the renderer
 * picks up the updated attribute.
 *
 * Must be called inside a SigmaContainer subtree so useSigma() can resolve.
 *
 * v2.2 — graph explorer grouping selector (P3-09).
 */

import { useEffect } from "react";
import { useSigma } from "@react-sigma/core";
import { type GroupingMode, computeClusterId } from "@/lib/graph/groupingModes";
import { isSigmaKilled } from "@/lib/graph/sigmaLifecycle";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param groupingMode  - Currently selected grouping mode.
 */
export function useClusterAssignment(groupingMode: GroupingMode): void {
  const sigma = useSigma();

  useEffect(() => {
    // Guard against the @react-sigma/core killed-instance window. When the
    // SigmaContainer `graph` prop changes ref, the parent's useEffect cleanup
    // calls `kill()` BEFORE this child's setup re-runs with the new sigma
    // (effect setups also run child-first, but the parent's cleanup precedes
    // all setups). The stale closure here would otherwise call refresh() on a
    // dead instance and throw "could not find a suitable program for node
    // type 'circle'". See src/lib/graph/sigmaLifecycle.ts for full rationale.
    if (isSigmaKilled(sigma)) return;

    const graph = sigma.getGraph();
    if (!graph) return;

    graph.forEachNode((id) => {
      const attrs = graph.getNodeAttributes(id);
      const clusterId = computeClusterId(
        {
          workspace:    attrs.workspace      ?? null,
          artifact_type: attrs.artifact_type ?? null,
          project:      attrs.project        ?? null,
          domain:       attrs.domain         ?? null,
          fidelity_level: attrs.fidelity_level ?? null,
          updated_at:   attrs.updated_at     ?? null,
        },
        groupingMode,
      );
      graph.setNodeAttribute(id, "cluster_id", clusterId);
    });

    sigma.refresh();
  }, [sigma, groupingMode]);
}
