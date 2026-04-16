"use client";

/**
 * LensBadge — read-only display of a single Lens dimension.
 *
 * V1 renders three dimensions from artifact metadata:
 *   - fidelity (high | medium | low)
 *   - freshness (current | stale | outdated)
 *   - verification_state (verified | disputed | unverified)
 *
 * The write path (assessment flows) is deferred to Portal v1.5 (DF-007).
 *
 * Gracefully renders nothing (null) when value is null/undefined so that
 * components rendering optional metadata never break (design spec §3.3).
 *
 * Stitch reference: §3.1 LensBadgeSet; addendum §3.1.
 * WCAG 2.1 AA: colour + text label, never colour-only.
 */

import { cn } from "@/lib/utils";
import type {
  LensFidelity,
  LensFreshness,
  LensVerificationState,
} from "@/types/artifact";

// ---------------------------------------------------------------------------
// Fidelity
// ---------------------------------------------------------------------------

interface FidelityBadgeProps {
  value: LensFidelity | null | undefined;
  className?: string;
}

const FIDELITY_COLOURS: Record<LensFidelity, string> = {
  high: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function FidelityBadge({ value, className }: FidelityBadgeProps) {
  if (!value) return null;
  return (
    <span
      aria-label={`Fidelity: ${value}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        FIDELITY_COLOURS[value],
        className,
      )}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Freshness
// ---------------------------------------------------------------------------

interface FreshnessBadgeProps {
  value: LensFreshness | null | undefined;
  className?: string;
}

const FRESHNESS_COLOURS: Record<LensFreshness, string> = {
  current: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  stale: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  outdated: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

export function FreshnessBadge({ value, className }: FreshnessBadgeProps) {
  if (!value) return null;
  return (
    <span
      aria-label={`Freshness: ${value}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        FRESHNESS_COLOURS[value],
        className,
      )}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Verification state
// ---------------------------------------------------------------------------

interface VerificationBadgeProps {
  value: LensVerificationState | null | undefined;
  className?: string;
}

const VERIFICATION_COLOURS: Record<LensVerificationState, string> = {
  verified:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  disputed: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  unverified:
    "bg-muted text-muted-foreground",
};

export function VerificationBadge({
  value,
  className,
}: VerificationBadgeProps) {
  if (!value) return null;
  return (
    <span
      aria-label={`Verification: ${value}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        VERIFICATION_COLOURS[value],
        className,
      )}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// LensBadgeSet — renders all three dimensions in a single row
// ---------------------------------------------------------------------------

interface LensBadgeSetProps {
  fidelity?: LensFidelity | null;
  freshness?: LensFreshness | null;
  verification_state?: LensVerificationState | null;
  variant?: "compact" | "full";
  className?: string;
}

/**
 * LensBadgeSet renders all available Lens dimensions inline.
 *
 * variant="compact" — used on artifact cards (Inbox, Library)
 * variant="full"    — used in artifact detail header
 *
 * When all three values are null/undefined, renders nothing (no DOM node)
 * to preserve layout stability (design spec §3.3 invariant).
 */
export function LensBadgeSet({
  fidelity,
  freshness,
  verification_state,
  variant = "compact",
  className,
}: LensBadgeSetProps) {
  const hasAny = fidelity || freshness || verification_state;
  if (!hasAny) return null;

  return (
    <div
      aria-label="Lens badges"
      className={cn(
        "flex flex-wrap items-center gap-1",
        variant === "full" && "gap-1.5",
        className,
      )}
    >
      <FidelityBadge value={fidelity} />
      <FreshnessBadge value={freshness} />
      <VerificationBadge value={verification_state} />
    </div>
  );
}
