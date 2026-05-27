"use client";

/**
 * CostHUD — per-stage LLM cost breakdown panel for artifact detail views.
 *
 * Renders a compact breakdown table of token usage and USD cost for each
 * pipeline stage (classify → extract → compile → query) with a total row.
 *
 * Rendering states:
 *   - Loading: animated shimmer skeleton matching the table structure
 *   - Error: inline "Cost data unavailable" notice with error detail
 *   - null costBreakdown: "No cost data available" informational notice
 *   - Data present: per-stage rows + totals row
 *
 * USD display:
 *   - ``usd_cents`` from backend (integer cents); displayed as dollars
 *     to 4 decimal places (e.g. 0.0012) when non-null.
 *   - Shown as "—" when ``usd_cents`` is null (provider omits pricing).
 *
 * Accessibility (WCAG 2.1 AA):
 *   - Table element with caption carries aria-label on the section.
 *   - Each stage row has an aria-label: "{stage}: {tokens} tokens, {usd}".
 *   - Total row is scoped with role="rowgroup" and aria-label.
 *   - All interactive rows are tab-navigable (tabIndex=0).
 *   - Skeleton carries aria-hidden="true".
 *
 * Stage ordering: classify → extract → compile → query (canonical pipeline order).
 * Stages absent from ``stages`` array are omitted rather than shown as zero.
 *
 * P4-FE-003.
 */

import { cn } from "@/lib/utils";
import type { CostBreakdownResponse, CostStageRow } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostHUDProps {
  costBreakdown: CostBreakdownResponse | null;
  isLoading: boolean;
  error: Error | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Canonical display order for pipeline stages */
const STAGE_ORDER: CostStageRow["stage"][] = [
  "classify",
  "extract",
  "compile",
  "query",
];

const STAGE_LABELS: Record<CostStageRow["stage"], string> = {
  classify: "Classify",
  extract: "Extract",
  compile: "Compile",
  query: "Query",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert usd_cents (integer) to a dollar display string.
 * Uses 4 decimal places to show sub-cent amounts precisely.
 * Returns "—" when usd_cents is null.
 */
function formatUsd(usd_cents: number | null): string {
  if (usd_cents === null) return "—";
  return `$${(usd_cents / 100).toFixed(4)}`;
}

/**
 * Format token count with thousands separator.
 */
function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Build aria-label for a stage row.
 */
function stageAriaLabel(row: CostStageRow): string {
  const usdPart =
    row.usd_cents !== null
      ? `, cost ${formatUsd(row.usd_cents)}`
      : ", cost not available";
  return `${STAGE_LABELS[row.stage]}: ${formatTokens(row.tokens)} tokens${usdPart}`;
}

/**
 * Sort stages according to canonical pipeline order.
 * Unknown stages are appended after known ones.
 */
function sortedStages(stages: CostStageRow[]): CostStageRow[] {
  return [...stages].sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a.stage);
    const bi = STAGE_ORDER.indexOf(b.stage);
    const aIdx = ai === -1 ? STAGE_ORDER.length : ai;
    const bIdx = bi === -1 ? STAGE_ORDER.length : bi;
    return aIdx - bIdx;
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-sm bg-muted", className)}
    />
  );
}

