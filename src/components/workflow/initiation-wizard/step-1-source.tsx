"use client";

/**
 * Step1Source — Source / scope selection for the Initiation Wizard.
 *
 * Stitch reference: workflow-initiation-step-1-intake.html
 *
 * User picks one of three predefined scope options:
 *   - All Library
 *   - Recent Drafts
 *   - Selected Artifacts (individual artifact picker, future-ready placeholder
 *     — shows informational note in v1.5 as artifact multi-select is out of scope)
 *
 * On Next, the selected option is surfaced to the wizard's reducer.
 */

import { cn } from "@/lib/utils";
import type { SourceSelection } from "@/lib/api/workflow-templates";

export interface Step1SourceProps {
  value: SourceSelection;
  onChange: (sel: SourceSelection) => void;
}

interface ScopeOption {
  type: SourceSelection["type"];
  label: string;
  description: string;
  icon: React.ReactNode;
}

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    className="size-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const LibraryIcon = () => (
  <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25" />
  </svg>
);

const DraftIcon = () => (
  <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
);

const SelectIcon = () => (
  <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
  </svg>
);

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    type: "all_library",
    label: "All Library",
    description: "Run across every artifact in your vault — comprehensive scope.",
    icon: <LibraryIcon />,
  },
  {
    type: "recent_drafts",
    label: "Recent Drafts",
    description: "Scope to artifacts updated in the last 7 days with status 'raw' or 'draft'.",
    icon: <DraftIcon />,
  },
  {
    type: "selected_artifacts",
    label: "Selected Artifacts",
    description: "Manually specify artifacts by ID — granular control for targeted runs.",
    icon: <SelectIcon />,
  },
];

export function Step1Source({ value, onChange }: Step1SourceProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Select Source Scope</h2>
        <p className="mt-1 text-sm text-muted-foreground italic">
          Define the artifact pool this workflow will operate on.
        </p>
      </div>

      {/* Scope options */}
      <fieldset>
        <legend className="sr-only">Source scope options</legend>
        <div className="flex flex-col gap-3">
          {SCOPE_OPTIONS.map((opt) => {
            const isSelected = value.type === opt.type;
            return (
              <label
                key={opt.type}
                className={cn(
                  "relative flex cursor-pointer items-start gap-4 rounded-lg border-2 p-5 transition-all duration-150",
                  "hover:border-foreground/30 hover:bg-accent/40",
                  "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
                  isSelected
                    ? "border-foreground bg-accent/50"
                    : "border-border bg-card",
                )}
              >
                <input
                  type="radio"
                  name="source-scope"
                  value={opt.type}
                  checked={isSelected}
                  onChange={() => onChange({ type: opt.type })}
                  className="sr-only"
                  aria-label={opt.label}
                />

                {/* Icon container */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                    isSelected ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                  )}
                >
                  {opt.icon}
                </div>

                {/* Label + desc */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{opt.label}</span>
                    {opt.type === "selected_artifacts" && (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        v1.5
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {opt.description}
                  </p>

                  {/* Selected artifacts note */}
                  {opt.type === "selected_artifacts" && isSelected && (
                    <p className="mt-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      Artifact multi-select picker is available in a future update.
                      The workflow will run scoped to your current selection context.
                    </p>
                  )}
                </div>

                {/* Check indicator */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted-foreground/40 bg-transparent",
                  )}
                >
                  {isSelected && <CheckIcon />}
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
