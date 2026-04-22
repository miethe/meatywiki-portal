"use client";

/**
 * Synthesis Builder — Step 1: Select Scope
 *
 * Route: /research/synthesis/select-scope
 *
 * Part of the 2-step wizard (ADR-DPI-005 Option A). Wizard state is
 * URL-encoded for resumability:
 *   ?ids=ID1,ID2,...    — selected artifact IDs
 *
 * Layout:
 *   Left (main column): SynthesisArtifactPicker (filter/sort grid + textarea fallback)
 *   Right (lg+): ContextRail with SynthesisScopeRailPanel showing scope summary
 *
 * Navigation:
 *   "Continue →" → /research/synthesis/configure?ids=...
 *   "Cancel"    → /research/synthesis
 *
 * Tasks: DP4-02d
 * ADR: ADR-DPI-005
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SynthesisArtifactPicker } from "@/components/research/SynthesisArtifactPicker";
import { SynthesisScopeRailPanel } from "@/components/research/SynthesisScopeRailPanel";
import { ContextRail, type ContextRailTab } from "@/components/layout/ContextRail";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function encodeIds(ids: string[]): string {
  return ids.filter(Boolean).join(",");
}

function decodeIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Stepper indicator
// ---------------------------------------------------------------------------

function WizardStepper({ step }: { step: 1 | 2 }) {
  return (
    <nav aria-label="Synthesis wizard steps" className="flex items-center gap-2">
      {[
        { num: 1, label: "Select sources" },
        { num: 2, label: "Configure" },
      ].map(({ num, label }, index) => {
        const isActive = num === step;
        const isComplete = num < step;

        return (
          <div key={num} className="flex items-center gap-2">
            {index > 0 && (
              <div
                aria-hidden="true"
                className={cn(
                  "h-px w-8 shrink-0",
                  isComplete ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5",
              )}
            >
              <div
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {num}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SynthesisSelectScopePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Hydrate from URL (resumability)
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    decodeIds(searchParams.get("ids")),
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    setValidationError(null);
  }, []);

  // Sync URL as selection changes (URL-encoded wizard state for resumability)
  useEffect(() => {
    const encoded = encodeIds(selectedIds);
    const current = searchParams.get("ids") ?? "";
    if (encoded !== current) {
      const url = encoded
        ? `/research/synthesis/select-scope?ids=${encodeURIComponent(encoded)}`
        : "/research/synthesis/select-scope";
      router.replace(url, { scroll: false });
    }
  }, [selectedIds, router, searchParams]);

  const handleContinue = useCallback(() => {
    if (selectedIds.length === 0) {
      setValidationError("Please select at least one source artifact before continuing.");
      return;
    }
    const encoded = encodeURIComponent(encodeIds(selectedIds));
    router.push(`/research/synthesis/configure?ids=${encoded}`);
  }, [selectedIds, router]);

  const handleCancel = useCallback(() => {
    router.push("/research/synthesis");
  }, [router]);

  // ContextRail: custom tab — Scope summary
  const scopeTab: ContextRailTab = {
    id: "scope",
    label: "Scope",
    renderContent: () => (
      <SynthesisScopeRailPanel selectedIds={selectedIds} />
    ),
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Synthesis Builder
          </h1>
          <WizardStepper step={1} />
        </div>

        {/* Cancel */}
        <button
          type="button"
          aria-label="Cancel synthesis wizard"
          onClick={handleCancel}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-muted-foreground",
            "transition-colors hover:bg-accent hover:text-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <X aria-hidden="true" className="size-3.5" />
          Cancel
        </button>
      </div>

      {/* Two-column layout: picker + rail */}
      <div className="flex gap-6">
        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <h2 className="text-base font-medium text-foreground">
              Select source artifacts
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Choose the artifacts to include as inputs for the synthesis.
              You can filter, sort, and multi-select from the grid below,
              or enter artifact IDs directly.
            </p>
          </div>

          {validationError && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
            >
              {validationError}
            </div>
          )}

          <SynthesisArtifactPicker
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
          />

          {/* Step navigation */}
          <div className="flex items-center gap-3 border-t pt-4">
            <button
              type="button"
              onClick={handleContinue}
              aria-label="Continue to synthesis configuration (Step 2)"
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground",
                "transition-colors hover:bg-primary/90",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedIds.length === 0 && "opacity-60",
              )}
            >
              Continue
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              {selectedIds.length === 0
                ? "Select at least one artifact"
                : `${selectedIds.length} artifact${selectedIds.length === 1 ? "" : "s"} selected`}
            </span>
          </div>
        </div>

        {/* ContextRail — scope summary */}
        <aside
          aria-label="Scope context"
          className="hidden w-72 shrink-0 lg:block"
        >
          <ContextRail
            customTabs={[scopeTab]}
            ariaLabel="Synthesis scope"
          />
        </aside>
      </div>
    </div>
  );
}
