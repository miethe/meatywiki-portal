"use client";

/**
 * WorkspaceBadge — displays the artifact's workspace context.
 *
 * Stitch reference: artifact card component hierarchy (§3.1).
 * v1 workspaces: inbox | library | research | blog | projects
 */

import { cn } from "@/lib/utils";
import type { ArtifactWorkspace } from "@/types/artifact";

interface WorkspaceBadgeProps {
  workspace: ArtifactWorkspace;
  className?: string;
}

const WORKSPACE_LABELS: Record<ArtifactWorkspace, string> = {
  inbox: "Inbox",
  library: "Library",
  research: "Research",
  blog: "Blog",
  projects: "Projects",
};

const WORKSPACE_COLOURS: Record<ArtifactWorkspace, string> = {
  inbox: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  library: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  research: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  blog: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  projects: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

export function WorkspaceBadge({ workspace, className }: WorkspaceBadgeProps) {
  const label = WORKSPACE_LABELS[workspace] ?? workspace;
  const colours = WORKSPACE_COLOURS[workspace] ?? "bg-muted text-muted-foreground";

  return (
    <span
      aria-label={`Workspace: ${label}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        colours,
        className,
      )}
    >
      {label}
    </span>
  );
}
