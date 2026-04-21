"use client";

/**
 * SynthesisScopeRailPanel — scope rail sub-panel for the Synthesis Builder wizard.
 *
 * Used on both Step 1 (select-scope) and Step 2 (configure) to display the
 * current scope context in the ContextRail right column.
 *
 * ADR-DPI-005 §6: "Scope rail on both steps reuses the ContextRail primitive
 * introduced by ADR-DPI-002 — surface-specific SynthesisScopeRailPanel sub-panel."
 *
 * Renders:
 *   - Selected artifact count + IDs (Step 1 and 2)
 *   - Optional glob scope path (Step 2)
 *   - Optional focus hint (Step 2)
 *
 * Backend: no dedicated scope-summary endpoint exists. Panel is derived
 * from wizard state passed as props — no HTTP call needed.
 *
 * Tasks: DP4-02d
 */

import { CheckCircle2, FileSearch, Target, FolderSearch } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SynthesisScopeRailPanelProps {
  /** Currently selected artifact IDs. */
  selectedIds: string[];
  /** Optional glob/path scope (Step 2). */
  scope?: string;
  /** Optional focus hint (Step 2). */
  focus?: string;
  /** Optional synthesis type label (Step 2). */
  synthesisType?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Small display helpers
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] italic text-muted-foreground">{children}</p>
  );
}

// ---------------------------------------------------------------------------
// SynthesisScopeRailPanel
// ---------------------------------------------------------------------------

export function SynthesisScopeRailPanel({
  selectedIds,
  scope,
  focus,
  synthesisType,
  className,
}: SynthesisScopeRailPanelProps) {
  return (
    <div
      aria-label="Synthesis scope summary"
      className={cn("flex flex-col gap-4 text-xs", className)}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Selected artifacts                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="scope-rail-artifacts-heading">
        <div className="mb-2 flex items-center gap-1.5">
          <FileSearch aria-hidden="true" className="size-3.5 text-muted-foreground" />
          <SectionHeading>
            <span id="scope-rail-artifacts-heading">
              Sources ({selectedIds.length})
            </span>
          </SectionHeading>
        </div>

        {selectedIds.length === 0 ? (
          <EmptyHint>No artifacts selected yet.</EmptyHint>
        ) : (
          <ul
            role="list"
            aria-label="Selected source artifacts"
            className="flex flex-col gap-1"
          >
            {selectedIds.map((id) => (
              <li
                key={id}
                className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5"
              >
                <CheckCircle2
                  aria-hidden="true"
                  className="size-3 shrink-0 text-emerald-500"
                />
                <span className="truncate font-mono text-[10px] text-foreground/80">
                  {id}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Synthesis type (Step 2 only)                                        */}
      {/* ------------------------------------------------------------------ */}
      {synthesisType && (
        <section aria-labelledby="scope-rail-type-heading">
          <div className="mb-2 flex items-center gap-1.5">
            <Target aria-hidden="true" className="size-3.5 text-muted-foreground" />
            <SectionHeading>
              <span id="scope-rail-type-heading">Type</span>
            </SectionHeading>
          </div>
          <span className="inline-flex items-center rounded-md border bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {synthesisType}
          </span>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Scope + focus (Step 2 only)                                         */}
      {/* ------------------------------------------------------------------ */}
      {(scope || focus) && (
        <section aria-labelledby="scope-rail-params-heading">
          <div className="mb-2 flex items-center gap-1.5">
            <FolderSearch
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
            <SectionHeading>
              <span id="scope-rail-params-heading">Parameters</span>
            </SectionHeading>
          </div>
          <dl className="flex flex-col gap-2">
            {scope && (
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Scope
                </dt>
                <dd className="mt-0.5 break-all font-mono text-[10px] text-foreground/80">
                  {scope}
                </dd>
              </div>
            )}
            {focus && (
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Focus
                </dt>
                <dd className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {focus}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Empty Step 2 placeholder                                            */}
      {/* ------------------------------------------------------------------ */}
      {!synthesisType && !scope && !focus && selectedIds.length === 0 && (
        <p className="text-[11px] italic text-muted-foreground">
          Select source artifacts in Step 1 to populate this panel.
        </p>
      )}
    </div>
  );
}
