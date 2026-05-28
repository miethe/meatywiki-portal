"use client";

/**
 * SavedPackages — displays saved research packages (external_research_package artifacts).
 *
 * Fetches GET /api/research/packages on mount.
 * Each card shows: package name/title, artifact_count badge, created_at.
 * Click → navigate to /artifacts/[id] (artifact detail viewer).
 *
 * Features:
 * - Initial skeleton (3 ghost cards)
 * - Empty state
 * - Inline error banner with retry
 * - "Load more" cursor pagination
 * - WCAG 2.1 AA: keyboard-navigable cards, aria-labels
 *
 * P5-05 (portal-research-workflow-realignment-v2-1).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Archive, ChevronRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listResearchPackages,
  type ResearchPackageItem,
} from "@/lib/api/research-home";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Skeleton cards
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
      <div className="h-4 w-10 animate-pulse rounded bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center">
      <Archive aria-hidden="true" className="size-7 text-muted-foreground/40" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">No saved packages</p>
        <p className="text-xs text-muted-foreground">
          Research packages uploaded via the wizard will appear here.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Package card
// ---------------------------------------------------------------------------

interface PackageCardProps {
  item: ResearchPackageItem;
  onClick: (id: string) => void;
}

function PackageCard({ item, onClick }: PackageCardProps) {
  const shortId = item.artifact_id.slice(-8);

  return (
    <article
      aria-label={`Package: ${item.title}`}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-4",
        "transition-colors hover:border-border/80 hover:bg-muted/20",
      )}
    >
      {/* Icon */}
      <Package
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
      />

      {/* Title + meta */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-foreground">
          {item.title}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono">{shortId}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(item.created_at)}</span>
        </div>
      </div>

      {/* Artifact count badge */}
      <span
        aria-label={`${item.artifact_count} derived artifact${item.artifact_count === 1 ? "" : "s"}`}
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5",
          "text-[10px] font-semibold",
          "bg-primary/10 text-primary",
        )}
      >
        {item.artifact_count}
      </span>

      {/* Navigate button */}
      <button
        type="button"
        aria-label={`Open package: ${item.title}`}
        onClick={() => onClick(item.artifact_id)}
        className={cn(
          "shrink-0 inline-flex items-center gap-0.5 rounded-md px-2 py-1",
          "text-[11px] font-medium text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Open
        <ChevronRight aria-hidden="true" className="size-3" />
      </button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SavedPackages() {
  const router = useRouter();

  const [packages, setPackages] = useState<ResearchPackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchPage = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const envelope = await listResearchPackages({
          cursor: nextCursor,
          limit: 20,
        });

        if (!mountedRef.current) return;

        setPackages((prev) =>
          append ? [...prev, ...envelope.data] : envelope.data,
        );
        setCursor(envelope.cursor);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load research packages",
        );
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    void fetchPage(null, false);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePackageClick = useCallback(
    (id: string) => {
      router.push(`/artifacts/${encodeURIComponent(id)}`);
    },
    [router],
  );

  const handleLoadMore = useCallback(() => {
    if (cursor) void fetchPage(cursor, true);
  }, [cursor, fetchPage]);

  const handleRetry = useCallback(() => {
    void fetchPage(null, false);
  }, [fetchPage]);

  const hasPackages = packages.length > 0;
  const hasMore = cursor !== null;

  return (
    <section
      aria-label="Saved Research Packages"
      aria-busy={loading}
      className="flex flex-col gap-3"
    >
      {/* Loading skeleton */}
      {loading && !hasPackages && (
        <div
          aria-label="Loading saved packages"
          className="flex flex-col gap-2"
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error banner */}
      {error && !loading && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="shrink-0 rounded border border-destructive/30 px-2 py-0.5 text-[10px] font-medium hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !hasPackages && <EmptyState />}

      {/* Package list */}
      {hasPackages && (
        <div
          role="list"
          aria-label={`${packages.length} saved package${packages.length === 1 ? "" : "s"}`}
          className="flex flex-col gap-2"
        >
          {packages.map((item) => (
            <div key={item.artifact_id} role="listitem">
              <PackageCard item={item} onClick={handlePackageClick} />
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && !error && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            aria-label="Load more saved packages"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-4 py-1.5",
              "text-xs font-medium text-foreground transition-colors",
              "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}
