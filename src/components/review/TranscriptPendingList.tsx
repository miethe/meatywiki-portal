"use client";

/**
 * TranscriptPendingList — artifact list for the "Transcript Pending" review tab.
 *
 * P4-FE-009: Fetches audio artifacts awaiting transcription.
 * Backend: GET /api/artifacts?filter=transcript:pending
 *
 * Items are read-only in this view — no accept/reject actions since the
 * transcription is a system-side operation. Cursor pagination included.
 *
 * MISMATCH note: the backend may not yet support ?filter=transcript:pending
 * as a top-level query param. The component will degrade gracefully if the
 * backend returns an empty page, displaying the empty state.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AlertCircle, Mic, ExternalLink, Clock, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client";
import type { ArtifactCard } from "@/types/artifact";
import type { ServiceModeEnvelope } from "@/types/artifact";

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function fetchTranscriptPending(cursor?: string | null) {
  const query = new URLSearchParams();
  query.set("filter", "transcript:pending");
  query.set("limit", "20");
  query.set("sort", "updated");
  query.set("order", "asc");
  if (cursor) query.set("cursor", cursor);

  return apiFetch<ServiceModeEnvelope<ArtifactCard>>(
    `/artifacts?${query.toString()}`,
    { method: "GET" },
  );
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Mic aria-hidden="true" className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No items in this filter</p>
        <p className="mt-1 text-xs text-muted-foreground">
          No audio artifacts are currently awaiting transcription.
        </p>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-12 text-center"
    >
      <AlertCircle aria-hidden="true" className="size-8 text-destructive" />
      <div>
        <p className="text-sm font-medium text-foreground">Unable to load</p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        <RotateCcw aria-hidden="true" className="size-3" />
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ArtifactSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/5 rounded bg-muted" />
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="h-3 w-2/5 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact row
// ---------------------------------------------------------------------------

function ArtifactRow({ artifact }: { artifact: ArtifactCard }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      {/* Audio icon */}
      <div
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
      >
        <Mic className="size-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/artifact/${artifact.id}`}
            className={cn(
              "truncate text-sm font-medium text-foreground hover:text-primary hover:underline underline-offset-2",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
            )}
          >
            {artifact.title}
          </Link>
          <Link
            href={`/artifact/${artifact.id}`}
            aria-label={`Open ${artifact.title}`}
            className={cn(
              "shrink-0 text-muted-foreground/50 hover:text-muted-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
            )}
          >
            <ExternalLink aria-hidden="true" className="size-3" />
          </Link>
        </div>

        {/* Meta row */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
            {artifact.type}
          </span>

          {artifact.workspace && (
            <span className="capitalize">{artifact.workspace}</span>
          )}

          {artifact.updated && (
            <span className="flex items-center gap-1">
              <Clock aria-hidden="true" className="size-3" />
              <time dateTime={artifact.updated}>
                {new Date(artifact.updated).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </span>
          )}
        </div>

        {/* Transcript pending badge */}
        <div className="mt-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700",
              "dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/20",
            )}
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-amber-500 animate-pulse"
            />
            Transcription pending
          </span>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TranscriptPendingList() {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["review", "transcript-pending"],
    queryFn: ({ pageParam }) =>
      fetchTranscriptPending(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      (lastPage as ServiceModeEnvelope<ArtifactCard>).cursor ?? null,
    staleTime: 30_000,
  });

  const artifacts: ArtifactCard[] =
    data?.pages.flatMap(
      (page) => (page as ServiceModeEnvelope<ArtifactCard>).data ?? [],
    ) ?? [];

  if (isLoading) {
    return (
      <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading review items">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <ArtifactSkeleton />
          </li>
        ))}
      </ul>
    );
  }

  if (isError && error) {
    return <ErrorState error={error as Error} onRetry={() => void refetch()} />;
  }

  if (artifacts.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul
        role="list"
        aria-label="Transcript pending artifacts"
        className="flex flex-col gap-3"
      >
        {artifacts.map((artifact) => (
          <ArtifactRow key={artifact.id} artifact={artifact} />
        ))}
      </ul>

      {/* Load more */}
      {hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className={cn(
              "inline-flex items-center gap-2 rounded-md border px-4 py-1.5 text-sm font-medium text-foreground",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isFetchingNextPage ? (
              <>
                <svg
                  aria-hidden="true"
                  className="size-3.5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
