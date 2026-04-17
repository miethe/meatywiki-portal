"use client";

/**
 * FreshnessBadge (artifact) — compact freshness indicator driven by raw
 * frontmatter fields returned on GET /api/artifacts/:id.
 *
 * This component is DISTINCT from the FreshnessBadge in src/components/ui/lens-badge.tsx,
 * which reads from artifact.metadata.freshness (the Lens overlay dimension).
 * This component reads the raw frontmatter fields `lens_freshness` and
 * `stale_after` to compute the displayed state independently.
 *
 * Freshness logic (SC-P4-5 binding):
 *   "current"  → lens_freshness == "fresh" AND (no stale_after OR stale_after > now)
 *   "stale"    → lens_freshness == "stale"  OR  stale_after <= now
 *   "outdated" → lens_freshness == "outdated"
 *   missing/null → renders nothing (graceful degradation, no crash, no console error)
 *
 * Note: stale_after past-date check OVERRIDES lens_freshness=fresh.
 *
 * Color mapping:
 *   current  → green  (emerald)
 *   stale    → amber
 *   outdated → red
 *
 * Visual language matches the existing LensBadgeSet compact pill style so it
 * can sit directly beside it in the header badge row.
 *
 * WCAG 2.1 AA: aria-label carries both color intent and text label.
 *
 * Phase: P4-04.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

export type ComputedFreshnessState = "current" | "stale" | "outdated";

/**
 * Derives the visual freshness state from raw frontmatter values.
 *
 * Returns null when inputs are insufficient to compute a meaningful state
 * (both fields missing/null) — callers render nothing in that case per SC-P4-5.
 */
export function computeFreshnessState(
  lensFreshness: string | null | undefined,
  staleAfter: string | null | undefined,
): ComputedFreshnessState | null {
  // Compute stale_after expiry first — it can override lens_freshness=fresh.
  const isExpiredByDate: boolean = (() => {
    if (!staleAfter) return false;
    try {
      const expiryMs = new Date(staleAfter).getTime();
      if (Number.isNaN(expiryMs)) return false;
      return Date.now() >= expiryMs;
    } catch {
      return false;
    }
  })();

  // Normalize lens_freshness to lowercase for comparison.
  const raw = lensFreshness?.toLowerCase()?.trim() ?? null;

  if (raw === "outdated") return "outdated";

  if (raw === "stale") return "stale";

  // stale_after date override: even if lens_freshness says "fresh", a past
  // stale_after date means the artifact is now stale.
  if (raw === "fresh") {
    return isExpiredByDate ? "stale" : "current";
  }

  // When lens_freshness is missing but stale_after is in the past, surface
  // "stale" (the date alone is sufficient signal).
  if (isExpiredByDate) return "stale";

  // Insufficient data — render nothing.
  return null;
}

// ---------------------------------------------------------------------------
// Styling maps
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<ComputedFreshnessState, string> = {
  current: "current",
  stale: "stale",
  outdated: "outdated",
};

const STATE_CLASSES: Record<ComputedFreshnessState, string> = {
  current:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  stale:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  outdated:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const STATE_ARIA_LABELS: Record<ComputedFreshnessState, string> = {
  current: "Freshness: current",
  stale: "Freshness: stale",
  outdated: "Freshness: outdated",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FreshnessBadgeProps {
  /**
   * Raw `lens_freshness` frontmatter value ("fresh" | "stale" | "outdated" | null).
   * Sourced from artifact.frontmatter_jsonb.lens_freshness on ArtifactDetail.
   * Also accepts artifact.metadata.freshness ("current" | "stale" | "outdated")
   * from the Lens overlay — map "current" → "fresh" before passing.
   */
  freshness?: string | null;
  /**
   * Raw `stale_after` frontmatter value (ISO 8601 date string or null).
   * Sourced from artifact.frontmatter_jsonb.stale_after on ArtifactDetail.
   */
  staleAfter?: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a compact freshness pill badge.
 *
 * Returns null (renders nothing) when freshness state cannot be determined
 * from the provided inputs. Never throws.
 */
export function ArtifactFreshnessBadge({
  freshness,
  staleAfter,
  className,
}: FreshnessBadgeProps) {
  let state: ComputedFreshnessState | null;
  try {
    state = computeFreshnessState(freshness, staleAfter);
  } catch {
    // Defensive: computeFreshnessState is designed not to throw, but guard anyway
    return null;
  }

  if (!state) return null;

  return (
    <span
      aria-label={STATE_ARIA_LABELS[state]}
      title={`Freshness indicator: ${STATE_LABELS[state]}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        STATE_CLASSES[state],
        className,
      )}
    >
      {STATE_LABELS[state]}
    </span>
  );
}
