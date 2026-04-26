"use client";

/**
 * WorkflowOSTab — content for the "Workflow OS" tab on the Artifact Detail page.
 *
 * P4-10 + DP3-02 scope:
 *   1. Lens Badge Set     — current frontmatter values (read-only, detail variant).
 *                           Tab-level lens context anchor; renders regardless of run history.
 *   2. Handoff Chain      — artifact lineage timeline (DP3-02 contract integration).
 *                           Primary content; full variant per manifest §3.2.
 *                           Data: GET /api/artifacts/:id/synthesis-lineage via
 *                           useLineage (P3-10); artifact_edges as offline fallback.
 *   3. Stage Tracker      — compact view of the most recent workflow run.
 *   4. Run History        — table of all runs associated with this artifact.
 *      Columns: run_id | template_id | status | completed_at.
 *      Row click → navigates to /workflows/:run_id (SSE stream surface from P3-07).
 *   5. Quality Gate       — summary of lint findings (optional; best-effort).
 *
 * Lazy-loading: data is fetched only when the tab is activated (enabled prop).
 *
 * Backend note (P4-10): GET /api/workflows/runs does not currently accept an
 * artifact_id query param. This component fetches all runs (client-side
 * filter fallback) via useArtifactWorkflowRuns. When the backend adds the
 * artifact_id param, update useArtifactWorkflowRuns to pass it server-side.
 *
 * WCAG 2.1 AA: table has caption + column headers; status badges carry
 * aria-labels; loading state uses role="status"; empty state uses role="status".
 *
 * Stitch reference: "Research Artifact - Workflow OS Enhanced"
 *   (ID: ee5b9ed70061402c99b091998f9002d8)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, GitMerge } from "lucide-react";
import { cn } from "@/lib/utils";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import { StageTracker } from "@/components/workflow/stage-tracker";
import { HandoffChain } from "@/components/artifact/HandoffChain";
import { useArtifactWorkflowRuns } from "@/hooks/useArtifactWorkflowRuns";
import { useLineage } from "@/hooks/useLineage";
import type { SynthesisLineageNode } from "@/lib/api/research";
import type { ArtifactDetail, WorkflowRun, WorkflowRunStatus } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WorkflowOSTabProps {
  artifact: ArtifactDetail;
  /**
   * When false the data fetch is deferred (lazy load).
   * Parent sets this to `true` only when the Workflow OS tab is active.
   */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Status badge colours
// ---------------------------------------------------------------------------

