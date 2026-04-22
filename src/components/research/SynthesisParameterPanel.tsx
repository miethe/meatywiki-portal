"use client";

/**
 * SynthesisParameterPanel — depth / tone / constraints knob panel for
 * Step 2 of the Synthesis Builder 2-step wizard (ADR-DPI-005 Option A).
 *
 * Parameters:
 *   depth       — enum: brief | standard | deep | exhaustive
 *   tone        — enum: neutral | academic | conversational | critical
 *   constraints — free-text; forwarded verbatim to the engine
 *   scope       — glob/path scope (optional; from Step 1 if filled)
 *   focus       — free-text focus hint (optional; from Step 1 if filled)
 *
 * ## Endpoint gap
 *
 * The backend POST /api/workflows/synthesize currently accepts only
 * `sources`, `scope`, and `focus`. The `type`, `depth`, `tone`, and
 * `constraints` fields are not yet consumed by the synthesis workflow
 * template (`research_synthesis_v1`).
 *
 * Interim: `depth`, `tone`, and `constraints` are shown with a
 * "parameters pending backend support" tooltip. They are still collected
 * in the wizard state and will be forwarded once the backend DTO is
 * expanded (ADR-DPI-005 §3 backend note).
 *
 * ADR: ADR-DPI-005
 * Tasks: DP4-02d
 */

import { useId } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SynthesisDepth = "brief" | "standard" | "deep" | "exhaustive";
export type SynthesisTone = "neutral" | "academic" | "conversational" | "critical";

export interface SynthesisParameters {
  depth: SynthesisDepth;
  tone: SynthesisTone;
  /** Free-text constraints forwarded to the engine prompt. */
  constraints: string;
  /** Optional glob scope. */
  scope: string;
  /** Optional focus hint. */
  focus: string;
}

export interface SynthesisParameterPanelProps {
  value: SynthesisParameters;
  onChange: (next: Partial<SynthesisParameters>) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Small reusable field label
// ---------------------------------------------------------------------------

function FieldLabel({
  htmlFor,
  children,
  tooltip,
}: {
  htmlFor: string;
  children: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-foreground"
      >
        {children}
      </label>
      {tooltip && (
        <span
          role="img"
          aria-label={tooltip}
          title={tooltip}
          className="inline-flex cursor-help"
        >
          <Info className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

function FieldHint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-[11px] text-muted-foreground">
      {children}
    </p>
  );
}

// Shared tooltip copy
const BACKEND_PENDING_TOOLTIP =
  "Collected by the wizard but not yet consumed by the research_synthesis_v1 " +
  "workflow template. Will be forwarded once the backend DTO is expanded (ADR-DPI-005).";

// ---------------------------------------------------------------------------
// SynthesisParameterPanel
// ---------------------------------------------------------------------------

export function SynthesisParameterPanel({
  value,
  onChange,
  className,
}: SynthesisParameterPanelProps) {
  const depthId = useId();
  const toneId = useId();
  const constraintsId = useId();
  const scopeId = useId();
  const focusId = useId();

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* ------------------------------------------------------------------ */}
      {/* Backend-pending banner                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        role="note"
        aria-label="Parameter support status"
        className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
      >
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <strong>Depth, tone, and constraints</strong> are collected here but
          are not yet consumed by the{" "}
          <code className="font-mono text-[10px]">research_synthesis_v1</code>{" "}
          workflow template. They will be forwarded once the backend DTO is
          expanded (ADR-DPI-005).
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Depth                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel
          htmlFor={depthId}
          tooltip={BACKEND_PENDING_TOOLTIP}
        >
          Depth
        </FieldLabel>
        <div
          role="group"
          aria-labelledby={`${depthId}-label`}
          className="flex flex-wrap gap-2"
        >
          {(["brief", "standard", "deep", "exhaustive"] as SynthesisDepth[]).map(
            (option) => {
              const isSelected = value.depth === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChange({ depth: option })}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium capitalize transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {option}
                </button>
              );
            },
          )}
        </div>
        <FieldHint id={`${depthId}-hint`}>
          Controls response length and detail level. Brief ≈ 1 paragraph;
          exhaustive ≈ full report.
        </FieldHint>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tone                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel
          htmlFor={toneId}
          tooltip={BACKEND_PENDING_TOOLTIP}
        >
          Tone
        </FieldLabel>
        <div
          role="group"
          aria-labelledby={`${toneId}-label`}
          className="flex flex-wrap gap-2"
        >
          {(["neutral", "academic", "conversational", "critical"] as SynthesisTone[]).map(
            (option) => {
              const isSelected = value.tone === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChange({ tone: option })}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium capitalize transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {option}
                </button>
              );
            },
          )}
        </div>
        <FieldHint id={`${toneId}-hint`}>
          Shapes the writing style: neutral is balanced; critical applies
          adversarial scrutiny.
        </FieldHint>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Constraints                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel
          htmlFor={constraintsId}
          tooltip={BACKEND_PENDING_TOOLTIP}
        >
          Constraints
        </FieldLabel>
        <textarea
          id={constraintsId}
          rows={3}
          value={value.constraints}
          onChange={(e) => onChange({ constraints: e.target.value })}
          aria-describedby={`${constraintsId}-hint`}
          placeholder="e.g. do not cite sources older than 2022; limit to 3 recommendations"
          className={cn(
            "w-full resize-y rounded-md border border-input bg-background px-3 py-2",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />
        <FieldHint id={`${constraintsId}-hint`}>
          Optional free-text constraints forwarded verbatim to the synthesis
          prompt. Use plain language instructions.
        </FieldHint>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Scope                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={scopeId}>Scope</FieldLabel>
        <input
          id={scopeId}
          type="text"
          value={value.scope}
          onChange={(e) => onChange({ scope: e.target.value })}
          aria-describedby={`${scopeId}-hint`}
          placeholder="wiki/concepts/** (optional)"
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />
        <FieldHint id={`${scopeId}-hint`}>
          Optional glob or directory path to scope the compile stage.
        </FieldHint>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Focus                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={focusId}>Focus</FieldLabel>
        <input
          id={focusId}
          type="text"
          value={value.focus}
          onChange={(e) => onChange({ focus: e.target.value })}
          aria-describedby={`${focusId}-hint`}
          placeholder="e.g. performance benchmarks (optional)"
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />
        <FieldHint id={`${focusId}-hint`}>
          Free-text hint to guide the synthesis — a specific question or
          research angle.
        </FieldHint>
      </div>
    </div>
  );
}
