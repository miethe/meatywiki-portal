"use client";

/**
 * LowConfidenceList — artifact list for the "Low Confidence" review tab.
 *
 * P4-FE-009: Fetches artifacts with verification_status=human_review_pending
 * and displays them with suggested_links inline. Accept/reject actions update
 * verification_status via PATCH /api/artifacts/{id}.
 *
 * Suggested links are returned by the backend as part of the artifact card
 * when `include=suggested_links` is passed. The field `suggested_links` is
 * typed as an optional array on ArtifactCard — rendered when present.
 *
 * MISMATCH note: the backend may not yet expose `suggested_links` on
 * ArtifactCard. The component renders gracefully when the field is absent.
 */

import { useState, useCallback } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AlertCircle, CheckCircle2, XCircle, ExternalLink, Link2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { listArtifacts } from "@/lib/api/artifacts";
import { apiFetch } from "@/lib/api/client";
import type { ArtifactCard } from "@/types/artifact";
import type { ServiceModeEnvelope } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SuggestedLink {
  target_id: string;
  target_title: string | null;
  relationship_type: string;
  confidence: number;
}

type LowConfidenceArtifact = ArtifactCard & {
  suggested_links?: SuggestedLink[] | null;
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchLowConfidenceArtifacts(cursor?: string | null) {
  const params: Parameters<typeof listArtifacts>[0] = {
    status: "human_review_pending" as ArtifactCard["status"],
    limit: 20,
    sort: "updated",
    order: "desc",
  };
  if (cursor) params.cursor = cursor;

  // The filter is serialised as ?filter=verification_status:human_review_pending
  // and ?include=suggested_links via the query string
  const query = new URLSearchParams();
  query.set("filter", "verification_status:human_review_pending");
  query.set("include", "suggested_links");
  query.set("limit", "20");
  query.set("sort", "updated");
  query.set("order", "desc");
  if (cursor) query.set("cursor", cursor);

  return apiFetch<ServiceModeEnvelope<LowConfidenceArtifact>>(
    `/artifacts?${query.toString()}`,
    { method: "GET" },
  );
}

async function patchVerificationStatus(
  id: string,
  status: "verified" | "rejected",
) {
  // Simple PATCH without ETag — review queue accepts verification_status
  // transitions without optimistic concurrency control.
  return apiFetch<{ id: string }>(`/artifacts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verification_status: status }),
  });
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
        <CheckCircle2 aria-hidden="true" className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No items in this filter</p>
        <p className="mt-1 text-xs text-muted-foreground">
          All artifacts have been reviewed or none are awaiting human review.
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/5 rounded bg-muted" />
          <div className="h-3 w-1/4 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-16 rounded bg-muted" />
          <div className="h-7 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggested links row
// ---------------------------------------------------------------------------

function SuggestedLinksRow({ links }: { links: SuggestedLink[] }) {
  if (links.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-dashed bg-muted/30 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Link2 aria-hidden="true" className="size-3 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Suggested links
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {links.map((link) => (
          <li
            key={`${link.target_id}-${link.relationship_type}`}
            className="flex items-center gap-2 text-[11px]"
          >
            <span className="inline-flex shrink-0 items-center rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              {link.relationship_type}
            </span>
            <Link
              href={`/artifact/${link.target_id}`}
              className={cn(
                "min-w-0 truncate text-foreground hover:text-primary hover:underline underline-offset-2",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
              )}
            >
              {link.target_title ?? link.target_id}
            </Link>
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
              {Math.round(link.confidence * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact row
// ---------------------------------------------------------------------------

interface ArtifactRowProps {
  artifact: LowConfidenceArtifact;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
}

function ArtifactRow({
  artifact,
  onAccept,
  onReject,
  isPending,
}: ArtifactRowProps) {
  const suggestedLinks = artifact.suggested_links ?? [];

  return (
    <li className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-4">
        {/* Title + meta */}
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
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
              {artifact.type}
            </span>
            {artifact.updated && (
              <time dateTime={artifact.updated}>
                {new Date(artifact.updated).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onAccept(artifact.id)}
            disabled={isPending}
            aria-label={`Accept ${artifact.title}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400",
              "transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <CheckCircle2 aria-hidden="true" className="size-3.5" />
            Accept
          </button>
          <button
            type="button"
            onClick={() => onReject(artifact.id)}
            disabled={isPending}
            aria-label={`Reject ${artifact.title}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-400",
              "transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/30",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            <XCircle aria-hidden="true" className="size-3.5" />
            Reject
          </button>
        </div>
      </div>

      {/* Suggested links */}
      {suggestedLinks.length > 0 && (
        <SuggestedLinksRow links={suggestedLinks} />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LowConfidenceList() {
  const queryClient = useQueryClient();
  const [actingOn, setActingOn] = useState<Set<string>>(new Set());

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
    queryKey: ["review", "low-confidence"],
    queryFn: ({ pageParam }) =>
      fetchLowConfidenceArtifacts(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      (lastPage as ServiceModeEnvelope<LowConfidenceArtifact>).cursor ?? null,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "verified" | "rejected";
    }) => patchVerificationStatus(id, status),
    onSuccess: (_data, variables) => {
      setActingOn((prev) => {
        const next = new Set(prev);
        next.delete(variables.id);
        return next;
      });
      // Invalidate so the list refreshes and removes the handled item
      void queryClient.invalidateQueries({ queryKey: ["review", "low-confidence"] });
    },
    onError: (_error, variables) => {
      setActingOn((prev) => {
        const next = new Set(prev);
        next.delete(variables.id);
        return next;
      });
    },
  });

  const handleAccept = useCallback(
    (id: string) => {
      setActingOn((prev) => new Set(prev).add(id));
      mutation.mutate({ id, status: "verified" });
    },
    [mutation],
  );

  const handleReject = useCallback(
    (id: string) => {
      setActingOn((prev) => new Set(prev).add(id));
      mutation.mutate({ id, status: "rejected" });
    },
    [mutation],
  );

  const artifacts: LowConfidenceArtifact[] =
    data?.pages.flatMap(
      (page) => (page as ServiceModeEnvelope<LowConfidenceArtifact>).data ?? [],
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
        aria-label="Low confidence artifacts"
        className="flex flex-col gap-3"
      >
        {artifacts.map((artifact) => (
          <ArtifactRow
            key={artifact.id}
            artifact={artifact}
            onAccept={handleAccept}
            onReject={handleReject}
            isPending={actingOn.has(artifact.id)}
          />
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
