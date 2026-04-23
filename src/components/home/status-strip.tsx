"use client";

/**
 * StatusStrip — "Systems online — {formatted date}" banner above the page heading.
 *
 * Design spec §4.5: status strip above WelcomeHeader.
 * Date is rendered client-side to avoid SSR/hydration mismatch on the
 * formatted locale string.
 *
 * Created for Portal v1.5 Stitch Reskin Phase 6 (P6-01).
 */

import { cn } from "@/lib/utils";

interface StatusStripProps {
  className?: string;
}

function formatCurrentDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function StatusStrip({ className }: StatusStripProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs font-medium",
        "text-muted-foreground",
        className,
      )}
    >
      {/* Status indicator dot */}
      <span
        aria-hidden="true"
        className="inline-block size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
      />
      <span>
        Systems online &mdash; {formatCurrentDate()}
      </span>
    </div>
  );
}
