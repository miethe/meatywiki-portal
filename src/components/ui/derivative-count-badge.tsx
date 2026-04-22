"use client";

/**
 * DerivativeCountBadge — small chip showing how many derivative artifacts
 * have been compiled from a source artifact.
 *
 * Renders one of three variants depending on the props provided:
 *   href    → <Link> (navigates to derivative list)
 *   onClick → <button> (trigger custom handler)
 *   neither → <span> (non-interactive display)
 *
 * Accessibility:
 *   - Interactive variants: aria-label="N derivatives, view list" so screen
 *     readers announce the full action intent.
 *   - Non-interactive: aria-label="N derivatives" (informational only).
 *   - Focus ring matches other badge/button patterns in the codebase.
 *
 * library-source-rollup-v1 FE-02.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Pluralisation helper
// ---------------------------------------------------------------------------

function pluralise(count: number): string {
  return count === 1 ? "1 derivative" : `${count} derivatives`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DerivativeCountBadgeProps {
  /** Number of derivatives to display. */
  count: number;
  /**
   * When provided, the badge renders as a Next.js <Link> to this URL.
   * Takes precedence over onClick.
   * Recommended value: /artifacts/{id}#derivatives
   */
  href?: string;
  /**
   * When provided (and href is absent), the badge renders as a <button>.
   * Useful for opening a modal or inline expansion.
   */
  onClick?: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Shared visual classes
// ---------------------------------------------------------------------------

const BASE_CLASSES =
  "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight " +
  "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";

const INTERACTIVE_CLASSES =
  "cursor-pointer transition-colors hover:bg-sky-200 dark:hover:bg-sky-800/60 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DerivativeCountBadge({
  count,
  href,
  onClick,
  className,
}: DerivativeCountBadgeProps) {
  const label = pluralise(count);
  const interactiveAriaLabel = `${label}, view list`;

  if (href) {
    return (
      <Link
        href={href}
        aria-label={interactiveAriaLabel}
        className={cn(BASE_CLASSES, INTERACTIVE_CLASSES, className)}
      >
        {label}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={interactiveAriaLabel}
        onClick={onClick}
        className={cn(BASE_CLASSES, INTERACTIVE_CLASSES, className)}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      aria-label={label}
      className={cn(BASE_CLASSES, className)}
    >
      {label}
    </span>
  );
}
