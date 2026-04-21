"use client";

/**
 * EvidencePulsePanel — "New Evidence" + "Contradictions" feeds.
 *
 * ADR-DPI-004 DP1-06 #2: Evidence Pulse panel.
 *
 * Two time-decayed feeds:
 *   - New Evidence: recently ingested evidence artifacts (evidence subtype).
 *   - Contradictions: artifacts with active `contradicts` edges, sorted by
 *     recency of the contradiction edge.
 *
 * v1.5 status: backend aggregate endpoints missing.
 *   Missing endpoints:
 *     GET /api/research/evidence-pulse/new
 *       Returns: { data: { items: Array<EvidenceItem> } }
 *       EvidenceItem: { id, title, subtype, updated, snippet? }
 *       Query params: limit (default 5), topic_id?
 *
 *     GET /api/research/evidence-pulse/contradictions
 *       Returns: { data: { items: Array<ContradictionItem> } }
 *       ContradictionItem: { id, title, subtype, edge_count, updated }
 *       Query params: limit (default 5), topic_id?
 *
 * While endpoints are absent both feeds render skeletons + "coming in v1.6"
 * notice. When endpoints ship replace stub logic with hooks and remove notices.
 *
 * WCAG 2.1 AA: feeds are labelled sections; rows are list items.
 *
 * Stitch reference: Research Home (0cf6fb7b…) — Evidence Pulse section.
 */

import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  id: string;
  title: string;
  subtype?: string | null;
  updated?: string | null;
  snippet?: string | null;
}

export interface ContradictionItem {
  id: string;
  title: string;
  subtype?: string | null;
  edge_count: number;
  updated?: string | null;
}

export interface EvidencePulsePanelProps {
  /** New evidence items; undefined = endpoint missing (show skeleton + notice) */
  newEvidence?: EvidenceItem[];
  /** Contradiction items; undefined = endpoint missing */
  contradictions?: ContradictionItem[];
  isLoading?: boolean;
  /** Active topic scope from TopicScopeDropdown; passed through for future use */
  topicId?: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse items-center gap-2 rounded-md border bg-card px-3 py-2"
    >
      <div className="h-4 w-14 rounded-sm bg-muted" />
      <div className="h-4 flex-1 rounded bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// New evidence feed row
// ---------------------------------------------------------------------------

function EvidenceRow({ item }: { item: EvidenceItem }) {
  return (
    <li className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 transition-shadow hover:shadow-sm">
      {item.subtype && <TypeBadge type={item.subtype} />}
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
    </li>
  );
}

// ---------------------------------------------------------------------------
// Contradiction feed row
// ---------------------------------------------------------------------------

function ContradictionRow({ item }: { item: ContradictionItem }) {
  return (
    <li className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 transition-shadow hover:shadow-sm">
      {item.subtype && <TypeBadge type={item.subtype} />}
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
      <span
        aria-label={`${item.edge_count} contradicting edge${item.edge_count !== 1 ? "s" : ""}`}
        className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
      >
        {item.edge_count}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Feed section
// ---------------------------------------------------------------------------

interface FeedSectionProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconColour: string;
  endpointMissing: boolean;
  endpointName: string;
  children: React.ReactNode;
}

function FeedSection({
  id,
  label,
  icon,
  iconColour,
  endpointMissing,
  endpointName,
  children,
}: FeedSectionProps) {
  return (
    <section aria-labelledby={`pulse-heading-${id}`} className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span aria-hidden="true" className={iconColour}>
          {icon}
        </span>
        <h3
          id={`pulse-heading-${id}`}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {label}
        </h3>
        {endpointMissing && (
          <span
            className="rounded-sm bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground"
            role="note"
          >
            v1.6
          </span>
        )}
      </div>

      {endpointMissing && (
        <p className="text-[10px] text-muted-foreground" role="note">
          Requires{" "}
          <code className="rounded bg-muted px-0.5 font-mono text-[9px]">
            {endpointName}
          </code>{" "}
          — coming in v1.6.
        </p>
      )}

      <ul role="list" aria-label={label} className="flex flex-col gap-1.5">
        {children}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * EvidencePulsePanel renders two feeds: New Evidence + Contradictions.
 *
 * While backend endpoints are missing (v1.6) renders skeletons + notices.
 * Pass `newEvidence` and `contradictions` props when endpoints ship.
 */
export function EvidencePulsePanel({
  newEvidence,
  contradictions,
  isLoading = false,
  className,
}: EvidencePulsePanelProps) {
  const newMissing = newEvidence === undefined;
  const contradictionsMissing = contradictions === undefined;
  const loading = isLoading;

  const skeletonCount = 4;

  return (
    <section aria-labelledby="evidence-pulse-heading" className={cn("flex flex-col gap-4", className)}>
      <h2
        id="evidence-pulse-heading"
        className="text-sm font-semibold text-foreground"
      >
        Evidence Pulse
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* New Evidence feed */}
        <FeedSection
          id="new-evidence"
          label="New Evidence"
          icon={<Sparkles className="size-3.5" />}
          iconColour="text-emerald-600 dark:text-emerald-400"
          endpointMissing={newMissing}
          endpointName="GET /api/research/evidence-pulse/new"
        >
          {newMissing || loading
            ? Array.from({ length: skeletonCount }, (_, i) => <SkeletonRow key={i} />)
            : newEvidence.length === 0
            ? (
              <li className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                No new evidence.
              </li>
            )
            : newEvidence.map((item) => (
              <EvidenceRow key={item.id} item={item} />
            ))}
        </FeedSection>

        {/* Contradictions feed */}
        <FeedSection
          id="contradictions"
          label="Contradictions"
          icon={<AlertTriangle className="size-3.5" />}
          iconColour="text-rose-600 dark:text-rose-400"
          endpointMissing={contradictionsMissing}
          endpointName="GET /api/research/evidence-pulse/contradictions"
        >
          {contradictionsMissing || loading
            ? Array.from({ length: skeletonCount }, (_, i) => <SkeletonRow key={i} />)
            : contradictions.length === 0
            ? (
              <li className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                No contradictions detected.
              </li>
            )
            : contradictions.map((item) => (
              <ContradictionRow key={item.id} item={item} />
            ))}
        </FeedSection>
      </div>
    </section>
  );
}
