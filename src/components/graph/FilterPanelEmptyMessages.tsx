"use client";

/**
 * FilterPanelEmptyMessages — per-dimension inline empty-state messages for
 * the GraphFilters panel.
 *
 * Renders a compact notice when a filter dimension has zero available options
 * (e.g., no projects indexed, no domains known). Intended for use inside each
 * filter accordion section by P3-13 / post-MVP wiring.
 *
 * Stateless — accepts only the dimension key and an optional custom message
 * override. GraphFilters can import and render this component without any
 * change to its own state or props.
 *
 * v2.2 — filter panel empty messages (P3-08).
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Dimension labels — aligned with filter contract §1 dim names
// ---------------------------------------------------------------------------

const DIM_LABELS: Record<string, string> = {
  ws:       "workspaces",
  types:    "artifact types",
  edges:    "edge types",
  freshness:"freshness classes",
  project:  "projects",
  domain:   "domains",
  lifecycle:"lifecycle stages",
  status:   "statuses",
  verif:    "verification statuses",
  tags:     "tags",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilterDimEmptyMessageProps {
  /**
   * Filter contract dimension key (e.g. "project", "domain", "tags").
   * Used to pick a default label when no `message` prop is provided.
   */
  dim: string;
  /**
   * Override the auto-generated message. Falls back to
   * "No {dimLabel} available." when omitted.
   */
  message?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// FilterDimEmptyMessage — single dimension variant
// ---------------------------------------------------------------------------

export function FilterDimEmptyMessage({
  dim,
  message,
  className,
}: FilterDimEmptyMessageProps) {
  const label = DIM_LABELS[dim] ?? dim;
  const text = message ?? `No ${label} available.`;

  return (
    <p
      aria-live="polite"
      className={cn(
        "px-1 py-1.5 text-[11px] italic text-muted-foreground/70",
        className,
      )}
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// FilterPanelEmptyMessages — named group of dimension messages
//
// Convenience component that renders a stack of FilterDimEmptyMessage entries
// for multiple dimensions at once. Useful for sidebar sections that iterate
// over several dims (e.g., the Secondary accordion section in GraphFilters).
// ---------------------------------------------------------------------------

export interface FilterPanelEmptyMessagesProps {
  /** Dims that currently have no available options. */
  emptyDims: string[];
  /** Per-dim message overrides (keyed by dim name). */
  overrides?: Record<string, string>;
  className?: string;
}

export function FilterPanelEmptyMessages({
  emptyDims,
  overrides,
  className,
}: FilterPanelEmptyMessagesProps) {
  if (emptyDims.length === 0) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      {emptyDims.map((dim) => (
        <FilterDimEmptyMessage
          key={dim}
          dim={dim}
          message={overrides?.[dim]}
        />
      ))}
    </div>
  );
}
