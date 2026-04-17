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

const TYPE_LABELS: Record<string, string> = {
  raw_note: "Note",
  concept: "Concept",
  entity: "Entity",
  topic: "Topic",
  synthesis: "Synthesis",
  evidence: "Evidence",
  glossary: "Glossary",
};

const TYPE_COLOURS: Record<string, string> = {
  raw_note: "bg-muted text-muted-foreground",
  concept: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  entity:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  topic: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  synthesis:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  evidence: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  glossary: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function TypeBadge({ type, className }: TypeBadgeProps) {
  const label = TYPE_LABELS[type] ?? type;
  const colours = TYPE_COLOURS[type] ?? "bg-secondary text-secondary-foreground";

  return (
    <span
      aria-label={`Type: ${label}`}
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
