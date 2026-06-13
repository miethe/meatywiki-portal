"use client";

/**
 * Intents list page — Task B2.
 *
 * Displays the full list of intent artifacts, grouped loosely by layer.
 * Each row navigates to /artifact/{id} (the shared artifact detail route).
 *
 * API:
 *   GET /api/intents -> ServiceModeEnvelope<IntentDTO>
 *
 * Design decisions:
 *   - Flat list sorted by updated_at DESC (server default); no client-side
 *     grouping in this wave — noted as concern.
 *   - Layer badge renders inline so the hierarchy is visible at a glance.
 *   - No create-form dialog in this wave (deferred; noted as concern).
 *   - TanStack Query for data fetching, consistent with projects/page.tsx.
 *   - WCAG 2.1 AA: min-h touch targets, focus-visible rings, role="list".
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Target,
  AlertCircle,
  ChevronRight,
  Calendar,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listIntents } from "@/lib/api/intents";
import type { IntentDTO, IntentFrontmatter, IntentLayer, IntentStatus } from "@/types/intents";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTENTS_QUERY_KEY = ["intents", "list"] as const;

// Layer display config — label + colour token
const LAYER_CONFIG: Record<
  IntentLayer,
  { label: string; className: string }
> = {
  root:    { label: "Root",    className: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
  domain:  { label: "Domain",  className: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  project: { label: "Project", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  feature: { label: "Feature", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  cycle:   { label: "Cycle",   className: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" },
  daily:   { label: "Daily",   className: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
  session: { label: "Session", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

const STATUS_CONFIG: Record<IntentStatus, { label: string; className: string }> = {
  draft:   { label: "Draft",   className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  active:  { label: "Active",  className: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400" },
  paused:  { label: "Paused",  className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400" },
  retired: { label: "Retired", className: "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getFrontmatter(dto: IntentDTO): IntentFrontmatter {
  return dto.frontmatter as IntentFrontmatter;
}

// ---------------------------------------------------------------------------
// Layer badge
// ---------------------------------------------------------------------------

interface LayerBadgeProps {
  layer: string | null | undefined;
}

function LayerBadge({ layer }: LayerBadgeProps) {
  const config = layer && layer in LAYER_CONFIG
    ? LAYER_CONFIG[layer as IntentLayer]
    : null;

  if (!config) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-muted text-muted-foreground">
        {layer ?? "—"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  intentStatus: string | null | undefined;
}

function StatusBadge({ intentStatus }: StatusBadgeProps) {
  const config = intentStatus && intentStatus in STATUS_CONFIG
    ? STATUS_CONFIG[intentStatus as IntentStatus]
    : null;

  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Intent row
// ---------------------------------------------------------------------------

interface IntentRowProps {
  intent: IntentDTO;
}

function IntentRow({ intent }: IntentRowProps) {
  const fm = getFrontmatter(intent);

  return (
    <li>
      <Link
        href={`/artifact/${encodeURIComponent(intent.id)}`}
        aria-label={`Open intent: ${intent.title}`}
        className={cn(
          "group flex cursor-pointer items-start justify-between gap-4 rounded-lg border bg-card p-4 transition-all",
          "hover:border-primary/40 hover:bg-accent/30 hover:shadow-sm",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Dim superseded entries
          intent.status === "superseded" && "opacity-60",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Icon */}
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-violet-50 dark:bg-violet-950/30">
            <Target
              aria-hidden="true"
              className="size-4 text-violet-600 dark:text-violet-400"
            />
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
              {intent.title}
            </p>

            {/* Badges row */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <LayerBadge layer={fm.layer} />
              <StatusBadge intentStatus={fm.intent_status} />
              {fm.horizon && (
                <span className="text-[10px] text-muted-foreground">
                  {fm.horizon}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar aria-hidden="true" className="size-3" />
                {formatDate(intent.updated_at)}
              </span>
              {fm.intent_version && (
                <span className="text-xs text-muted-foreground">
                  v{fm.intent_version}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
        />
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function IntentRowSkeleton() {
  return (
    <li
      className="flex items-start gap-3 rounded-lg border bg-card p-4"
      aria-hidden="true"
    >
      <div className="mt-0.5 h-9 w-9 shrink-0 animate-pulse rounded-md bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-3.5 w-14 animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-12 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-20 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-950/30">
        <Target
          aria-hidden="true"
          className="size-7 text-violet-600 dark:text-violet-400"
        />
      </div>
      <div className="max-w-xs">
        <p className="text-sm font-semibold text-foreground">No intents yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create intents via the CLI (
          <code className="font-mono">meatywiki intent new</code>) or the API.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-12 text-center"
    >
      <AlertCircle aria-hidden="true" className="size-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Failed to load intents
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex min-h-[44px] items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive sm:h-8 sm:min-h-0",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function IntentsPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: INTENTS_QUERY_KEY,
    queryFn: () => listIntents({ limit: 50 }),
    staleTime: 30_000,
  });

  const intents = data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Intents</h1>
          <p className="text-sm text-muted-foreground">
            Versioned planning artifacts organised by layer and lifecycle.
          </p>
        </div>
        {/* Create button intentionally omitted in this wave — see concerns */}
      </div>

      {/* Loading spinner (secondary indicator while skeleton rows show) */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          Loading intents…
        </div>
      )}

      {/* Content */}
      {isError && error ? (
        <ErrorState
          error={error instanceof Error ? error : new Error(String(error))}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          {/* Skeleton */}
          {isLoading && (
            <ul
              role="list"
              className="flex flex-col gap-3"
              aria-label="Loading intents"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <IntentRowSkeleton key={i} />
              ))}
            </ul>
          )}

          {/* Intent list */}
          {!isLoading && intents.length > 0 && (
            <ul
              role="list"
              className="flex flex-col gap-3"
              aria-label="Intents"
            >
              {intents.map((intent) => (
                <IntentRow key={intent.id} intent={intent} />
              ))}
            </ul>
          )}

          {/* Empty state */}
          {!isLoading && intents.length === 0 && <EmptyState />}
        </>
      )}
    </div>
  );
}
