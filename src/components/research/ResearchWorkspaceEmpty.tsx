"use client";

/**
 * ResearchWorkspaceEmpty — conditionally-visible empty state banner for
 * Research Home.
 *
 * Hidden only when workspace-health data confirms total_artifacts > 0.
 * Visible while loading, on error, or when the workspace is genuinely empty.
 *
 * P6-03: Research Home editorial scaffold (APIs deferred per OQ-2).
 * P4-10: Conditional hide based on workspace health data.
 */

import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceHealth } from "@/hooks/useWorkspaceHealth";

export interface ResearchWorkspaceEmptyProps {
  className?: string;
}

export function ResearchWorkspaceEmpty({
  className,
}: ResearchWorkspaceEmptyProps) {
  const { health, isLoading, isError } = useWorkspaceHealth();
  const shouldHide = !isLoading && !isError && health && health.total_artifacts > 0;

  if (shouldHide) return null;

  return (
    <div
      role="status"
      aria-label="Research workspace empty state"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-dashed px-4 py-3",
        "bg-muted/40 dark:bg-muted/20",
        className,
      )}
    >
      <FlaskConical
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />
      <p className="text-sm text-muted-foreground">
        Research workspace empty.{" "}
        <span className="font-medium text-foreground">
          Capture evidence to begin synthesis.
        </span>
      </p>
    </div>
  );
}
