"use client";

/**
 * TypeBadge — displays an artifact type label with a colour-coded pill.
 *
 * Artifact types map to design-spec §3.1 colour coding:
 *   raw_note → muted | concept → blue | entity → violet |
 *   topic → amber | synthesis → emerald | evidence → rose |
 *   glossary → slate | other → secondary
 *
 * Stitch reference: artifact card component hierarchy (§3.1).
 * WCAG 2.1 AA: colour is supplemented by text label (never colour-only).
 */

import { cn } from "@/lib/utils";
import {
  getArtifactTypeBadgeClassName,
  getArtifactTypeLabel,
} from "@/lib/artifact-type-presentation";

type ArtifactType =
  | "raw_note"
  | "concept"
  | "entity"
  | "topic"
  | "synthesis"
  | "evidence"
  | "glossary"
  | (string & {});

interface TypeBadgeProps {
  type: ArtifactType;
  className?: string;
}

export function TypeBadge({ type, className }: TypeBadgeProps) {
  const label = getArtifactTypeLabel(type);
  const colours = getArtifactTypeBadgeClassName(type);

  return (
    <span
      aria-label={`Type: ${label}`}
      title={`Type: ${label}`}
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold leading-tight",
        colours,
        className,
      )}
    >
      {label}
    </span>
  );
}
