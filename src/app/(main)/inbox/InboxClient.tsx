"use client";

/**
 * InboxClient — interactive layer for the Inbox screen.
 *
 * Accepts server-fetched initial data and handles:
 *   - Cursor-based "Load more" pagination (useInboxArtifacts)
 *   - Quick Add modal open/close state (form wiring is P3-04)
 *   - Loading skeleton (initial load-more in-flight)
 *   - Error state (inline alert)
 *   - Empty state
 *
 * Design aesthetic: clean archival/editorial — slate palette, subtle
 * monospaced accents for timestamps, generous whitespace. Matches the
 * "Standard Archival" shell identified in the Stitch audit §2.1.
 *
 * P3-10: Page header flex changed to flex-wrap + gap so title + button
 *        stack cleanly at 320px. Quick Add button touch target bumped to
 *        min-h-[44px] on xs.
 *
 * Stitch reference: "Inbox" screen (ID: 837a47df72a648749bafefd22988de7f)
 * WCAG 2.1 AA: preserved from scaffold; focusable interactive elements have
 * visible focus rings.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";
import { useInboxArtifacts } from "@/hooks/useInboxArtifacts";
import type { ServiceModeEnvelope, ArtifactCard as ArtifactCardType } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function ArtifactCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-start gap-3 rounded-md border bg-card p-3 animate-pulse"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Badge row */}
        <div className="flex gap-1.5">
          <div className="h-4 w-16 rounded-sm bg-muted" />
          <div className="h-4 w-12 rounded-sm bg-muted" />
        </div>
        {/* Title */}
        <div className="h-3.5 w-3/4 rounded bg-muted" />
        {/* Footer */}
        <div className="flex justify-between pt-0.5">
          <div className="h-3 w-20 rounded bg-muted/60" />
          <div className="h-3 w-10 rounded bg-muted/60" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function InboxEmpty() {
  return (
    <div
      role="status"
      aria-label="Inbox is empty"
      className="flex flex-col items-center gap-3 py-16 text-center"
    >
      {/* Inbox tray icon */}
      <svg
        aria-hidden="true"
        className="size-10 text-muted-foreground/40"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.25}
          d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0-3.5 3.5M4 13l3.5 3.5M4 13h16M7.5 16.5 12 21l4.5-4.5"
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-foreground">Your inbox is empty</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Capture a note or URL with Quick Add to get started.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm"
    >
      <span className="text-destructive">{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "shrink-0 text-xs font-medium text-destructive underline-offset-2",
          "hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InboxClientProps {
  initialData: ServiceModeEnvelope<ArtifactCardType>;
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function InboxClient({ initialData }: InboxClientProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const { artifacts, hasMore, isLoading, error, loadMore } = useInboxArtifacts({
    initialData,
  });

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                         */}
      {/* ------------------------------------------------------------------ */}
      {/*
       * P3-10: flex-wrap + gap-y-3 so title and button stack at 320px.
       * At sm+ they remain on one line (justify-between).
       */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Recently captured artifacts
          </p>
        </div>

        {/* Quick Add trigger — min-h-[44px] for mobile touch target */}
        <button
          type="button"
          aria-label="Quick Add artifact"
          onClick={() => setQuickAddOpen(true)}
          className={cn(
            "inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4",
            "text-sm font-medium text-primary-foreground",
            "sm:h-9 sm:min-h-0",
            "transition-colors hover:bg-primary/90",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {/* Plus icon */}
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Quick Add
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Artifact list                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Inbox artifacts" className="mt-4">
        {/* sr-only h2 bridges h1 → h3 heading order (WCAG 1.3.1 heading-order) */}
        <h2 className="sr-only">Artifact list</h2>
        {artifacts.length === 0 && !isLoading ? (
          <InboxEmpty />
        ) : (
          <ul role="list" aria-label="Inbox artifacts" className="flex flex-col gap-2">
            {artifacts.map((artifact) => (
              <li key={artifact.id}>
                <ArtifactCard artifact={artifact} variant="list" />
              </li>
            ))}
          </ul>
        )}

        {/* Load-more skeleton rows */}
        {isLoading && (
          <ul
            role="list"
            aria-label="Loading more artifacts"
            className="mt-2 flex flex-col gap-2"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable id
              <li key={i}>
                <ArtifactCardSkeleton />
              </li>
            ))}
          </ul>
        )}

        {/* Error banner */}
        {error && (
          <div className="mt-3">
            <ErrorBanner message={error} onRetry={loadMore} />
          </div>
        )}

        {/* Load more button */}
        {hasMore && !isLoading && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              aria-label="Load more artifacts"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-4",
                "text-sm text-muted-foreground",
                "transition-colors hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Load more
              {/* Chevron down */}
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
                  d="m6 9 6 6 6-6"
                />
              </svg>
            </button>
          </div>
        )}

        {/* End-of-list indicator (only when items exist and pagination is exhausted) */}
        {!hasMore && !isLoading && artifacts.length > 0 && (
          <p
            aria-live="polite"
            className="mt-4 text-center text-xs text-muted-foreground/60"
          >
            All artifacts loaded
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Quick Add modal (form wiring is P3-04)                             */}
      {/* ------------------------------------------------------------------ */}
      <QuickAddModal open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </>
  );
}
