"use client";

/**
 * BacklinksPanel — reusable component rendering incoming + outgoing edges
 * for a given artifact.
 *
 * Consumes `useArtifactEdges` and renders two clearly-labelled lists:
 *   - Incoming: peers that reference this artifact
 *   - Outgoing: artifacts this artifact references
 *
 * Each row shows:
 *   - Peer title (or artifact ID in monospace + "(not indexed)" hint when null)
 *   - Subtype via TypeBadge
 *   - Edge type via a small coloured EdgeTypeBadge
 *   - Link to /artifact/:id
 *
 * No graph / D3 visualisation — list is sufficient for MVP (P4-03 scope).
 *
 * Reusable: intended for both the Backlinks Explorer page
 * (/research/backlinks) and optionally the Artifact Detail page.
 *
 * WCAG 2.1 AA: colour supplemented by text (never colour-only).
 *
 * Stitch reference: "Backlinks Panel" (P4-03 scope)
 */

import Link from "next/link";
import { AlertCircle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";
import {
  useArtifactEdges,
  type ArtifactEdgeItem,
  type EdgeType,
} from "@/hooks/useArtifactEdges";

// ---------------------------------------------------------------------------
// Edge type badge
// ---------------------------------------------------------------------------

const EDGE_TYPE_LABELS: Record<string, string> = {
  derived_from: "Derived from",
  supports: "Supports",
  relates_to: "Relates to",
  supersedes: "Supersedes",
  contradicts: "Contradicts",
  contains: "Contains",
};

const EDGE_TYPE_COLOURS: Record<string, string> = {
  derived_from:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  supports:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  relates_to:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  supersedes:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  contradicts:
    "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  contains:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

interface EdgeTypeBadgeProps {
  edgeType: EdgeType;
}

function EdgeTypeBadge({ edgeType }: EdgeTypeBadgeProps) {
  const label = EDGE_TYPE_LABELS[edgeType] ?? edgeType;
  const colour =
    EDGE_TYPE_COLOURS[edgeType] ?? "bg-muted text-muted-foreground";

  return (
    <span
      aria-label={`Edge type: ${label}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        colour,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Edge row
// ---------------------------------------------------------------------------

interface EdgeRowProps {
  edge: ArtifactEdgeItem;
}

function EdgeRow({ edge }: EdgeRowProps) {
  const hasTitle = edge.title !== null && edge.title !== undefined;

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2.5 text-sm transition-shadow hover:shadow-sm">
      {/* Subtype badge */}
      {edge.subtype && <TypeBadge type={edge.subtype} />}

      {/* Edge type chip */}
      <EdgeTypeBadge edgeType={edge.type} />

      {/* Peer title / id */}
      {hasTitle ? (
        <Link
          href={`/artifact/${edge.artifact_id}`}
          className={cn(
            "min-w-0 flex-1 truncate font-medium text-foreground leading-snug",
            "hover:underline underline-offset-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
          )}
        >
          {edge.title}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate">
          <Link
            href={`/artifact/${edge.artifact_id}`}
            className={cn(
              "font-mono text-[12px] text-foreground/80",
              "hover:underline underline-offset-2",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
            )}
          >
            {edge.artifact_id}
          </Link>
          <span className="ml-1.5 text-[11px] text-muted-foreground">
            (not indexed)
          </span>
        </span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Section: a labelled list of edges with a direction icon
// ---------------------------------------------------------------------------

interface EdgeSectionProps {
  label: string;
  edges: ArtifactEdgeItem[];
  icon: React.ReactNode;
  emptyHint: string;
  listAriaLabel: string;
}

function EdgeSection({
  label,
  edges,
  icon,
  emptyHint,
  listAriaLabel,
}: EdgeSectionProps) {
  return (
    <section aria-labelledby={`edges-heading-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <span aria-hidden="true" className="text-muted-foreground">
          {icon}
        </span>
        <h3
          id={`edges-heading-${label.toLowerCase().replace(/\s+/g, "-")}`}
          className="text-sm font-semibold text-foreground"
        >
          {label}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({edges.length})
          </span>
        </h3>
      </div>

      {edges.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <ul
          role="list"
          aria-label={listAriaLabel}
          className="flex flex-col gap-1.5"
        >
          {edges.map((edge) => (
            <EdgeRow key={`${edge.artifact_id}-${edge.type}`} edge={edge} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Backlinks loading" className="flex flex-col gap-6">
      {[0, 1].map((section) => (
        <div key={section} className="flex flex-col gap-2">
          <div className="flex animate-pulse items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="flex animate-pulse items-center gap-2 rounded-md border bg-card px-3 py-2.5"
            >
              <div className="h-4 w-14 rounded-sm bg-muted" />
              <div className="h-4 w-16 rounded-sm bg-muted" />
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state (no edges at all)
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      role="status"
      aria-label="No edges found"
      className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <ArrowDownLeft
          aria-hidden="true"
          className="size-6 text-muted-foreground"
        />
      </div>
      <div className="max-w-xs">
        <p className="text-sm font-medium text-foreground">No edges found</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          This artifact has no incoming or outgoing edges in the overlay. Edges
          are created during compilation and reconciliation.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-12 text-center"
    >
      <AlertCircle aria-hidden="true" className="size-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Failed to load backlinks
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BacklinksPanelProps {
  /**
   * The artifact ID whose edges to display.
   * When null / undefined the panel renders an idle empty state.
   */
  artifactId: string | null | undefined;
  className?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * BacklinksPanel renders incoming + outgoing edges for the given artifact.
 *
 * Handles: loading, error, empty (no edges), and populated states.
 * Designed to be mounted both as a standalone explorer panel and as a
 * section on the Artifact Detail page.
 */
export function BacklinksPanel({ artifactId, className }: BacklinksPanelProps) {
  const { data, isLoading, isError, error, refetch } = useArtifactEdges(artifactId);

  // No artifact selected yet
  if (!artifactId) {
    return (
      <div
        role="status"
        aria-label="No artifact selected"
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-16 text-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">
          Select an artifact to view its backlinks.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={className}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className={className}>
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <div className={className}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <EdgeSection
        label="Incoming"
        edges={incoming}
        icon={<ArrowDownLeft className="size-4" />}
        emptyHint="No artifacts reference this one."
        listAriaLabel="Incoming edges"
      />
      <EdgeSection
        label="Outgoing"
        edges={outgoing}
        icon={<ArrowUpRight className="size-4" />}
        emptyHint="This artifact does not reference others."
        listAriaLabel="Outgoing edges"
      />
    </div>
  );
}