const STATUS_COLOURS: Record<WorkflowRunStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  paused: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  abandoned: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function StatusBadge({ status }: { status: WorkflowRunStatus }) {
  return (
    <span
      aria-label={`Status: ${status}`}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_COLOURS[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Date formatter
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`wf-section-${title.replace(/\s+/g, "-").toLowerCase()}`} className={className}>
      <h3
        id={`wf-section-${title.replace(/\s+/g, "-").toLowerCase()}`}
        className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 1. Lens Badge Set (read-only, detail variant)
// ---------------------------------------------------------------------------

function LensSection({ artifact }: { artifact: ArtifactDetail }) {
  const hasLens = !!(
    artifact.metadata?.fidelity ||
    artifact.metadata?.freshness ||
    artifact.metadata?.verification_state ||
    artifact.metadata?.reusability_tier ||
    artifact.metadata?.sensitivity_profile
  );

  return (
    <Section title="Lens Dimensions">
      {hasLens ? (
        <LensBadgeSet artifact={artifact} variant="detail" />
      ) : (
        <p
          role="status"
          className="text-xs text-muted-foreground"
        >
          No lens metadata recorded for this artifact yet.
        </p>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 2. Stage Tracker — most recent run (compact)
// ---------------------------------------------------------------------------

function StageSection({ run }: { run: WorkflowRun | undefined }) {
  if (!run) {
    return (
      <Section title="Latest Run Stage">
        <p role="status" className="text-xs text-muted-foreground">
          No workflow runs yet.
        </p>
      </Section>
    );
  }

  return (
    <Section title="Latest Run Stage">
      <div className="rounded-md border bg-muted/20 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {run.id}
          </span>
          <StatusBadge status={run.status} />
        </div>
        <StageTracker
          runId={run.id}
          templateId={run.template_id}
          status={run.status}
          currentStage={run.current_stage}
          variant="compact"
        />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 3. Run History — table
// ---------------------------------------------------------------------------

interface RunHistoryProps {
  runs: WorkflowRun[];
  onRowClick: (runId: string) => void;
}

function RunHistory({ runs, onRowClick }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <Section title="Run History">
        <div
          role="status"
          className="rounded-md border border-dashed py-8 text-center"
        >
          <p className="text-sm text-muted-foreground">No workflow runs yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Runs that produce or modify this artifact will appear here.
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Run History">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm" aria-label="Workflow run history">
          <caption className="sr-only">Workflow runs associated with this artifact</caption>
          <thead>
            <tr className="border-b bg-muted/40">
              <th
                scope="col"
                className="py-2 pl-3 pr-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Run ID
              </th>
              <th
                scope="col"
                className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Template
              </th>
              <th
                scope="col"
                className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-2 py-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Completed
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((run) => (
              <tr
                key={run.id}
                role="row"
                tabIndex={0}
                aria-label={`Run ${run.id} — ${run.status}`}
                className={cn(
                  "cursor-pointer transition-colors",
                  "hover:bg-accent/60 focus:outline-none focus-visible:bg-accent/60",
                  "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                )}
                onClick={() => onRowClick(run.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(run.id);
                  }
                }}
              >
                <td className="py-2 pl-3 pr-2">
                  <span className="truncate font-mono text-[11px] text-foreground/70">
                    {run.id}
                  </span>
                </td>
                <td className="px-2 py-2 text-xs text-foreground/80">
                  {run.template_id}
                </td>
                <td className="px-2 py-2">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-2 py-2 pr-3 text-xs text-muted-foreground tabular-nums">
                  {fmtDate(run.completed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 4. Quality Gate Indicator (compact, best-effort)
//    Derived from frontmatter_jsonb lint fields if present; no extra API call.
// ---------------------------------------------------------------------------

function QualityGate({ artifact }: { artifact: ArtifactDetail }) {
  const fm = artifact.frontmatter_jsonb;

  // Extract lint-related fields from frontmatter snapshot.
  const lintStatus = fm?.["lint_status"] as string | undefined;
  const lintErrors = fm?.["lint_errors"] as number | undefined;
  const lintWarnings = fm?.["lint_warnings"] as number | undefined;

  if (!lintStatus && lintErrors === undefined && lintWarnings === undefined) {
    // No lint data — skip the section entirely to keep the tab uncluttered.
    return null;
  }

  const hasIssues = (lintErrors ?? 0) > 0 || lintStatus === "failed";

  return (
    <Section title="Quality Gate">
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border px-3 py-2",
          hasIssues
            ? "border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20"
            : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full",
            hasIssues ? "bg-red-500" : "bg-emerald-500",
          )}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
          {lintStatus && (
            <span>
              Status:{" "}
              <strong
                className={hasIssues ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}
              >
                {lintStatus}
              </strong>
            </span>
          )}
          {lintErrors !== undefined && (
            <span>
              Errors: <strong className={lintErrors > 0 ? "text-red-700 dark:text-red-400" : ""}>{lintErrors}</strong>
            </span>
          )}
          {lintWarnings !== undefined && (
            <span>
              Warnings:{" "}
              <strong className={lintWarnings > 0 ? "text-yellow-700 dark:text-yellow-400" : ""}>{lintWarnings}</strong>
            </span>
          )}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 3a. Handoff Chain timeline — primary content of the OS tab (DP3-02)
//
// Per manifest §3.2 (portal-v1.5-handoff-chain-integration.md), the full
// Handoff Chain timeline is the primary content of this tab, placed below
// Lens Dimensions and above Run History.
//
// Data source: GET /api/artifacts/:id/synthesis-lineage via useLineage (P3-10).
// Falls back to artifact.artifact_edges when the API returns no data (e.g.
// artifact not yet reconciled into the overlay) so existing edges are never
// lost. Edge-only fallback uses <HandoffChain> (no run interleaving);
// API response renders the full lineage tree.
// ---------------------------------------------------------------------------

/**
 * Recursive lineage node renderer — mirrors ResearchLineagePanel in ContextRail.
 * Renders a collapsible sub-tree with expand/collapse toggle on nodes that
 * have children. Edge type badge is omitted on the root node.
 */
function LineageNode({
  node,
  isRoot = false,
}: {
  node: SynthesisLineageNode;
  isRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const edgeLabel = node.edge_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <li
      className={cn(
        "flex flex-col gap-0.5",
        !isRoot && "pl-3 border-l border-muted",
      )}
    >
      {/* Node row */}
      <div className="flex items-start gap-1.5">
        {/* Expand toggle */}
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse children" : "Expand children"}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
              "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            <span aria-hidden="true" className="text-[10px] leading-none">
              {expanded ? "▾" : "▸"}
            </span>
          </button>
        ) : (
          /* Spacer — keeps leaf nodes aligned with expandable nodes */
          <span aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        )}

        {/* Content */}
        <div className="flex min-w-0 flex-col gap-0.5">
          {/* Edge type badge — omit on root */}
          {!isRoot && (
            <span className="inline-flex w-fit items-center rounded-sm bg-sky-100 px-1.5 py-0.5 text-[9px] font-medium leading-tight text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
              {edgeLabel}
            </span>
          )}
          <Link
            href={`/artifact/${node.artifact_id}`}
            className={cn(
              "truncate text-[11px] font-medium leading-snug text-foreground",
              "hover:underline underline-offset-2",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
              isRoot && "text-xs",
            )}
          >
            {node.title || node.artifact_id}
          </Link>
          <span className="text-[10px] capitalize text-muted-foreground/70">
            {node.artifact_type}
          </span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <ul
          role="list"
          aria-label={`Children of ${node.title || node.artifact_id}`}
          className="mt-1 flex flex-col gap-1"
        >
          {node.children.map((child) => (
            <LineageNode
              key={`${child.artifact_id}-${child.edge_type}-${child.depth}`}
              node={child}
            />
          ))}
        </ul>
      )}

      {/* Sibling overflow hint */}
      {node.next_sibling_cursor && (
        <p className="mt-0.5 pl-5 text-[10px] italic text-muted-foreground/60">
          More siblings not shown
        </p>
      )}
    </li>
  );
}

/**
 * Loading skeleton for the lineage section — indented rows mimic a tree.
 */
function LineageSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading lineage"
      className="flex flex-col gap-2"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex animate-pulse items-center gap-1.5 px-1"
        >
          <div
            className="size-4 shrink-0 rounded-sm bg-muted"
            style={{ marginLeft: `${(i % 3) * 12}px` }}
          />
          <div
            className="h-3 flex-1 rounded bg-muted"
            style={{ maxWidth: `${70 - i * 8}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function HandoffChainSection({ artifact }: { artifact: ArtifactDetail }) {
  const { data, isLoading, isError, error, refetch } = useLineage(artifact.id);

  // ---- Loading ----
  if (isLoading) {
    return (
      <Section title="Lineage">
        <LineageSkeleton />
      </Section>
    );
  }

  // ---- Error ----
  if (isError && error) {
    // Graceful degradation: fall back to artifact_edges on error so existing
    // edge data is not lost.
    const fallbackEdges = artifact.artifact_edges;
    const hasFallback = Array.isArray(fallbackEdges) && fallbackEdges.length > 0;

    return (
      <Section title="Lineage">
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
        >
          <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />
          <p className="text-[11px] text-muted-foreground">
            Unable to load lineage from API.{hasFallback ? " Showing cached edges." : ""}
          </p>
          <button
            type="button"
            onClick={refetch}
            className={cn(
              "ml-auto inline-flex h-6 items-center rounded border border-destructive/40 px-2 text-[10px] text-destructive",
              "hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            Retry
          </button>
        </div>
        {hasFallback ? (
          <HandoffChain
            currentArtifactId={artifact.id}
            edges={fallbackEdges}
            className="rounded-md border bg-muted/20 p-3"
          />
        ) : (
          <p className="text-[11px] text-muted-foreground">{error.message}</p>
        )}
      </Section>
    );
  }

  // ---- API responded: artifact found and has a lineage root ----
  if (data?.found && data.root) {
    const root = data.root;
    const hasChildren = root.children.length > 0;

    return (
      <Section title="Lineage">
        <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
          <ul role="tree" aria-label="Synthesis lineage tree" className="flex flex-col gap-1">
            <LineageNode node={root} isRoot />
          </ul>

          {!hasChildren && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              No child artifacts derived from this one yet.
            </p>
          )}

          {/* Diagnostic footer */}
          <p className="mt-1 text-[10px] text-muted-foreground/50">
            Depth {data.depth} &middot; {data.raw_edge_count} edge
            {data.raw_edge_count !== 1 ? "s" : ""} traversed
          </p>
        </div>
      </Section>
    );
  }

  // ---- API responded: artifact not in overlay yet — try artifact_edges fallback ----
  const fallbackEdges = artifact.artifact_edges;
  const hasFallback = Array.isArray(fallbackEdges) && fallbackEdges.length > 0;

  if (hasFallback) {
    return (
      <Section title="Lineage">
        <HandoffChain
          currentArtifactId={artifact.id}
          edges={fallbackEdges}
          className="rounded-md border bg-muted/20 p-3"
        />
      </Section>
    );
  }

  // ---- Empty state ----
  return (
    <Section title="Lineage">
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-8 text-center"
      >
        <GitMerge
          aria-hidden="true"
          className="size-6 text-muted-foreground/40"
        />
        <div>
          <p className="text-sm text-muted-foreground">No lineage data</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Lineage appears after the artifact is compiled and reconciled into
            the overlay.
          </p>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function TabSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading workflow data" className="flex flex-col gap-6 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="flex gap-1.5">
        <div className="h-5 w-16 rounded-sm bg-muted" />
        <div className="h-5 w-14 rounded-sm bg-muted" />
        <div className="h-5 w-18 rounded-sm bg-muted" />
      </div>
      <div className="h-3 w-28 rounded bg-muted" />
      <div className="h-16 rounded-md bg-muted" />
      <div className="h-3 w-20 rounded bg-muted" />
      <div className="h-32 rounded-md bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function TabError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
    >
      <p className="text-sm font-semibold text-destructive">Failed to load workflow data</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "mt-4 inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function WorkflowOSTab({ artifact, enabled }: WorkflowOSTabProps) {
  const router = useRouter();
  const { runs, isLoading, error, refetch } = useArtifactWorkflowRuns(artifact.id, enabled);

  // Only show loading skeleton while the first fetch is in-flight.
  if (isLoading) {
    return <TabSkeleton />;
  }

  if (error) {
    return <TabError message={error} onRetry={refetch} />;
  }

  // Most recent run = first in the list (backend returns newest-first by started_at).
  const latestRun = runs.length > 0 ? runs[0] : undefined;

  const handleRowClick = (runId: string) => {
    router.push(`/workflows/${runId}`);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Lens Badge Set — anchored at top, tab-level lens context anchor */}
      {/* DP3-02: badge stays populated from frontmatter regardless of run   */}
      {/* history; renders "no signal" state when all lens fields are null.  */}
      <LensSection artifact={artifact} />

      {/* Divider */}
      <hr className="border-border" />

      {/* 2. Handoff Chain timeline — primary content (DP3-02 manifest §3.2) */}
      {/* Data: synthesis-lineage API (P3-10); artifact_edges as fallback.   */}
      <HandoffChainSection artifact={artifact} />

      {/* Divider */}
      <hr className="border-border" />

      {/* 3. Stage Tracker — latest run */}
      <StageSection run={latestRun} />

      {/* Divider */}
      <hr className="border-border" />

      {/* 4. Run History */}
      <RunHistory runs={runs} onRowClick={handleRowClick} />

      {/* 5. Quality Gate (conditional — only rendered when lint data exists) */}
      <QualityGate artifact={artifact} />
    </div>
  );
}
