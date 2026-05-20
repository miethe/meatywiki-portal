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

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param groupingMode  - Currently selected grouping mode.
 */
export function useClusterAssignment(groupingMode: GroupingMode): void {
  const sigma = useSigma();

  useEffect(() => {
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
