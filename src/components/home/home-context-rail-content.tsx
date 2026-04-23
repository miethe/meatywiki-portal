"use client";

/**
 * HomeContextRailContent — "Latest Syntheses" + "Recent Workflows" sections
 * for the App Home ContextRail.
 *
 * Design spec §4.5: ContextRail shows Latest Syntheses list + Recent Workflow
 * Runs list (dense, with timestamps).
 *
 * Data sources:
 *   - Latest Syntheses: listArtifacts({ type: "synthesis", limit: 5 })
 *   - Recent Workflows: useWorkflowRuns() (recentRuns slice, capped to 5)
 *
 * Both sections render graceful empty states on any API error.
 *
 * Created for Portal v1.5 Stitch Reskin Phase 6 (P6-01).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Workflow } from "lucide-react";
import { listArtifacts } from "@/lib/api/artifacts";
import { useWorkflowRuns } from "@/hooks/useWorkflowRuns";
import type { ArtifactCard as ArtifactCardType, WorkflowRun } from "@/types/artifact";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Latest Syntheses
// ---------------------------------------------------------------------------

function SynthesisEmptyState() {
  return (
    <p className="text-[11px] text-muted-foreground italic px-1">
      No syntheses yet.
    </p>
  );
}

function LatestSynthesesContent() {
  const [syntheses, setSyntheses] = useState<ArtifactCardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function doFetch() {
      setIsLoading(true);
      try {
        const envelope = await listArtifacts({ type: "synthesis", limit: 5 });
        if (!cancelled) {
          setSyntheses(envelope.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setSyntheses([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void doFetch();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading syntheses">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-4 rounded bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (syntheses.length === 0) {
    return <SynthesisEmptyState />;
  }

  return (
    <ul role="list" className="flex flex-col gap-1.5">
      {syntheses.map((s) => (
        <li key={s.id}>
          <Link
            href={`/artifact/${s.id}`}
            className={cn(
              "flex items-start justify-between gap-2 rounded px-1 py-1",
              "text-[11px] text-foreground hover:bg-accent/60 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span className="truncate leading-snug">{s.title}</span>
            {s.updated && (
              <time
                dateTime={s.updated}
                className="shrink-0 text-[10px] text-muted-foreground"
              >
                {formatRelativeTime(s.updated)}
              </time>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Recent Workflows
// ---------------------------------------------------------------------------

function WorkflowEmptyState() {
  return (
    <p className="text-[11px] text-muted-foreground italic px-1">
      No recent workflow runs.
    </p>
  );
}

interface RecentWorkflowsContentProps {
  recentRuns: WorkflowRun[];
  isLoading: boolean;
}

function RecentWorkflowsContent({ recentRuns, isLoading }: RecentWorkflowsContentProps) {
  const capped = recentRuns.slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading workflows">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="h-4 rounded bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (capped.length === 0) {
    return <WorkflowEmptyState />;
  }

  return (
    <ul role="list" className="flex flex-col gap-1.5">
      {capped.map((run) => (
        <li key={run.id}>
          <Link
            href={`/workflows/${run.id}`}
            className={cn(
              "flex items-start justify-between gap-2 rounded px-1 py-1",
              "text-[11px] text-foreground hover:bg-accent/60 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span className="truncate leading-snug">
              {run.template_id ?? run.id}
            </span>
            {run.completed_at && (
              <time
                dateTime={run.completed_at}
                className="shrink-0 text-[10px] text-muted-foreground"
              >
                {formatRelativeTime(run.completed_at)}
              </time>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Public exports — used as ContextRail section content nodes in home/page.tsx
// ---------------------------------------------------------------------------

/**
 * Latest Syntheses section for the App Home ContextRail.
 * Fetches up to 5 synthesis artifacts and renders a dense link list.
 */
export function HomeLatestSyntheses() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 mb-1">
        <BookOpen aria-hidden="true" className="size-3 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Latest Syntheses
        </span>
      </div>
      <LatestSynthesesContent />
    </div>
  );
}

/**
 * Recent Workflows section for the App Home ContextRail.
 * Shows up to 5 recent workflow runs with relative timestamps.
 */
export function HomeRecentWorkflows() {
  const { recentRuns, isLoading } = useWorkflowRuns();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Workflow aria-hidden="true" className="size-3 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Workflows
        </span>
      </div>
      <RecentWorkflowsContent recentRuns={recentRuns} isLoading={isLoading} />
    </div>
  );
}
