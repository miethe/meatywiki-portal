"use client";

/**
 * NewEvidenceColumn — live list of recently ingested evidence artifacts.
 *
 * Wires GET /api/research/evidence-pulse/new via useEvidencePulseNew().
 * Renders a compact artifact card list with:
 *   - Loading skeleton on initial fetch (4 rows).
 *   - Empty state when no new evidence in the last 7 days.
 *   - Error state with descriptive message.
 *   - Live artifact rows with type badge + linked title.
 *
 * WCAG 2.1 AA:
 *   - Section is labelled via aria-labelledby.
 *   - List items are semantically structured.
 *   - Loading state announces via aria-busy.
 *   - Error state uses role="alert".
 *
 * Replaces skeleton placeholder from P6-03.
 * Portal v1.7 Phase 4 (P4-05).
 * Endpoint: GET /api/research/evidence-pulse/new
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";
import { useEvidencePulseNew } from "@/hooks/useEvidencePulse";
import type { EvidencePulseNewItem } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Shimmer primitive
// ---------------------------------------------------------------------------

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-muted", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton evidence row
// ---------------------------------------------------------------------------

function SkeletonEvidenceRow() {
  return (
    <li
      aria-hidden="true"
      className="flex flex-col gap-1.5 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
    >
      <div className="flex items-center gap-2">
        <Shimmer className="h-3.5 w-10 rounded-full" />
        <Shimmer className="h-3.5 flex-1" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Shimmer className="h-3 w-2/3" />
        <Shimmer className="h-3 w-12 shrink-0" />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Live evidence row
// ---------------------------------------------------------------------------

function EvidenceRow({ item }: { item: EvidencePulseNewItem }) {
  const updatedLabel = item.updated
    ? new Date(item.updated).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <li className="flex items-center gap-2 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
      {item.subtype && (
        <span className="shrink-0">
          <TypeBadge type={item.subtype} />
        </span>
      )}
      <Link
        href={`/artifact/${item.id}`}
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium text-foreground leading-snug",
          "hover:underline underline-offset-2",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
        )}
      >
        {item.title}
      </Link>
      {updatedLabel && (
        <time
          dateTime={item.updated ?? undefined}
          className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
        >
          {updatedLabel}
        </time>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// NewEvidenceColumn
// ---------------------------------------------------------------------------

const SKELETON_COUNT = 4;

export interface NewEvidenceColumnProps {
  className?: string;
  /** Optional topic filter forwarded to the API. */
  topicId?: string;
}

/**
 * Replaces the skeleton placeholder from P6-03 with live data from
 * GET /api/research/evidence-pulse/new.
 */
export function NewEvidenceColumn({ className, topicId }: NewEvidenceColumnProps) {
  const { items, isLoading, isError, error } = useEvidencePulseNew(
    topicId ? { topic_id: topicId } : undefined,
  );

  // ---------------------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------------------

  const renderContent = () => {
    if (isLoading) {
      return (
        <ul
          role="list"
          aria-busy="true"
          aria-label="New evidence items loading"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <SkeletonEvidenceRow key={i} />
          ))}
        </ul>
      );
    }

    if (isError) {
      return (
        <div
          role="alert"
          className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground"
        >
          <p className="font-medium text-destructive">Failed to load new evidence.</p>
          {error?.message && (
            <p className="mt-0.5 text-[10px] opacity-70">{error.message}</p>
          )}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div
          role="status"
          aria-label="No new evidence"
          className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground"
        >
          No new evidence in the last 7 days.
        </div>
      );
    }

    return (
      <ul
        role="list"
        aria-label={`New evidence — ${items.length} item${items.length !== 1 ? "s" : ""}`}
        className="flex flex-col gap-3"
      >
        {items.map((item) => (
          <EvidenceRow key={item.id} item={item} />
        ))}
      </ul>
    );
  };

  // ---------------------------------------------------------------------------
  // Shell
  // ---------------------------------------------------------------------------

  return (
    <section aria-labelledby="new-evidence-heading" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <h2
          id="new-evidence-heading"
          className="text-sm font-semibold text-foreground"
        >
          New Evidence
        </h2>
      </div>

      {renderContent()}
    </section>
  );
}
