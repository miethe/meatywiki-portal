"use client";

/**
 * FacetBadge — displays the artifact's portal surface facet.
 *
 * Rendered on ArtifactCard when the artifact belongs to a non-library facet
 * (blog or projects). Library facet is already implied by context; research
 * facet is signalled via research_origin (handled by P5-06 Lens Badges).
 *
 * Taxonomy-redesign P5-02.
 *
 * Props:
 *   facet — ArtifactFacet value ("library" | "research" | "blog" | "projects")
 *   className — optional class override
 *
 * P5-06 coordination: The `research_origin` styling hook lives on ArtifactCard
 * (research_origin prop → data-research-origin attribute + CSS class). This
 * component renders a separate badge for workspace facets only.
 */

import { cn } from "@/lib/utils";
import type { ArtifactFacet } from "@/types/artifact";

interface FacetBadgeProps {
  facet: ArtifactFacet;
  className?: string;
}

const FACET_LABELS: Record<ArtifactFacet, string> = {
  library: "Library",
  research: "Research",
  blog: "Blog",
  projects: "Projects",
};

const FACET_COLOURS: Record<ArtifactFacet, string> = {
  library: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  research: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  blog: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  projects: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

export function FacetBadge({ facet, className }: FacetBadgeProps) {
  const label = FACET_LABELS[facet] ?? facet;
  const colours = FACET_COLOURS[facet] ?? "bg-muted text-muted-foreground";

  return (
    <span
      aria-label={`Facet: ${label}`}
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
