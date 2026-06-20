"use client";

/**
 * ArtifactResultRow — rich single-row presentation for a search result.
 *
 * Documented @miethe/ui gap: the shared design system has no equivalent rich
 * result-row primitive for artifact pickers, so this is a LOCAL component.
 * It is co-located with ArtifactSearchDialog (src/components/search/) and is
 * intentionally not exported from the barrel — callers should go through
 * ArtifactSearchDialog.
 *
 * Visual anatomy (left → right):
 *   [type-accent bar] [type icon/badge] [title + description/preview] [tags]
 *   [selection check when selected]
 *
 * WCAG 2.1 AA: role="option", aria-selected, title text present even when
 * truncated (title attribute). No colour-only affordance (check icon + accent
 * bar + bg change all contribute to selected state).
 */

import React from "react";
import { Check, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getArtifactTypeLabel,
  getArtifactTypeBadgeClassName,
  getArtifactTypeAccentColor,
} from "@/lib/artifact-type-presentation";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Icon map — lucide glyphs per artifact type family
// ---------------------------------------------------------------------------

function ArtifactTypeIcon({ type, className }: { type: string; className?: string }) {
  // We use a coloured square badge as the icon — it conveys semantic colour
  // without requiring a per-type icon set (which does not exist in the codebase).
  const badgeClass = getArtifactTypeBadgeClassName(type);
  const label = getArtifactTypeLabel(type);

  return (
    <span
      aria-hidden="true"
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm border px-1.5 py-0.5 text-[10px] font-bold leading-none uppercase tracking-wide",
        badgeClass,
        className,
      )}
    >
      {label.slice(0, 3)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ArtifactResultRowProps {
  artifact: ArtifactCard;
  /** Whether this item is currently selected (multi mode). */
  selected?: boolean;
  /** Whether keyboard focus is on this row. */
  highlighted?: boolean;
  /** Aria option id for the parent listbox. */
  optionId?: string;
  onMouseDown?: React.MouseEventHandler<HTMLLIElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLLIElement>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArtifactResultRow({
  artifact,
  selected = false,
  highlighted = false,
  optionId,
  onMouseDown,
  onMouseEnter,
}: ArtifactResultRowProps) {
  const accentColor = getArtifactTypeAccentColor(artifact.type);

  // Real tags from ArtifactCard.tags (populated from frontmatter by backend).
  // Fall back to series as a supplemental metadata badge when no tags present.
  const tags: string[] = artifact.tags ?? [];
  const metaBadges: string[] = [...tags];
  if (metaBadges.length === 0 && artifact.series) {
    metaBadges.push(artifact.series);
  }

  return (
    <li
      id={optionId}
      role="option"
      aria-selected={selected}
      title={artifact.title}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      className={cn(
        // Base
        "group relative flex cursor-pointer select-none items-start gap-3 px-3 py-2.5 text-sm transition-colors",
        // Hover / keyboard highlight
        highlighted
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 hover:text-accent-foreground",
        // Selected tint
        selected && "bg-primary/5",
      )}
    >
      {/* Left accent bar — type colour identity */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-1 h-[calc(100%-8px)] w-[3px] rounded-full"
        style={{ backgroundColor: accentColor }}
      />

      {/* Type badge */}
      <div className="mt-0.5 shrink-0">
        <ArtifactTypeIcon type={artifact.type} />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium leading-snug text-foreground">
            {artifact.title}
          </span>
          {artifact.status && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {artifact.status}
            </span>
          )}
        </div>

        {/* Preview / description */}
        {artifact.preview && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {artifact.preview}
          </p>
        )}

        {/* Tags / meta badges */}
        {metaBadges.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="Tags">
            <Tag aria-hidden="true" className="h-3 w-3 text-muted-foreground/60" />
            {metaBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center rounded-sm border border-border bg-secondary px-1.5 py-px text-[10px] leading-none text-secondary-foreground"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Selection indicator (multi mode) */}
      <div
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          selected
            ? "border-primary bg-primary"
            : "border-input opacity-0 group-hover:opacity-100",
        )}
      >
        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
    </li>
  );
}
