"use client";

/**
 * WizardStepper — visual step indicator for the 3-step Initiation Wizard.
 *
 * Renders a horizontal step track with numbered circles and labels.
 * Matches the Stitch layout from workflow-initiation-step-*.html:
 *   Step 1: Intake / Source
 *   Step 2: Routing / Analysis
 *   Step 3: Configure & Launch
 *
 * Accessibility: aria-current="step" on the active step, completed steps
 * carry aria-label="Completed".
 */

import { cn } from "@/lib/utils";

export type WizardStep = 1 | 2 | 3;

const STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Source" },
  { step: 2, label: "Routing" },
  { step: 3, label: "Configure" },
];

interface WizardStepperProps {
  currentStep: WizardStep;
}

export function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <nav aria-label="Wizard steps" className="flex items-center justify-center">
      {STEPS.map(({ step, label }, idx) => {
        const isComplete = step < currentStep;
        const isActive = step === currentStep;

        return (
          <div key={step} className="flex items-center">
            {/* Connector line (before step, skip first) */}
            {idx > 0 && (
              <div
                aria-hidden="true"
                className={cn(
                  "mx-3 h-px w-12 shrink-0 transition-colors duration-300",
                  isComplete || isActive
                    ? "bg-foreground/30"
                    : "bg-border",
                )}
              />
            )}

            {/* Step indicator */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                aria-current={isActive ? "step" : undefined}
                aria-label={
                  isComplete
                    ? `${label} — Completed`
                    : isActive
                    ? `${label} — Current step`
                    : `${label} — Not yet reached`
                }
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-xs font-bold font-mono transition-all duration-300",
                  isComplete &&
                    "bg-foreground text-background ring-2 ring-offset-2 ring-offset-background ring-foreground/20",
                  isActive &&
                    "bg-foreground text-background ring-4 ring-offset-2 ring-offset-background ring-foreground/10",
                  !isComplete && !isActive && "bg-muted text-muted-foreground",
                )}
              >
                {isComplete ? (
                  <svg
                    aria-hidden="true"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <span>{String(step).padStart(2, "0")}</span>
                )}
              </div>

              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-widest transition-colors duration-300",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
