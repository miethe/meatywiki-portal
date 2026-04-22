/**
 * Legacy Synthesis Builder — the original single-step form (P4-02).
 *
 * Preserved at /research/synthesis/legacy for users who prefer the
 * minimal one-page flow. May be removed in v1.6 once the 2-step wizard
 * (ADR-DPI-005) proves stable.
 *
 * Route: /research/synthesis/legacy
 * Tasks: DP4-02d (backward compat preservation)
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SynthesisBuilder } from "@/components/research/synthesis-builder";

export default function SynthesisLegacyPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/research/synthesis"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-3" />
          Back to Synthesis Builder
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Synthesis Builder
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            Legacy form
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Single-step form — enter source IDs directly. Use the{" "}
          <Link
            href="/research/synthesis/select-scope"
            className="underline underline-offset-2 hover:text-foreground"
          >
            2-step wizard
          </Link>{" "}
          for the full synthesis type + parameter controls.
        </p>
      </div>

      <SynthesisBuilder />
    </div>
  );
}
