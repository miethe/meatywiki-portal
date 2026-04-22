"use client";

/**
 * /workflows — Active Workflows Panel (P3-07 initial, P4-08 enhanced).
 *
 * Full-variant WorkflowStatusPanel showing:
 *   - Active runs (pending | running) at top with SSE live updates
 *   - Recent runs (last 7 days, any terminal status) below
 *   - Collapsible sections, inline expand, click-through to run detail
 *   - Loading/error/empty states
 *
 * The page owns useWorkflowRuns so it can also drive the WorkflowTopBarIndicator
 * from the same data — no double fetch.
 *
 * DP3-04 §2.5: cosmetic + contract fixes applied.
 *   #1 Subtitle tone: concise status copy.
 *   #4 Card border shade: delegated to WorkflowStatusPanel (border-blue-300/800).
 *   #5 Stage Tracker: timeline variant in run rows (not progress bar).
 *   SSE pool cleanup on route leave (Stage Tracker manifest §2.4).
 *
 * Stitch reference: "Workflows Dashboard" (ID: 4f203d7cc78b4229b71c017c15c055cb)
 * Shell: Standard Archival (per audit §3.2 row 10)
 */

import { useEffect } from "react";
import { useWorkflowRuns } from "@/hooks/useWorkflowRuns";
import { WorkflowStatusPanel } from "@/components/workflow/workflow-status-panel";
import { InitiationWizardDialog } from "@/components/workflow/initiation-wizard";
import { ssePool } from "@/lib/sse/pool";
import { cn } from "@/lib/utils";

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

export default function WorkflowsPage() {
  const workflowHook = useWorkflowRuns();
  const { activeCount, isLoading, refetch } = workflowHook;

  // Stage Tracker manifest §2.4: close all pool connections on route leave.
  useEffect(() => {
    return () => {
      ssePool.closeAll();
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          {/* DP3-04 §2.5#1: subtitle tone — concise status copy. */}
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? "Loading…"
              : activeCount > 0
              ? `${activeCount} active run${activeCount === 1 ? "" : "s"}`
              : "No active runs"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <InitiationWizardDialog />

          {/* Manual refresh */}
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isLoading}
            aria-label="Refresh workflow list"
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-3 text-xs font-medium sm:h-8 sm:min-h-0",
              "border border-input bg-background text-foreground",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
              isLoading && "animate-pulse",
            )}
          >
            <RefreshIcon />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main panel */}
      <WorkflowStatusPanel
        variant="full"
        controlled={workflowHook}
      />
    </div>
  );
}
