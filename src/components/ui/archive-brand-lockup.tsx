/**
 * ArchiveBrandLockup — project wordmark for MeatyWiki.
 *
 * Three variants:
 *   standard   — two-line stacked lockup (display name + tagline)
 *   compact    — monogram "mW" only (for collapsed-sidebar contexts)
 *   contextual — same as standard but inherits colour from parent surface
 *
 * Branding (product owner override, 2026-04-23):
 *   Line 1: "MeatyWiki"         — serif display, 15px/20px, weight 500
 *   Line 2: "THE CURATED LEDGER" — uppercase, tracking-brand-wide, 9px/12px
 *
 * Accessibility: wrapper carries role="img" + aria-label; inner text nodes are
 * aria-hidden to prevent duplicate screen-reader announcement.
 *
 * Design spec §3 + §6.1; phase plan P1-04.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArchiveBrandLockupProps {
  /** Visual layout variant. Defaults to "standard". */
  variant?: "standard" | "compact" | "contextual";
  /**
   * Show the "THE CURATED LEDGER" tagline line.
   * Defaults to true on "standard" and "contextual"; ignored on "compact".
   */
  tagline?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArchiveBrandLockup({
  variant = "standard",
  tagline = true,
  className,
}: ArchiveBrandLockupProps) {
  const isCompact = variant === "compact";
  const isContextual = variant === "contextual";
  const showTagline = !isCompact && tagline;

  return (
    <div
      role="img"
      aria-label="MeatyWiki: The Curated Ledger"
      className={cn("inline-flex flex-col", className)}
    >
      {isCompact ? (
        /* ── Monogram — "mW" ──────────────────────────────────────────── */
        <span
          aria-hidden="true"
          className={cn(
            "font-display font-medium leading-none select-none",
            // 15px to match standard line-1 size
            "text-[15px]",
            "text-[hsl(var(--portal-brand-fg))]",
          )}
        >
          mW
        </span>
      ) : (
        /* ── Two-line stacked lockup ───────────────────────────────────── */
        <>
          {/* Line 1 — display name */}
          <span
            aria-hidden="true"
            className={cn(
              "font-display font-medium leading-[20px] select-none",
              "text-[15px]",
              isContextual
                ? "text-inherit"
                : "text-[hsl(var(--portal-brand-fg))]",
            )}
          >
            MeatyWiki
          </span>

          {/* Line 2 — tagline */}
          {showTagline && (
            <span
              aria-hidden="true"
              className={cn(
                "tracking-brand-wide uppercase select-none",
                "text-[9px] leading-[12px] font-medium",
                isContextual
                  ? "text-inherit opacity-60"
                  : "text-[hsl(var(--portal-brand-muted))]",
              )}
            >
              The Curated Ledger
            </span>
          )}
        </>
      )}
    </div>
  );
}
