/**
 * ResearchWorkspaceEmpty — always-on empty state banner for Research Home.
 *
 * Displayed at the top of the Research Home scaffold until v1.6 APIs ship
 * and the workspace has real content. Softly styled — informational, not
 * alarming.
 *
 * P6-03: Research Home editorial scaffold (APIs deferred to v1.6 per OQ-2).
 */

import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ResearchWorkspaceEmptyProps {
  className?: string;
}

export function ResearchWorkspaceEmpty({
  className,
}: ResearchWorkspaceEmptyProps) {
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