function SkeletonState() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 p-3">
      {/* Heading shimmer */}
      <Shimmer className="mb-1 h-3 w-20" />
      {/* 3 row shimmers */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <Shimmer className="h-3.5 w-16" />
          <div className="flex gap-3">
            <Shimmer className="h-3.5 w-16" />
            <Shimmer className="h-3.5 w-14" />
          </div>
        </div>
      ))}
      {/* Total shimmer */}
      <div className="mt-1 flex items-center justify-between gap-3 border-t pt-2">
        <Shimmer className="h-3.5 w-10" />
        <div className="flex gap-3">
          <Shimmer className="h-3.5 w-16" />
          <Shimmer className="h-3.5 w-14" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 p-3"
    >
      <p className="text-xs font-medium text-destructive">
        Cost data unavailable
      </p>
      {error.message && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {error.message}
        </p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-1.5 py-6 text-center">
      <p className="text-xs font-medium text-foreground">No cost data available</p>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Cost telemetry was not recorded for this artifact.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage row
// ---------------------------------------------------------------------------

interface StageRowProps {
  row: CostStageRow;
  isLast: boolean;
}

function StageRow({ row, isLast }: StageRowProps) {
  return (
    <tr
      tabIndex={0}
      aria-label={stageAriaLabel(row)}
      className={cn(
        "group text-xs transition-colors",
        "focus:outline-none focus-visible:bg-muted/50",
        !isLast && "border-b border-border/50",
      )}
    >
      <td className="py-1.5 pr-3 font-medium text-foreground/80">
        {STAGE_LABELS[row.stage] ?? row.stage}
      </td>
      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
        {formatTokens(row.tokens)}
      </td>
      <td
        className={cn(
          "py-1.5 text-right tabular-nums",
          row.usd_cents !== null
            ? "text-foreground"
            : "text-muted-foreground/60",
        )}
      >
        {formatUsd(row.usd_cents)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Total row
// ---------------------------------------------------------------------------

interface TotalRowProps {
  totalTokens: number;
  totalUsd: number | null;
}

function TotalRow({ totalTokens, totalUsd }: TotalRowProps) {
  const ariaLabel = `Total: ${formatTokens(totalTokens)} tokens${totalUsd !== null ? `, cost ${formatUsd(totalUsd)}` : ""}`;

  return (
    <tr
      tabIndex={0}
      aria-label={ariaLabel}
      className="text-xs focus:outline-none focus-visible:bg-muted/50"
    >
      <td className="pt-2 pr-3 font-semibold text-foreground">Total</td>
      <td className="pt-2 pr-3 text-right tabular-nums font-semibold text-foreground">
        {formatTokens(totalTokens)}
      </td>
      <td
        className={cn(
          "pt-2 text-right tabular-nums font-semibold",
          totalUsd !== null ? "text-foreground" : "text-muted-foreground/60",
        )}
      >
        {formatUsd(totalUsd)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * CostHUD renders a per-stage LLM cost breakdown for a compiled artifact.
 *
 * Accepts pre-fetched data via props so the parent can control when and how
 * the data is fetched (e.g. useCostBreakdown hook or server-side fetch).
 *
 * The component renders nothing for the outer container only when both
 * ``isLoading`` is false and no data / error is present — callers can
 * always mount CostHUD and it will self-manage all states.
 */
export function CostHUD({
  costBreakdown,
  isLoading,
  error,
  className,
}: CostHUDProps) {
  return (
    <section
      aria-label="LLM cost breakdown"
      className={cn(
        "rounded-md border border-border bg-card",
        className,
      )}
    >
      {/* Section heading */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cost Breakdown
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground/60" aria-hidden="true">
          tokens / USD
        </span>
      </div>

      {/* Body */}
      <div className="min-h-[4rem]">
        {isLoading ? (
          <SkeletonState />
        ) : error ? (
          <ErrorState error={error} />
        ) : !costBreakdown ? (
          <EmptyState />
        ) : (
          <div className="px-3 pb-3 pt-2">
            <table className="w-full border-collapse" aria-label="Cost breakdown by pipeline stage">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  <th scope="col" className="pb-1.5 pr-3 text-left font-medium">
                    Stage
                  </th>
                  <th scope="col" className="pb-1.5 pr-3 text-right font-medium">
                    Tokens
                  </th>
                  <th scope="col" className="pb-1.5 text-right font-medium">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup" aria-label="Per-stage cost breakdown">
                {sortedStages(costBreakdown.stages).map((row, idx, arr) => (
                  <StageRow
                    key={row.stage}
                    row={row}
                    isLast={idx === arr.length - 1}
                  />
                ))}
              </tbody>
              <tfoot
                role="rowgroup"
                aria-label="Cost totals"
                className="border-t border-border"
              >
                <TotalRow
                  totalTokens={costBreakdown.total_tokens}
                  totalUsd={costBreakdown.total_usd}
                />
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
