"use client";

/**
 * EvidencePulsePanel — live "New Evidence" + "Contradictions" feeds.
 *
 * ADR-DPI-004 DP1-06 #2: Evidence Pulse panel.
 *
 * Wires both evidence-pulse endpoints:
 *   - Left column: NewEvidenceColumn (GET /api/research/evidence-pulse/new)
 *   - Right column: contradiction pairs (GET /api/research/evidence-pulse/contradictions)
 *   - Header badge: total_count from useEvidencePulseNew
 *   - Trend arrow: ↑ if last_7_days > prior_7_days, ↓ if less, → if equal
 *
 * WCAG 2.1 AA:
 *   - Panel is a labelled section (aria-labelledby).
 *   - Badge count has an aria-label.
 *   - Trend arrow has aria-label describing the direction.
 *   - Contradiction rows are keyboard-navigable links.
 *   - Colour is never the sole differentiator (arrows + labels supplement colour).
 *
 * Portal v1.7 Phase 4 (P4-05).
 * Replaces the props-only skeleton from P6-03.
 */

import Link from "next/link";
import { AlertTriangle, Sparkles, ArrowUp, ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";
import { NewEvidenceColumn } from "./NewEvidenceColumn";
import { useEvidencePulseNew, useEvidencePulseContradictions } from "@/hooks/useEvidencePulse";
import type { EvidenceContradictionPair } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TrendDirection = "up" | "down" | "flat";

function getTrend(last7: number, prior7: number): TrendDirection {
  if (last7 > prior7) return "up";
  if (last7 < prior7) return "down";
  return "flat";
}

// ---------------------------------------------------------------------------
// Trend arrow
// ---------------------------------------------------------------------------

interface TrendArrowProps {
  direction: TrendDirection;
  className?: string;
}

function TrendArrow({ direction, className }: TrendArrowProps) {
  if (direction === "up") {
    return (
      <ArrowUp
        aria-label="Trending up"
        className={cn("size-3 text-emerald-600 dark:text-emerald-400", className)}
      />
    );
  }
  if (direction === "down") {
    return (
      <ArrowDown
        aria-label="Trending down"
        className={cn("size-3 text-rose-500 dark:text-rose-400", className)}
      />
    );
  }
  return (
    <ArrowRight
      aria-label="Stable trend"
      className={cn("size-3 text-muted-foreground", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton row (contradictions side)
// ---------------------------------------------------------------------------

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-muted", className)}
    />
  );
}

function SkeletonContradictionRow() {
  return (
    <div aria-hidden="true" className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
      <Shimmer className="h-4 w-14 rounded-sm" />
      <Shimmer className="h-4 flex-1" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contradiction row
// ---------------------------------------------------------------------------

function ContradictionRow({ pair }: { pair: EvidenceContradictionPair }) {
  const artifact = pair.artifact_a;
  return (
    <li className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 transition-shadow hover:shadow-sm">
      {artifact.subtype && (
        <span className="shrink-0">
          <TypeBadge type={artifact.subtype} />
        </span>
      )}
      <Link
        href={`/artifact/${artifact.id}`}
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium text-foreground leading-snug",
          "hover:underline underline-offset-2",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
        )}
        aria-label={`${artifact.title} vs ${pair.artifact_b.title}`}
      >
        {artifact.title}
        <span
          aria-hidden="true"
          className="mx-1 text-[10px] font-bold text-rose-400 dark:text-rose-600"
        >
          vs
        </span>
        <span className="text-muted-foreground">{pair.artifact_b.title}</span>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// EvidencePulsePanel
// ---------------------------------------------------------------------------

export interface EvidencePulsePanelProps {
  /** Optional topic scope from TopicScopeDropdown. */
  topicId?: string | null;
  className?: string;
}

/**
 * EvidencePulsePanel renders two side-by-side feeds:
 *   - Left: NewEvidenceColumn (live from useEvidencePulseNew)
 *   - Right: Contradictions (live from useEvidencePulseContradictions)
 *
 * The panel header shows a total_count badge and a trend arrow derived from
 * the 7-day rolling delta (last_7_days vs prior_7_days).
 */
export function EvidencePulsePanel({ topicId, className }: EvidencePulsePanelProps) {
  const {
    total_count,
    last_7_days,
    prior_7_days,
    isLoading: newLoading,
    isError: newError,
  } = useEvidencePulseNew(topicId ? { topic_id: topicId } : undefined);

  const {
    items: contradictions,
    isLoading: contradictionsLoading,
    isError: contradictionsError,
  } = useEvidencePulseContradictions();

  const trend = getTrend(last_7_days, prior_7_days);
  const showBadge = !newLoading && !newError && total_count > 0;

  return (
    <section aria-labelledby="evidence-pulse-heading" className={cn("flex flex-col gap-4", className)}>
      {/* Panel header */}
      <div className="flex items-center gap-2">
        <Sparkles
          aria-hidden="true"
          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
        />
        <h2
          id="evidence-pulse-heading"
          className="text-sm font-semibold text-foreground"
        >
          Evidence Pulse
        </h2>

        {showBadge && (
          <span
            className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            aria-label={`${total_count} new evidence item${total_count !== 1 ? "s" : ""}`}
          >
            {total_count}
          </span>
        )}

        {!newLoading && !newError && (
          <TrendArrow direction={trend} className="ml-0.5" />
        )}
      </div>

      {/* Two-column feed layout */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Left column — New Evidence */}
        <NewEvidenceColumn topicId={topicId ?? undefined} />

        {/* Right column — Contradictions */}
        <section
          aria-labelledby="evidence-pulse-contradictions-heading"
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-1.5">
            <AlertTriangle
              aria-hidden="true"
              className="size-3.5 text-rose-600 dark:text-rose-400"
            />
            <h3
              id="evidence-pulse-contradictions-heading"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Contradictions
            </h3>
          </div>

          <ul role="list" aria-label="Contradiction pairs" className="flex flex-col gap-1.5">
            {contradictionsLoading ? (
              Array.from({ length: 4 }, (_, i) => <SkeletonContradictionRow key={i} />)
            ) : contradictionsError ? (
              <li
                role="alert"
                className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground"
              >
                <span className="font-medium text-destructive">Failed to load contradictions.</span>
              </li>
            ) : contradictions.length === 0 ? (
              <li
                role="status"
                className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground"
              >
                No contradictions detected.
              </li>
            ) : (
              contradictions.map((pair, i) => (
                <ContradictionRow key={`${pair.artifact_a.id}-${pair.artifact_b.id}-${i}`} pair={pair} />
              ))
            )}
          </ul>
        </section>
      </div>
    </section>
  );
}
