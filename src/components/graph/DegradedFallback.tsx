"use client";

/**
 * DegradedFallback — list-view and data-table fallback for the vault graph page.
 *
 * P3-07: shown when:
 *   - backend returns `sampled: true`, or
 *   - total node count >= VAULT_GRAPH_NODE_CAP (2k)
 *
 * Renders a toggle — "Graph view (may be slow)" vs "List view (safe)" vs "Table view (data)".
 * List view is a simple linked list with Title / Type / Updated / Actions columns.
 * Table view is an accessible data grid (role=grid) with sortable columns: Title / Type / Workspace / Updated / Fidelity / Freshness.
 *
 * P3-11: semantic HTML, ARIA labels, screen-reader accessible.
 * P5-10: adds GraphDataTable (role=grid, aria-rowcount, sortable headers, sr-only skip link, keyboard navigation).
 *
 * v2.1 — vault graph page (P3 Phase 3).
 * v2.2 — P5-10 data table and enhanced accessibility.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Network, List, ExternalLink, AlertTriangle, Table as TableIcon, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_TYPE_LABELS } from "@/types/graph";
import type { VaultGraphNode, GraphNodeType, FidelityLevel, FreshnessClass } from "@/types/graph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FallbackView = "graph" | "list" | "table";

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
          "flex items-center gap-1.5 border-r px-3 py-1.5 text-xs font-medium transition-colors",
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
      <button
        type="button"
        aria-pressed={active === "table"}
        aria-label="Table view — sortable data grid"
        onClick={() => onChange("table")}
        className={cn(
          "flex items-center gap-1.5 rounded-r-md px-3 py-1.5 text-xs font-medium transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          active === "table"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <TableIcon aria-hidden="true" className="size-3.5" />
        <span>Table view</span>
        <span className="text-muted-foreground/60 text-[10px]">(data)</span>
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
          Switch to list or table view for a smoother experience.
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
// Graph data table — P5-10 accessible data grid
// ---------------------------------------------------------------------------

type SortColumn = "title" | "type" | "workspace" | "updated_at" | "fidelity_level" | "freshness_class";
type SortDirection = "asc" | "desc" | "none";

interface GraphDataTableProps {
  nodes: VaultGraphNode[];
  totalNodes: number;
  onSelectNode?: (id: string) => void;
}

const FIDELITY_ORDER: Record<FidelityLevel, number> = { F0: 0, F1: 1, F2: 2, F3: 3, F4: 4 };
const FRESHNESS_ORDER: Record<FreshnessClass, number> = { current: 0, aging: 1, stale: 2 };

function fidelityLabel(level: FidelityLevel | null | undefined): string {
  if (!level) return "—";
  const labels: Record<FidelityLevel, string> = {
    F0: "Raw",
    F1: "Minimal",
    F2: "Medium",
    F3: "High",
    F4: "Full",
  };
  return labels[level] ?? "—";
}

function freshnessLabel(cls: FreshnessClass | null | undefined): string {
  if (!cls) return "—";
  const labels: Record<FreshnessClass, string> = {
    current: "Current",
    aging: "Aging",
    stale: "Stale",
  };
  return labels[cls] ?? "—";
}

function formatDate(iso: string | null): string {
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
}

export function GraphDataTable({ nodes, totalNodes, onSelectNode }: GraphDataTableProps) {
  const [sortState, setSortState] = useState<{ col: SortColumn; dir: SortDirection }>({
    col: "updated_at",
    dir: "desc",
  });

  // Compute sorted rows
  const sortedNodes = useMemo(() => {
    if (sortState.dir === "none") return nodes;

    const sorted = [...nodes].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortState.col) {
        case "title":
          aVal = (a.title ?? a.id).toLowerCase();
          bVal = (b.title ?? b.id).toLowerCase();
          break;
        case "type":
          aVal = a.artifact_type.toLowerCase();
          bVal = b.artifact_type.toLowerCase();
          break;
        case "workspace":
          aVal = a.workspace.toLowerCase();
          bVal = b.workspace.toLowerCase();
          break;
        case "updated_at":
          aVal = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          bVal = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          break;
        case "fidelity_level":
          aVal = FIDELITY_ORDER[a.fidelity_level ?? "F2"] ?? 2;
          bVal = FIDELITY_ORDER[b.fidelity_level ?? "F2"] ?? 2;
          break;
        case "freshness_class":
          aVal = FRESHNESS_ORDER[a.freshness_class ?? "stale"] ?? 2;
          bVal = FRESHNESS_ORDER[b.freshness_class ?? "stale"] ?? 2;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortState.dir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortState.dir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [nodes, sortState]);

  const handleHeaderClick = (col: SortColumn) => {
    if (sortState.col === col) {
      // Cycle: asc -> desc -> none -> asc
      const nextDir: SortDirection =
        sortState.dir === "asc" ? "desc" : sortState.dir === "desc" ? "none" : "asc";
      setSortState({ col, dir: nextDir });
    } else {
      setSortState({ col, dir: "asc" });
    }
  };

  const getSortIcon = (col: SortColumn) => {
    if (sortState.col !== col) return null;
    if (sortState.dir === "asc") return <ArrowUp className="size-3 inline ml-1" aria-hidden="true" />;
    if (sortState.dir === "desc") return <ArrowDown className="size-3 inline ml-1" aria-hidden="true" />;
    return null;
  };

  if (nodes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No artifacts match the current filters.
      </p>
    );
  }

  return (
    <div role="region" aria-label="Graph data table view" id="graph-table-fallback">
      {/* SR-only skip link */}
      <a
        href="#graph-table-fallback"
        className="sr-only focus:not-sr-only focus:block focus:bg-accent focus:text-accent-foreground focus:px-3 focus:py-1.5 focus:rounded focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to table view
      </a>

      <div className="overflow-x-auto">
        <table
          role="grid"
          aria-rowcount={totalNodes}
          aria-label="Graph data table"
          className="w-full text-xs"
        >
          <thead>
            <tr className="border-b text-left">
              <th
                scope="col"
                className="py-2 px-3 font-semibold text-muted-foreground"
              >
                <button
                  type="button"
                  onClick={() => handleHeaderClick("title")}
                  aria-sort={sortState.col === "title" ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "font-semibold hover:text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1",
                    sortState.col === "title" && "text-foreground",
                  )}
                >
                  Title
                  {getSortIcon("title")}
                </button>
              </th>
              <th
                scope="col"
                className="py-2 px-3 font-semibold text-muted-foreground"
              >
                <button
                  type="button"
                  onClick={() => handleHeaderClick("type")}
                  aria-sort={sortState.col === "type" ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "font-semibold hover:text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1",
                    sortState.col === "type" && "text-foreground",
                  )}
                >
                  Type
                  {getSortIcon("type")}
                </button>
              </th>
              <th
                scope="col"
                className="py-2 px-3 font-semibold text-muted-foreground"
              >
                <button
                  type="button"
                  onClick={() => handleHeaderClick("workspace")}
                  aria-sort={sortState.col === "workspace" ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "font-semibold hover:text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1",
                    sortState.col === "workspace" && "text-foreground",
                  )}
                >
                  Workspace
                  {getSortIcon("workspace")}
                </button>
              </th>
              <th
                scope="col"
                className="py-2 px-3 font-semibold text-muted-foreground"
              >
                <button
                  type="button"
                  onClick={() => handleHeaderClick("updated_at")}
                  aria-sort={sortState.col === "updated_at" ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "font-semibold hover:text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1",
                    sortState.col === "updated_at" && "text-foreground",
                  )}
                >
                  Updated
                  {getSortIcon("updated_at")}
                </button>
              </th>
              <th
                scope="col"
                className="py-2 px-3 font-semibold text-muted-foreground"
              >
                <button
                  type="button"
                  onClick={() => handleHeaderClick("fidelity_level")}
                  aria-sort={sortState.col === "fidelity_level" ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "font-semibold hover:text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1",
                    sortState.col === "fidelity_level" && "text-foreground",
                  )}
                >
                  Fidelity
                  {getSortIcon("fidelity_level")}
                </button>
              </th>
              <th
                scope="col"
                className="py-2 px-3 font-semibold text-muted-foreground"
              >
                <button
                  type="button"
                  onClick={() => handleHeaderClick("freshness_class")}
                  aria-sort={sortState.col === "freshness_class" ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "font-semibold hover:text-foreground transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1",
                    sortState.col === "freshness_class" && "text-foreground",
                  )}
                >
                  Freshness
                  {getSortIcon("freshness_class")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedNodes.map((node) => {
              const typeLabel =
                NODE_TYPE_LABELS[node.artifact_type as GraphNodeType] ??
                node.artifact_type.replace(/_/g, " ");
              return (
                <tr
                  key={node.id}
                  role="row"
                  aria-selected={false}
                  tabIndex={0}
                  onClick={() => onSelectNode?.(node.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectNode?.(node.id);
                    }
                  }}
                  className={cn(
                    "border-b border-border/50 last:border-0 transition-colors cursor-pointer",
                    "hover:bg-muted/30",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  )}
                >
                  <td className="py-2 px-3 font-medium text-foreground max-w-[200px]">
                    <span className="truncate block" title={node.title ?? node.id}>
                      {node.title ?? node.id}
                    </span>
                  </td>
                  <td className="py-2 px-3 capitalize text-muted-foreground">
                    {typeLabel}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {node.workspace}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground tabular-nums">
                    {formatDate(node.updated_at)}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {fidelityLabel(node.fidelity_level)}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {freshnessLabel(node.freshness_class)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
        {(activeView === "list" || activeView === "table") && (
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

      {/* Table view — only shown when activeView = "table" */}
      {activeView === "table" && (
        <GraphDataTable nodes={nodes} totalNodes={totalNodeCount} />
      )}
    </div>
  );
}
