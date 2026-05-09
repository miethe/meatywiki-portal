"use client";

/**
 * FilterSidebar — artifact type + edge type facet filters for the vault graph page.
 *
 * P3-02: artifact type facets
 * P3-03: edge type facets
 * P3-11: semantic HTML (fieldset/label), ARIA labels
 *
 * Renders a two-section sidebar:
 *   1. Node types (Concepts, Entities, Syntheses, …) — checkboxes
 *   2. Edge types (Derived from, Relates to, …) — checkboxes
 *
 * On mobile the sidebar is hidden; caller renders a drawer with `alwaysVisible`.
 *
 * v2.1 — vault graph page (P3 Phase 3).
 */

import { useCallback } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NODE_TYPE_COLORS,
  NODE_TYPE_COLOR_DEFAULT,
  NODE_TYPE_LABELS,
  EDGE_TYPE_LABELS,
  EDGE_TYPE_STYLES,
  EDGE_STYLE_COLORS,
} from "@/types/graph";
import type { GraphNodeType, GraphEdgeType } from "@/types/graph";

// ---------------------------------------------------------------------------
// Data tables
// ---------------------------------------------------------------------------

const NODE_TYPE_OPTIONS: { value: GraphNodeType; label: string }[] = Object.entries(
  NODE_TYPE_LABELS,
).map(([value, label]) => ({ value: value as GraphNodeType, label }));

const EDGE_TYPE_OPTIONS: { value: GraphEdgeType; label: string }[] = Object.entries(
  EDGE_TYPE_LABELS,
).map(([value, label]) => ({ value: value as GraphEdgeType, label }));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilterSidebarProps {
  nodeTypes: GraphNodeType[];
  edgeTypes: GraphEdgeType[];
  onNodeTypesChange: (types: GraphNodeType[]) => void;
  onEdgeTypesChange: (types: GraphEdgeType[]) => void;
  onClearAll: () => void;
  /** When true, no breakpoint visibility classes are applied (e.g. inside mobile drawer). */
  alwaysVisible?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Color dot for node type swatches
// ---------------------------------------------------------------------------

function NodeColorDot({ type }: { type: GraphNodeType }) {
  const color = NODE_TYPE_COLORS[type] ?? NODE_TYPE_COLOR_DEFAULT;
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

// ---------------------------------------------------------------------------
// Edge style line swatch
// ---------------------------------------------------------------------------

function EdgeStyleSwatch({ type }: { type: GraphEdgeType }) {
  const style = EDGE_TYPE_STYLES[type] ?? "solid";
  const color = EDGE_STYLE_COLORS[style];
  const isDashed = style === "dashed" || style === "red-dashed";
  const isDotted = style === "dotted";

  return (
    <svg
      width={28}
      height={10}
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <line
        x1={2}
        y1={5}
        x2={26}
        y2={5}
        stroke={color}
        strokeWidth={style === "thick-solid" ? 2.5 : 1.5}
        strokeDasharray={
          isDashed ? "4 2.5" : isDotted ? "1.5 2" : undefined
        }
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Checkbox row
// ---------------------------------------------------------------------------

interface CheckboxRowProps {
  id: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  swatch?: React.ReactNode;
}

function CheckboxRow({ id, checked, onChange, label, swatch }: CheckboxRowProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 group select-none"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={cn(
          "size-3.5 shrink-0 rounded border-input accent-primary cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
      {swatch}
      <span
        className={cn(
          "text-xs transition-colors truncate",
          checked
            ? "text-foreground font-medium"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {label}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FilterSidebar({
  nodeTypes,
  edgeTypes,
  onNodeTypesChange,
  onEdgeTypesChange,
  onClearAll,
  alwaysVisible = false,
  className,
}: FilterSidebarProps) {
  const hasActiveFilters = nodeTypes.length > 0 || edgeTypes.length > 0;

  const toggleNodeType = useCallback(
    (value: GraphNodeType) => {
      onNodeTypesChange(
        nodeTypes.includes(value)
          ? nodeTypes.filter((t) => t !== value)
          : [...nodeTypes, value],
      );
    },
    [nodeTypes, onNodeTypesChange],
  );

  const toggleEdgeType = useCallback(
    (value: GraphEdgeType) => {
      onEdgeTypesChange(
        edgeTypes.includes(value)
          ? edgeTypes.filter((t) => t !== value)
          : [...edgeTypes, value],
      );
    },
    [edgeTypes, onEdgeTypesChange],
  );

  return (
    <aside
      aria-label="Graph filters"
      className={cn(
        "w-[200px] shrink-0 flex flex-col rounded-lg border bg-card overflow-y-auto",
        // Visibility: hide below md unless alwaysVisible (mobile drawer context)
        !alwaysVisible && "hidden md:flex",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2.5 shrink-0">
        <SlidersHorizontal
          aria-hidden="true"
          className="size-3.5 text-muted-foreground shrink-0"
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Graph Filters
        </span>
      </div>

      <div className="flex flex-col gap-5 p-3">
        {/* ---------------------------------------------------------------- */}
        {/* P3-02: Artifact type facets                                       */}
        {/* ---------------------------------------------------------------- */}
        <fieldset>
          <legend className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Artifact Type
          </legend>
          <div className="flex flex-col gap-1.5" role="group" aria-label="Artifact type filters">
            {NODE_TYPE_OPTIONS.map(({ value, label }) => (
              <CheckboxRow
                key={value}
                id={`graph-filter-node-${value}`}
                checked={nodeTypes.includes(value)}
                onChange={() => toggleNodeType(value)}
                label={label}
                swatch={<NodeColorDot type={value} />}
              />
            ))}
          </div>
        </fieldset>

        {/* ---------------------------------------------------------------- */}
        {/* P3-03: Edge type facets                                           */}
        {/* ---------------------------------------------------------------- */}
        <fieldset>
          <legend className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Edge Type
          </legend>
          <div className="flex flex-col gap-1.5" role="group" aria-label="Edge type filters">
            {EDGE_TYPE_OPTIONS.map(({ value, label }) => (
              <CheckboxRow
                key={value}
                id={`graph-filter-edge-${value}`}
                checked={edgeTypes.includes(value)}
                onChange={() => toggleEdgeType(value)}
                label={label}
                swatch={<EdgeStyleSwatch type={value} />}
              />
            ))}
          </div>
        </fieldset>

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium text-muted-foreground",
              "underline-offset-2 hover:text-foreground hover:underline transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
            )}
          >
            <X aria-hidden="true" className="size-3" />
            Clear all filters
          </button>
        )}
      </div>
    </aside>
  );
}
