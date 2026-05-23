"use client";

/**
 * CompletionBadge — shows a green checkmark circle when isComplete is true.
 *
 * Renders nothing when isComplete is false to keep the FlowCard footer
 * visually clean in Phase 2 (all cards start incomplete).
 *
 * WCAG 2.1 AA: uses aria-label on the icon so screen readers announce
 * "Completed" rather than the bare SVG.
 */

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompletionBadgeProps {
  isComplete: boolean;
  className?: string;
}

export function CompletionBadge({ isComplete, className }: CompletionBadgeProps) {
  if (!isComplete) return null;

  return (
    <span
      role="img"
      aria-label="Completed"
      className={cn("inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400", className)}
    >
      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
      <span className="text-xs font-medium">Completed</span>
    </span>
  );
}
