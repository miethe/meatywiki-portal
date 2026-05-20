"use client";

/**
 * GraphFilterPresets — 4 quick-start preset cards shown in the filter panel
 * when no filters are active (activeFilterCount === 0).
 *
 * Each card maps to a Partial<GraphFiltersValues> applied via onApplyPreset.
 *
 * Field mapping (from GraphFiltersValues):
 *   workspaces  → ws        (string[])
 *   freshness   → freshness (string[])
 *   fidelity F3+→ fidelity_min: 0.75
 *   conf_max    → conf_max  (confidence upper bound at 0.5 = "below 50%")
 *
 * P5-11: onboarding overlay + filter preset cards.
 */

import { Library, Sparkles, FlaskConical, AlertCircle } from "lucide-react";
import type { GraphFiltersValues } from "@/components/graph/GraphFilters";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GraphFilterPresetsProps {
  /** Called with a partial filter state to apply when the user clicks a card. */
  onApplyPreset: (partial: Partial<GraphFiltersValues>) => void;
}

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

interface Preset {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  filter: Partial<GraphFiltersValues>;
}

const PRESETS: Preset[] = [
  {
    icon: <Library aria-hidden="true" className="size-4 text-primary" />,
    title: "Show my library",
    subtitle: "All library artifacts",
    filter: { ws: ["library"] },
  },
  {
    icon: <Sparkles aria-hidden="true" className="size-4 text-amber-500" />,
    title: "High-fidelity artifacts",
    subtitle: "Fidelity F3 and above",
    // fidelity_min: 0.75 corresponds to F3+ on the 5-step scale (F0=0, F1=0.25, F2=0.5, F3=0.75, F4=1.0)
    filter: { fidelity_min: 0.75 },
  },
  {
    icon: <FlaskConical aria-hidden="true" className="size-4 text-emerald-600" />,
    title: "Recent research",
    subtitle: "Research workspace, currently fresh",
    filter: { ws: ["research"], freshness: ["current"] },
  },
  {
    icon: <AlertCircle aria-hidden="true" className="size-4 text-destructive" />,
    title: "Needs review",
    subtitle: "Confidence below 50%",
    // conf_max: 0.5 narrows to nodes with classification confidence ≤50%
    filter: { conf_min: 0, conf_max: 0.5 },
  },
];

// ---------------------------------------------------------------------------
// GraphFilterPresets
// ---------------------------------------------------------------------------

export function GraphFilterPresets({ onApplyPreset }: GraphFilterPresetsProps) {
  return (
    <div className="px-3 py-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Quick start
      </p>
      <div className="flex flex-col gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.title}
            type="button"
            onClick={() => onApplyPreset(preset.filter)}
            className={cn(
              "flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-left",
              "bg-background hover:bg-accent hover:text-accent-foreground",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "w-full",
            )}
          >
            <span className="shrink-0 mt-0.5">{preset.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium leading-none mb-0.5 truncate">{preset.title}</p>
              <p className="text-[10px] text-muted-foreground leading-snug">{preset.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
