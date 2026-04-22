/**
 * Synthesis Builder landing — redirects to the 2-step wizard (Step 1).
 *
 * ADR-DPI-005 Option A: the wizard ships in v1.5 with a 2-step flow:
 *   Step 1: /research/synthesis/select-scope  — artifact picker + scope rail
 *   Step 2: /research/synthesis/configure     — type bento + param panel + scope rail
 *
 * This page acts as a landing / entry point for the /research/synthesis route.
 * It renders wizard entry UI (intro text + "Start synthesis" CTA) rather than
 * a hard redirect so the URL is bookmarkable and the sub-nav tab stays active.
 *
 * The legacy SynthesisBuilder form (single-page, P4-02 original) remains at
 * /research/synthesis/legacy for backward compatibility. It may be removed in v1.6.
 *
 * Stitch reference: "Synthesis Builder" (P4-02 / DP4-02d scope)
 * ADR: ADR-DPI-005
 * Tasks: DP4-02d
 */

import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";

export default function SynthesisPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Synthesis Builder
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Synthesize multiple research sources into a compiled artifact using the{" "}
          <code className="font-mono text-xs">research_synthesis_v1</code>{" "}
          workflow.
        </p>
      </div>

      {/* Wizard entry card */}
      <div className="flex max-w-xl flex-col gap-4 rounded-lg border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Layers aria-hidden="true" className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              2-step wizard (v1.5)
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Select source artifacts, choose a synthesis type, and tune
              depth, tone, and constraints before launching.
            </p>
          </div>
        </div>

        <ol className="flex flex-col gap-2 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
              1
            </span>
            Select source artifacts — filter, sort, and multi-select from your vault
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
              2
            </span>
            Configure — synthesis type, depth, tone, and constraints
          </li>
        </ol>

        <Link
          href="/research/synthesis/select-scope"
          className="self-start inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Start synthesis
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      {/* Legacy fallback link */}
      <p className="text-xs text-muted-foreground">
        Looking for the simple form?{" "}
        <Link
          href="/research/synthesis/legacy"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Use the legacy single-step builder
        </Link>
        .
      </p>
    </div>
  );
}
