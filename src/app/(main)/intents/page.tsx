"use client";

/**
 * Intents list page — Task B2.
 *
 * Displays the full list of intent artifacts, grouped loosely by layer.
 * Each row/card navigates to /artifact/{id} (the shared artifact detail route).
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
 *   - Grid/list view toggle persisted to localStorage via useViewMode.
 *     Grid mode: 1-col → 2-col (sm) → 3-col (xl).
 *     List mode: IntentRow (original). Grid mode: IntentCard (new).
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Target,
  AlertCircle,
  ChevronRight,
  Calendar,
  Loader2,
  User,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listIntents } from "@/lib/api/intents";
import type { IntentDTO, IntentFrontmatter, IntentLayer, IntentStatus } from "@/types/intents";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useViewMode } from "@/hooks/use-view-mode";

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

/** Relative date (e.g. "3 days ago") with fallback to absolute. */
function formatRelativeDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  } catch {
    return formatDate(iso);
  }
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
// Intent row — LIST-variant renderer (preserved from original)
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
// Intent card — GRID-variant renderer
// ---------------------------------------------------------------------------

interface IntentCardProps {
  intent: IntentDTO;
}

function IntentCard({ intent }: IntentCardProps) {
  const fm = getFrontmatter(intent);
  // Show up to 3 tags
  const visibleTags = fm.tags?.slice(0, 3) ?? [];
  const extraTagCount = (fm.tags?.length ?? 0) - visibleTags.length;

  return (
    <li>
      <Link
        href={`/artifact/${encodeURIComponent(intent.id)}`}
        aria-label={`Open intent: ${intent.title}`}
        className={cn(
          "group flex h-full cursor-pointer flex-col gap-3 rounded-lg border bg-card p-4 transition-all",
          "hover:border-primary/40 hover:bg-accent/30 hover:shadow-sm",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Dim superseded entries
          intent.status === "superseded" && "opacity-60",
        )}
      >
        {/* Top row: icon + layer/status badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-violet-50 dark:bg-violet-950/30">
            <Target
              aria-hidden="true"
              className="size-4 text-violet-600 dark:text-violet-400"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <LayerBadge layer={fm.layer} />
            <StatusBadge intentStatus={fm.intent_status} />
          </div>
        </div>

        {/* Title */}
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
          {intent.title}
        </p>

        {/* Horizon tag */}
        {fm.horizon && (
          <span className="inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {fm.horizon}
          </span>
        )}

        {/* Tag chips — up to 3 */}
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1" aria-label="Tags">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                <Tag aria-hidden="true" className="size-2.5 shrink-0" />
                {tag}
              </span>
            ))}
            {extraTagCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                +{extraTagCount}
              </span>
            )}
          </div>
        )}

        {/* Spacer pushes footer to bottom of card */}
        <div className="flex-1" />

        {/* Footer: owner + version + updated */}
        <div className="flex items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 truncate">
            {fm.owner ? (
              <>
                <User aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">{fm.owner}</span>
              </>
            ) : (
              fm.intent_version && (
                <span>v{fm.intent_version}</span>
              )
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {fm.owner && fm.intent_version && (
              <span className="text-[10px]">v{fm.intent_version}</span>
            )}
            <span
              title={intent.updated_at ? new Date(intent.updated_at).toLocaleString() : undefined}
            >
              {formatRelativeDate(intent.updated_at)}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — list variant
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
// Loading skeleton — grid variant
// ---------------------------------------------------------------------------

function IntentCardSkeleton() {
  return (
    <li
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
      aria-hidden="true"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-md bg-muted" />
        <div className="flex gap-1">
          <div className="h-4 w-12 animate-pulse rounded bg-muted" />
          <div className="h-4 w-10 animate-pulse rounded bg-muted" />
        </div>
      </div>
      {/* Title */}
      <div className="space-y-1.5">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>
      {/* Horizon chip */}
      <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
      {/* Tags */}
      <div className="flex gap-1">
        <div className="h-4 w-12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-10 animate-pulse rounded bg-muted" />
      </div>
      {/* Footer */}
      <div className="mt-auto border-t pt-2.5">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
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

  const { viewMode, setViewMode, mounted } = useViewMode("meatywiki-intents-view", "grid");

  const intents = data?.data ?? [];

  // Effective view mode — render as "grid" during SSR to avoid hydration flash
  const effectiveView = mounted ? viewMode : "grid";

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
        {/* View toggle — top-right, matching Library page header placement */}
        <ViewToggle view={effectiveView} onChange={setViewMode} />
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
              aria-label="Loading intents"
              className={cn(
                "grid gap-3",
                effectiveView === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                  : "grid-cols-1",
              )}
            >
              {Array.from({ length: effectiveView === "grid" ? 6 : 5 }).map((_, i) =>
                effectiveView === "grid" ? (
                  <IntentCardSkeleton key={i} />
                ) : (
                  <IntentRowSkeleton key={i} />
                ),
              )}
            </ul>
          )}

          {/* Intent list / grid */}
          {!isLoading && intents.length > 0 && (
            <ul
              role="list"
              aria-label="Intents"
              className={cn(
                "grid gap-3",
                effectiveView === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                  : "grid-cols-1",
              )}
            >
              {intents.map((intent) =>
                effectiveView === "grid" ? (
                  <IntentCard key={intent.id} intent={intent} />
                ) : (
                  <IntentRow key={intent.id} intent={intent} />
                ),
              )}
            </ul>
          )}

          {/* Empty state */}
          {!isLoading && intents.length === 0 && <EmptyState />}
        </>
      )}
    </div>
  );
}
