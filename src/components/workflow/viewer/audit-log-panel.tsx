"use client";

/**
 * AuditLogPanel — compact display of operator audit log entries (P7-03).
 *
 * Surfaces entries from GET /api/workflows/:run_id/audit-log.
 * Degraded gracefully: if the endpoint is unavailable, the panel is hidden.
 *
 * Shown below the OperatorActionsBlock inside the main left column.
 *
 * P7-03 — Screen B operator actions.
 */

import { useCallback, useEffect, useReducer } from "react";
import { cn } from "@/lib/utils";
import { fetchAuditLog } from "@/lib/api/workflow-viewer";
import type { AuditLogEntry } from "@/lib/api/workflow-viewer";

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Action pill colours
// ---------------------------------------------------------------------------

const ACTION_STYLES: Record<string, string> = {
  pause: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  resume: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancel: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function actionStyle(action: string): string {
  return (
    ACTION_STYLES[action] ?? "bg-muted text-muted-foreground"
  );
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface AuditState {
  entries: AuditLogEntry[];
  isLoading: boolean;
}

type AuditAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; entries: AuditLogEntry[] };

function reducer(state: AuditState, action: AuditAction): AuditState {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, isLoading: true };
    case "FETCH_SUCCESS":
      return { isLoading: false, entries: action.entries };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook (internal)
// ---------------------------------------------------------------------------

function useAuditLog(runId: string, refreshKey: number) {
  const [state, dispatch] = useReducer(reducer, { entries: [], isLoading: false });

  const load = useCallback(async () => {
    dispatch({ type: "FETCH_START" });
    const entries = await fetchAuditLog(runId);
    dispatch({ type: "FETCH_SUCCESS", entries });
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return state;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AuditLogPanelProps {
  runId: string;
  /** Increment to trigger a refetch (driven by OperatorActionsBlock onAction). */
  refreshKey: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogPanel({ runId, refreshKey, className }: AuditLogPanelProps) {
  const { entries, isLoading } = useAuditLog(runId, refreshKey);

  // Don't render the panel at all while loading if we have no entries yet
  // (avoids layout flash on initial mount when audit log is unsupported).
  if (!isLoading && entries.length === 0) return null;

  return (
    <section
      aria-label="Recent operator actions"
      className={cn("rounded-xl border border-border bg-card p-4", className)}
      data-testid="audit-log-panel"
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Recent Operator Actions
      </h3>

      {isLoading && entries.length === 0 ? (
        <div aria-busy="true" aria-label="Loading audit log" className="space-y-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="h-4 w-14 rounded-full bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
              <div className="ml-auto h-3 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <ol aria-label="Audit log entries" className="space-y-1.5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 text-xs"
              data-testid="audit-log-entry"
            >
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 font-medium capitalize",
                  actionStyle(entry.action),
                )}
              >
                {entry.action}
              </span>
              {entry.actor && (
                <span className="text-muted-foreground">
                  by <span className="font-medium text-foreground">{entry.actor}</span>
                </span>
              )}
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                {relativeTime(entry.created_at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
