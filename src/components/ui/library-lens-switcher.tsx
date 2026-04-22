"use client";

/**
 * LibraryLensSwitcher — horizontal chip group for selecting the Library view lens.
 *
 * Eight lenses are available:
 *   default       → source rollup view (view=source_rollup)
 *   concepts      → flat type=concept
 *   entities      → flat type=entity
 *   syntheses     → flat type=synthesis
 *   evidence      → flat type=evidence
 *   contradictions → flat type=contradiction
 *   glossary      → flat type=glossary
 *   orphans       → source rollup + rollup_lens=orphans
 *
 * The active lens chip uses aria-pressed=true. All chips are keyboard
 * navigable as standard <button> elements in the tab order.
 *
 * Orphans has inline visually-hidden help text and a title attribute:
 *   "Orphans: Derivatives with no resolvable source. May indicate missing
 *    edges or truly rootless artifacts."
 *
 * library-source-rollup-v1 FE-05.
 */

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Lens types (public)
// ---------------------------------------------------------------------------

export type LibraryLens =
  | "default"
  | "concepts"
  | "entities"
  | "syntheses"
  | "evidence"
  | "contradictions"
  | "glossary"
  | "orphans";

// ---------------------------------------------------------------------------
// Lens config
// ---------------------------------------------------------------------------

interface LensOption {
  value: LibraryLens;
  label: string;
  /** Tooltip / title text for lenses that need extra explanation */
  help?: string;
}

const LENS_OPTIONS: LensOption[] = [
  { value: "default", label: "All Sources" },
  { value: "concepts", label: "Concepts" },
  { value: "entities", label: "Entities" },
  { value: "syntheses", label: "Syntheses" },
  { value: "evidence", label: "Evidence" },
  { value: "contradictions", label: "Contradictions" },
  { value: "glossary", label: "Glossary" },
  {
    value: "orphans",
    label: "Orphans",
    help: "Orphans: Derivatives with no resolvable source. May indicate missing edges or truly rootless artifacts.",
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LibraryLensSwitcherProps {
  /** Currently selected lens */
  lens: LibraryLens;
  /** Called when the user selects a different lens */
  onLensChange: (lens: LibraryLens) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryLensSwitcher({
  lens,
  onLensChange,
  className,
}: LibraryLensSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Library lens"
      className={cn(
        "flex flex-wrap items-center gap-1",
        className,
      )}
    >
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Lens
      </span>
      {LENS_OPTIONS.map(({ value, label, help }) => {
        const isActive = lens === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            aria-label={help ? `${label} lens — ${help}` : `${label} lens`}
            title={help}
            onClick={() => onLensChange(value)}
            className={cn(
              "inline-flex h-6 min-h-[44px] items-center gap-1 rounded-sm px-2 text-[11px] font-medium transition-colors sm:min-h-0",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {label}
            {/* Inline visually-hidden help for orphans */}
            {help && (
              <span className="sr-only">{help}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
