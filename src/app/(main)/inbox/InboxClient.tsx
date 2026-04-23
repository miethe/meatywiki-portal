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
 *   - Status grouping (P5-01): items bucketed into NEW / NEEDS COMPILE /
 *     NEEDS DESTINATION sections using StatusGroupSection headers with count
 *     pills and per-group urgency color indicators.
 *
 * Design aesthetic: clean archival/editorial — slate palette, subtle
 * monospaced accents for timestamps, generous whitespace. Matches the
 * "Standard Archival" shell identified in the Stitch audit §2.1.
 *
 * P3-10: Page header flex changed to flex-wrap + gap so title + button
 *        stack cleanly at 320px. Quick Add button touch target bumped to
 *        min-h-[44px] on xs.
 * P5-01: Status grouping with StatusGroupSection headers (StatusGroupSection
 *        reused from src/components/ui/status-group-section.tsx).
 *
 * Stitch reference: "Inbox" screen (ID: 837a47df72a648749bafefd22988de7f)
 * WCAG 2.1 AA: preserved from scaffold; focusable interactive elements have
 * visible focus rings.
 *
 * --- Status enum notes (P5-01) ---
 * Expected backend inbox status enum: new | needs_compile | needs_destination
 * (per phase-5-inbox-reskin.md §Status mapping).
 *
 * Current ArtifactCard.status type is ArtifactStatus = "draft" | "active" |
 * "archived" | "stale" — the backend has not yet shipped the inbox-specific
 * enum on this field. Until the backend updates the ArtifactCard DTO, we
 * derive the inbox group from the existing status value using the mapping
 * below (MISMATCH-04). When the backend ships `new | needs_compile |
 * needs_destination`, remove the mapping and use InboxStatus directly.
 *
 * Fallback: items with missing or unrecognised status are bucketed under
 * NEEDS COMPILE (most conservative triage action — they need human review
 * before any routing decision). Rationale: "needs compile" is the safest
 * default since compilation is reversible and low-risk.
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { StatusGroupSection } from "@/components/ui/status-group-section";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";
import { useInboxArtifacts } from "@/hooks/useInboxArtifacts";
import type { ServiceModeEnvelope, ArtifactCard as ArtifactCardType } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Inbox status grouping (P5-01)
// ---------------------------------------------------------------------------

/**
 * Three canonical inbox groups as defined in the Stitch design spec and
 * phase-5-inbox-reskin.md §"Design Reference: Inbox Stitch PNG".
 *
 * Backend target enum: "new" | "needs_compile" | "needs_destination"
 * Frontend mapping from current ArtifactStatus:
 *   "draft"    → new          (freshly captured, untouched)
 *   "active"   → needs_compile (in-progress; needs compilation to become useful)
 *   "stale"    → needs_destination (processed; needs routing to a workspace)
 *   "archived" → needs_destination (completed but may need re-routing)
 *
 * MISMATCH-04: remove mapping and use ArtifactStatus extension once backend
 * ships inbox-specific enum on the ArtifactCard DTO.
 */
type InboxGroup = "new" | "needs_compile" | "needs_destination";

const STATUS_TO_GROUP: Record<string, InboxGroup> = {
  // Current ArtifactStatus values → inbox group
  draft: "new",
  active: "needs_compile",
  stale: "needs_destination",
  archived: "needs_destination",
  // Forward-compat: backend inbox-specific enum values map 1:1
  new: "new",
  needs_compile: "needs_compile",
  needs_destination: "needs_destination",
};

const GROUP_ORDER: InboxGroup[] = ["new", "needs_compile", "needs_destination"];

const GROUP_LABELS: Record<InboxGroup, string> = {
  new: "NEW",
  needs_compile: "NEEDS COMPILE",
  needs_destination: "NEEDS DESTINATION",
};

/** Derive urgency for the whole group based on whether any item is >24h old.
 *  Uses the artifact's `updated` or `created` field (ISO 8601 string) if present.
 *  >24h → urgent (red); 4–24h with at least one such item → warn (amber); else normal.
 */
function deriveGroupUrgency(
  items: ArtifactCardType[],
): "normal" | "warn" | "urgent" {
  const now = Date.now();
  let hasWarn = false;
  for (const item of items) {
    const ts = item.updated ?? item.created;
    if (!ts) continue;
    const ageMs = now - new Date(ts).getTime();
    const ageHours = ageMs / 3_600_000;
    if (ageHours > 24) return "urgent";
    if (ageHours > 4) hasWarn = true;
  }
  return hasWarn ? "warn" : "normal";
}

/** Partition artifacts into the three inbox groups. Items with missing /
 *  unrecognised status fall back to "needs_compile" (documented above).
 */
function groupArtifacts(
  artifacts: ArtifactCardType[],
): Record<InboxGroup, ArtifactCardType[]> {
  const groups: Record<InboxGroup, ArtifactCardType[]> = {
    new: [],
    needs_compile: [],
    needs_destination: [],
  };
  for (const artifact of artifacts) {
    const group: InboxGroup = STATUS_TO_GROUP[artifact.status] ?? "needs_compile";
    groups[group].push(artifact);
  }
  return groups;
}

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

  // P5-01: Group artifacts by inbox status. Recalculates only when the
  // artifacts array reference changes (load-more appends a new array).
  const groups = useMemo(() => groupArtifacts(artifacts), [artifacts]);

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
      {/* Artifact list — status-grouped (P5-01)                             */}
      {/* ------------------------------------------------------------------ */}
      <section aria-label="Inbox artifacts" className="mt-4">
        {/* sr-only h2 bridges h1 → h3 heading order (WCAG 1.3.1 heading-order) */}
        <h2 className="sr-only">Artifact list</h2>
        {artifacts.length === 0 && !isLoading ? (
          <InboxEmpty />
        ) : (
          /*
           * P5-01: Render one StatusGroupSection per non-empty group.
           * Order: NEW → NEEDS COMPILE → NEEDS DESTINATION.
           * Empty groups are hidden (no header rendered).
           * Urgency indicator is derived from item age within the group.
           */
          <div className="flex flex-col gap-6">
            {GROUP_ORDER.map((groupKey) => {
              const items = groups[groupKey];
              if (items.length === 0) return null;
              const urgency = deriveGroupUrgency(items);
              return (
                <StatusGroupSection
                  key={groupKey}
                  label={GROUP_LABELS[groupKey]}
                  count={items.length}
                  urgency={urgency}
                >
                  <ul
                    role="list"
                    aria-label={`${GROUP_LABELS[groupKey]} artifacts`}
                    className="flex flex-col gap-2"
                  >
                    {items.map((artifact) => (
                      <li key={artifact.id}>
                        <ArtifactCard artifact={artifact} variant="list" />
                      </li>
                    ))}
                  </ul>
                </StatusGroupSection>
              );
            })}
          </div>
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
