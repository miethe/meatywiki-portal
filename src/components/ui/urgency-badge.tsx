"use client";

/**
 * UrgencyBadge — colored dot + label + optional relative timestamp.
 *
 * Extraction-ready: zero portal-domain imports. All props are primitives.
 *
 * Accessibility:
 *   - Decorative dot is aria-hidden; semantic meaning is carried by label text.
 *   - Outer wrapper has aria-label combining level and optional relative time
 *     so screen readers get the full picture without relying on color.
 *
 * Token mapping (shipped in P1, globals.css):
 *   new          → --portal-urgency-new   (sky-500)
 *   needs-action → --portal-urgency-warn  (amber-500)
 *   stale        → --portal-urgency-stale (slate-500)
 *   urgent       → --portal-urgency-urgent (rose-600)
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type UrgencyLevel = "new" | "needs-action" | "stale" | "urgent";

export interface UrgencyBadgeProps {
  level: UrgencyLevel;
  /** Minutes since the relevant event. When provided, appends a relative time string. */
  minutesAgo?: number;
  className?: string;
}

const LEVEL_CONFIG: Record<
  UrgencyLevel,
  { label: string; dotClass: string }
> = {
  new: {
    label: "New",
    dotClass: "bg-[hsl(var(--portal-urgency-new))]",
  },
  "needs-action": {
    label: "Needs action",
    dotClass: "bg-[hsl(var(--portal-urgency-warn))]",
  },
  stale: {
    label: "Stale",
    dotClass: "bg-[hsl(var(--portal-urgency-stale))]",
  },
  urgent: {
    label: "Urgent",
    dotClass: "bg-[hsl(var(--portal-urgency-urgent))]",
  },
};

function formatRelativeTime(minutesAgo: number): string {
  if (minutesAgo < 60) {
    return `${minutesAgo} min ago`;
  }
  if (minutesAgo < 1440) {
    return `${Math.floor(minutesAgo / 60)} hr ago`;
  }
  return `${Math.floor(minutesAgo / 1440)} d ago`;
}

export function UrgencyBadge({
  level,
  minutesAgo,
  className,
}: UrgencyBadgeProps) {
  const { label, dotClass } = LEVEL_CONFIG[level];
  const relativeTime =
    minutesAgo !== undefined ? formatRelativeTime(minutesAgo) : undefined;

  const ariaLabel = relativeTime
    ? `${label} — ${relativeTime}`
    : label;

  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-foreground",
        className,
      )}
    >
      {/* Decorative status dot — hidden from assistive technology */}
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", dotClass)}
      />
      <span>{label}</span>
      {relativeTime && (
        <span className="text-muted-foreground">({relativeTime})</span>
      )}
    </span>
  );
}
