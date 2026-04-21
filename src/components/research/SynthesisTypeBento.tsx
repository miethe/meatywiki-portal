"use client";

/**
 * SynthesisTypeBento — synthesis-type selection bento for Step 2 of the
 * Synthesis Builder 2-step wizard (ADR-DPI-005 Option A).
 *
 * Renders a bento-style grid of synthesis type cards. Each card shows:
 *   - Icon
 *   - Type name
 *   - Short description of what this synthesis mode produces
 *   - Selected state (ring highlight)
 *
 * Types shipped in v1.5:
 *   summary    — concise digest of the sources
 *   analysis   — structured analysis with pros/cons, patterns, gaps
 *   compare    — side-by-side comparison across sources
 *   synthesize — opinionated synthesis: integrates, infers, and extends
 *
 * Future type extension: add entries to SYNTHESIS_TYPES — no structural
 * changes needed. Backend DTO consumes the `type` string directly.
 *
 * ADR: ADR-DPI-005
 * Tasks: DP4-02d
 */

import { useCallback } from "react";
import {
  FileText,
  BarChart3,
  GitCompare,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Type catalogue
// ---------------------------------------------------------------------------

export type SynthesisType =
  | "summary"
  | "analysis"
  | "compare"
  | "synthesize";

interface SynthesisTypeDescriptor {
  id: SynthesisType;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  iconColour: string; // Tailwind text colour class
  accentColour: string; // Tailwind ring/border colour class
}

const SYNTHESIS_TYPES: SynthesisTypeDescriptor[] = [
  {
    id: "summary",
    label: "Summary",
    description:
      "Produces a concise digest of the key points across your sources — best for getting a quick overview.",
    Icon: FileText,
    iconColour: "text-sky-500",
    accentColour: "ring-sky-400 border-sky-300 bg-sky-50 dark:bg-sky-950/20",
  },
  {
    id: "analysis",
    label: "Analysis",
    description:
      "Structured analysis of patterns, strengths, gaps, and themes across sources — best for deep dives.",
    Icon: BarChart3,
    iconColour: "text-amber-500",
    accentColour: "ring-amber-400 border-amber-300 bg-amber-50 dark:bg-amber-950/20",
  },
  {
    id: "compare",
    label: "Compare",
    description:
      "Side-by-side comparison across sources on shared dimensions — best for contrasting distinct views.",
    Icon: GitCompare,
    iconColour: "text-violet-500",
    accentColour: "ring-violet-400 border-violet-300 bg-violet-50 dark:bg-violet-950/20",
  },
  {
    id: "synthesize",
    label: "Synthesize",
    description:
      "Opinionated synthesis that integrates, infers, and extends beyond the sources — best for original insight.",
    Icon: Layers,
    iconColour: "text-emerald-500",
    accentColour: "ring-emerald-400 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20",
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SynthesisTypeBentoProps {
  value: SynthesisType | null;
  onChange: (type: SynthesisType) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// SynthesisTypeBento
// ---------------------------------------------------------------------------

export function SynthesisTypeBento({
  value,
  onChange,
  className,
}: SynthesisTypeBentoProps) {
  const handleSelect = useCallback(
    (id: SynthesisType) => {
      onChange(id);
    },
    [onChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Synthesis type"
      aria-required="true"
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2",
        className,
      )}
    >
      {SYNTHESIS_TYPES.map(({ id, label, description, Icon, iconColour, accentColour }) => {
        const isSelected = value === id;

        return (
          <div
            key={id}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${label}: ${description}`}
            tabIndex={0}
            onClick={() => handleSelect(id)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                handleSelect(id);
              }
            }}
            className={cn(
              "relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-all",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isSelected
                ? cn("ring-2", accentColour)
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/20",
            )}
          >
            {/* Selection indicator */}
            <div
              aria-hidden="true"
              className={cn(
                "absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                isSelected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40",
              )}
            >
              {isSelected && (
                <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              )}
            </div>

            {/* Icon */}
            <Icon
              aria-hidden
              className={cn("size-6", iconColour)}
            />

            {/* Label + description */}
            <div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Re-export catalogue so pages/forms can read type labels
export { SYNTHESIS_TYPES };
