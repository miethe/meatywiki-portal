"use client";

/**
 * DegradedFallback — list-view fallback for the vault graph page.
 *
 * P3-07: shown when:
 *   - backend returns `sampled: true`, or
 *   - total node count >= VAULT_GRAPH_NODE_CAP (2k)
 *
 * Renders a toggle — "Graph view (may be slow)" vs "List view (safe)".
 * List view is a semantic <table> with Title / Type / Updated / Actions columns.
 *
 * P3-11: semantic HTML, ARIA labels, screen-reader accessible.
 *
 * v2.1 — vault graph page (P3 Phase 3).
 */

import { useCallback } from "react";
import Link from "next/link";
import { Network, List, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_TYPE_LABELS } from "@/types/graph";
import type { VaultGraphNode, GraphNodeType } from "@/types/graph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FallbackView = "graph" | "list";

export interface DegradedFallbackProps {
  /** Whether the backend flagged the result as sampled. */
  sampled: boolean;
  /** Whether we're above the render cap. */
  aboveCap: boolean;
  /** Total reported node count. */
  totalNodeCount: number;
  /** The nodes available for the list view. */
  nodes: VaultGraphNode[];
  /** Current active view. */
  activeView: FallbackView;
  /** Called when user switches views. */
  onViewChange: (view: FallbackView) => void;
  /** Called when user clicks "View neighborhood" for a node. */
  onViewNeighborhood?: (nodeId: string) => void;
  /** Whether the graph canvas is slow (from perf monitoring). */
  perfDegraded?: boolean;
}

// ---------------------------------------------------------------------------
// View toggle
// ---------------------------------------------------------------------------

interface ViewToggleProps {
  active: FallbackView;
  onChange: (v: FallbackView) => void;
}

function ViewToggle({ active, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Graph view mode"
      className="flex rounded-md border shadow-sm"
    >
      <button
        type="button"
        aria-pressed={active === "graph"}
        aria-label="Graph view — may be slow with many nodes"
        onClick={() => onChange("graph")}
        className={cn(
          "flex items-center gap-1.5 rounded-l-md border-r px-3 py-1.5 text-xs font-medium transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          active === "graph"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <Network aria-hidden="true" className="size-3.5" />
        <span>Graph view</span>
        <span className="text-muted-foreground/60 text-[10px]">(may be slow)</span>
      </button>
      <button
        type="button"
        aria-pressed={active === "list"}
        aria-label="List view — faster, works for all vault sizes"
        onClick={() => onChange("list")}
        className={cn(
          "flex items-center gap-1.5 rounded-r-md px-3 py-1.5 text-xs font-medium transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          active === "list"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <List aria-hidden="true" className="size-3.5" />
        <span>List view</span>
        <span className="text-muted-foreground/60 text-[10px]">(safe)</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Degradation banner
// ---------------------------------------------------------------------------

function DegradationBanner({
  sampled,
  aboveCap,
  totalNodeCount,
  perfDegraded,
}: {
  sampled: boolean;
  aboveCap: boolean;
  totalNodeCount: number;
  perfDegraded?: boolean;
}) {
  const reasons: string[] = [];
  if (sampled) {
    reasons.push(
      `Showing a sample of ${totalNodeCount.toLocaleString()} artifacts`,
    );
  } else if (aboveCap) {
    reasons.push(
      `${totalNodeCount.toLocaleString()} nodes exceeds the render cap`,
    );
  }
  if (perfDegraded) {
    reasons.push("Graph rendering is slow on this device");
  }

  if (reasons.length === 0) return null;

  return (
    <div
      role="note"
      aria-label="Graph performance notice"
      className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-950/30"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <div className="flex flex-col gap-0.5">
        {reasons.map((r) => (
          <span key={r} className="text-amber-800 dark:text-amber-200">
            {r}
          </span>
        ))}
        <span className="text-amber-700/80 dark:text-amber-300/70">
          Switch to list view for a smoother experience.
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node list table (P3-07, P3-11)
// ---------------------------------------------------------------------------

interface NodeListTableProps {
  nodes: VaultGraphNode[];
  onViewNeighborhood?: (nodeId: string) => void;
}

function NodeListTable({ nodes, onViewNeighborhood }: NodeListTableProps) {
  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  if (nodes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No artifacts match the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        aria-label="Vault artifact list"
        className="w-full text-xs"
      >
        <thead>
          <tr className="border-b text-left">
            <th
              scope="col"
              className="py-2 pr-4 font-semibold text-muted-foreground"
            >
              Title
            </th>
            <th
              scope="col"
              className="py-2 pr-4 font-semibold text-muted-foreground"
            >
              Type
            </th>
            <th
              scope="col"
              className="py-2 pr-4 font-semibold text-muted-foreground"
            >
              Updated
            </th>
            <th
              scope="col"
              className="py-2 font-semibold text-muted-foreground"
            >
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const label =
              NODE_TYPE_LABELS[node.artifact_type as GraphNodeType] ??
              node.artifact_type.replace(/_/g, " ");
            return (
              <tr
                key={node.id}
                className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="py-2 pr-4 font-medium text-foreground max-w-[240px]">
                  <span className="truncate block" title={node.title ?? node.id}>
                    {node.title ?? node.id}
                  </span>
                </td>
                <td className="py-2 pr-4 capitalize text-muted-foreground">
                  {label}
                </td>
                <td className="py-2 pr-4 text-muted-foreground tabular-nums">
                  {formatDate(node.updated_at)}
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/artifact/${node.id}`}
                      aria-label={`Open detail page for ${node.title ?? node.id}`}
                      className={cn(
                        "flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground",
                        "transition-colors hover:bg-accent hover:text-foreground",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      <ExternalLink aria-hidden="true" className="size-3" />
                      <span>Open</span>
                    </Link>
                    {onViewNeighborhood && (
                      <button
                        type="button"
                        onClick={() => onViewNeighborhood(node.id)}
                        aria-label={`View neighborhood graph for ${node.title ?? node.id}`}
                        className={cn(
                          "flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground",
                          "transition-colors hover:bg-accent hover:text-foreground",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <Network aria-hidden="true" className="size-3" />
                        <span>Neighborhood</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DegradedFallback({
  sampled,
  aboveCap,
  totalNodeCount,
  nodes,
  activeView,
  onViewChange,
  onViewNeighborhood,
  perfDegraded,
}: DegradedFallbackProps) {
  const handleViewChange = useCallback(
    (v: FallbackView) => onViewChange(v),
    [onViewChange],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Degradation banner — shown when sampled/above-cap/perf-degraded */}
      <DegradationBanner
        sampled={sampled}
        aboveCap={aboveCap}
        totalNodeCount={totalNodeCount}
        perfDegraded={perfDegraded}
      />

      {/* View toggle */}
      <div className="flex items-center justify-between gap-3">
        <ViewToggle active={activeView} onChange={handleViewChange} />
        {activeView === "list" && (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Showing {nodes.length.toLocaleString()} of{" "}
            {totalNodeCount.toLocaleString()} artifacts
          </span>
        )}
      </div>

      {/* List view — only shown when activeView = "list" */}
      {activeView === "list" && (
        <NodeListTable nodes={nodes} onViewNeighborhood={onViewNeighborhood} />
      )}
    </div>
  );
}
