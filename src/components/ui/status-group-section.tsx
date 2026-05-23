"use client";

/**
 * StatusGroupSection — section header with count pill and optional urgency tint.
 *
 * Extraction-ready: zero portal-domain imports. All props are primitives.
 *
 * Used by Workflow OS surfaces (Inbox section headers, status groups).
 * Design spec §3 (portal-v1.5-stitch-reskin): urgency-tinted count pill
 * uses --portal-urgency-warn / --portal-urgency-urgent tokens shipped in P1.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusGroupSectionProps {
  label: string;
  count: number;
  /** Tints the count pill when non-normal. Default: 'normal' */
  urgency?: "normal" | "warn" | "urgent";
  /**
   * Optional info element rendered inline to the right of the label text.
   * Accepts any ReactNode — typically an <InfoTooltip> icon. When undefined,
   * no extra element is rendered and existing callers are unaffected.
   */
  info?: React.ReactNode;
  /**
   * Optional element rendered to the left of the count pill (right side of
   * the header row). Typically used for a per-column InfoTooltip icon such as
   * explaining the urgency badge scoring used across all rows in this group.
   */
  rightInfo?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const COUNT_PILL_STYLES: Record<
  NonNullable<StatusGroupSectionProps["urgency"]>,
  string
> = {
  normal:
    "bg-muted text-muted-foreground",
  warn:
    "bg-[hsl(var(--portal-urgency-warn)/0.15)] text-[hsl(var(--portal-urgency-warn))] ring-1 ring-[hsl(var(--portal-urgency-warn)/0.4)]",
  urgent:
    "bg-[hsl(var(--portal-urgency-urgent)/0.15)] text-[hsl(var(--portal-urgency-urgent))] ring-1 ring-[hsl(var(--portal-urgency-urgent)/0.4)]",
};

export function StatusGroupSection({
  label,
  count,
  urgency = "normal",
  info,
  rightInfo,
  children,
  className,
}: StatusGroupSectionProps) {
  const pillStyles = COUNT_PILL_STYLES[urgency];

  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        {/* Left: label + optional inline info icon */}
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
          {info ?? null}
        </span>
        {/* Right: optional column-level info icon + count pill */}
        <span className="inline-flex items-center gap-1.5">
          {rightInfo ?? null}
          <span
            aria-label={`${count} item${count !== 1 ? "s" : ""}`}
            className={cn(
              "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
              pillStyles,
            )}
          >
            {count}
          </span>
        </span>
      </div>
      {children}
    </section>
  );
}
