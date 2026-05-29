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
 *   - Item selection + ContextRail (P5-03): clicking an item card selects it;
 *     <InboxContextRail> renders in the right column with item properties and
 *     stub action buttons. First item auto-selected on mount when data is
 *     available. Selection is keyboard-accessible (Enter/Space on focused card).
 *   - Compile action (FE-04): items in the NEEDS COMPILE group show a Compile
 *     button. Each item's button owns its own useCompileArtifact state via the
 *     CompileButton sub-component. On success the item status is optimistically
 *     updated to "stale" (→ NEEDS DESTINATION group) so the item moves groups
 *     without a network roundtrip. On error, inline error text appears below
 *     the item row and auto-clears after 5 s.
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
 * P5-02: UrgencyBadge per item + per-item urgency derivation.
 * P5-03: Item selection state + ContextRail right column.
 * FE-04: Compile action button on inbox list items (needs_compile group).
 *
 * Stitch reference: "Inbox" screen (ID: 837a47df72a648749bafefd22988de7f)
 * WCAG 2.1 AA: preserved from scaffold; focusable interactive elements have
 * visible focus rings. Item cards wrapped as <button> for click+keyboard
 * selection (P5-03 a11y requirement).
 *
 * --- Status enum notes (P5-01) ---
 * Backend inbox status enum: new | needs_compile | needs_destination
 * (per phase-5-inbox-reskin.md §Status mapping). The backend returns these
 * values directly on ArtifactCard.status for inbox workspace artifacts
 * (MISMATCH-04 resolved). InboxStatus is consumed directly — no translation.
 *
 * Fallback: items with missing or unrecognised status are bucketed under
 * NEEDS COMPILE (most conservative triage action — they need human review
 * before any routing decision). Rationale: "needs compile" is the safest
 * default since compilation is reversible and low-risk.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { StatusGroupSection } from "@/components/ui/status-group-section";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";
import { InboxContextRail } from "@/components/inbox/InboxContextRail";
import { CompileStageIndicator } from "@/components/inbox/CompileStageIndicator";
import { CompileErrorPill } from "@/components/inbox/CompileErrorPill";
import { ProcessedSection } from "@/components/inbox/ProcessedSection";
import { useInboxArtifacts } from "@/hooks/useInboxArtifacts";
import { useCompileArtifact } from "@/hooks/useCompileArtifact";
import { useCompileEvents } from "@/hooks/useCompileEvents";
import { useInboxPending } from "@/hooks/useInboxPending";
import { PendingApprovalPanel } from "@/components/inbox/PendingApprovalPanel";
import { InboxBatchCompileHeader } from "@/components/inbox/InboxBatchCompileHeader";
import { useCompileBatch } from "@/hooks/useCompileBatch";
import { invalidateActivityCache } from "@/lib/api/artifacts";
import InfoTooltip from "@/components/ui/info-tooltip";
import { TOOLTIP_COPY } from "@/lib/copy/tooltips";
import { FirstRunOffer } from "@/components/tour/FirstRunOffer";
import type { ServiceModeEnvelope, ArtifactCard as ArtifactCardType } from "@/types/artifact";
import type { UrgencyLevel } from "@/components/ui/urgency-badge";

// ---------------------------------------------------------------------------
// Inbox grouping by intervention_category (event-driven, not lifecycle status)
// ---------------------------------------------------------------------------

/**
 * Three action-oriented inbox groups derived from the backend-computed
 * `intervention_category` field on each ArtifactCard.
 *
 * Ordered by urgency: Needs Fixes (most urgent) → Needs Compile → Needs Review.
 *
 * "ready" artifacts are excluded (backend should not return them in the inbox
 * endpoint, but we guard against it anyway). Null / unknown values fall back
 * to "needs_compile" as the safest conservative triage action.
 *
 * The old status-based STATUS_TO_GROUP and InboxStatus dependency are removed.
 * intervention_category is the authoritative source for inbox grouping.
 */
type InboxGroup = "needs_fix" | "needs_compile" | "needs_review";

const CATEGORY_TO_GROUP: Record<string, InboxGroup> = {
  needs_fix:     "needs_fix",
  needs_compile: "needs_compile",
  needs_review:  "needs_review",
  // Legacy status tokens — forward-compat bridge for items not yet re-classified
  new:           "needs_compile",
  // "ready" is excluded from inbox; guard maps it to needs_compile if it leaks through
  ready:         "needs_compile",
};

/** Urgency-ordered group render order (most urgent first). */
const GROUP_ORDER: InboxGroup[] = ["needs_fix", "needs_compile", "needs_review"];

const GROUP_LABELS: Record<InboxGroup, string> = {
  needs_fix:     "NEEDS FIXES",
  needs_compile: "NEEDS COMPILE",
  needs_review:  "NEEDS REVIEW",
};

// P1-06 (v2.3 onboarding): tooltip copy keys for each section header.
const GROUP_TOOLTIP_CONTENT: Record<InboxGroup, string> = {
  needs_fix:     TOOLTIP_COPY.inbox.sectionNeedsCompile, // reuse closest available copy
  needs_compile: TOOLTIP_COPY.inbox.sectionNeedsCompile,
  needs_review:  TOOLTIP_COPY.inbox.sectionNeedsDestination, // closest available copy
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

/**
 * Partition artifacts into inbox groups using `intervention_category`.
 *
 * Primary key: artifact.intervention_category (backend-computed).
 * Fallback: artifact.status via CATEGORY_TO_GROUP bridge (for items not yet
 * assigned an intervention_category by the backend).
 * "ready" artifacts and unknown values → "needs_compile" (safe default).
 */
function groupArtifacts(
  artifacts: ArtifactCardType[],
): Record<InboxGroup, ArtifactCardType[]> {
  const groups: Record<InboxGroup, ArtifactCardType[]> = {
    needs_fix:     [],
    needs_compile: [],
    needs_review:  [],
  };
  for (const artifact of artifacts) {
    // Prefer intervention_category; fall back to status-based bridge
    const categoryKey = artifact.intervention_category ?? artifact.status;
    // "ready" should not appear in inbox — exclude it rather than misfiling
    if (categoryKey === "ready") continue;
    const group: InboxGroup = CATEGORY_TO_GROUP[categoryKey] ?? "needs_compile";
    groups[group].push(artifact);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Per-item urgency computation (P5-02)
// ---------------------------------------------------------------------------

/**
 * Derive UrgencyLevel and minutesAgo for a single artifact.
 *
 * Level thresholds (phase-5-inbox-reskin.md §"Urgency Level Mapping"):
 *   <1h  → new
 *   1–4h → needs-action
 *   4–24h → stale
 *   >24h  → urgent
 *
 * Status override: if the artifact's status is "urgent" (forward-compat), force
 * the urgent level regardless of age.
 *
 * Falls back to { level: "new", minutesAgo: 0 } when no timestamp is available.
 */
function deriveItemUrgency(artifact: ArtifactCardType): {
  level: UrgencyLevel;
  minutesAgo: number;
} {
  // Status override (forward-compat: backend inbox-specific enum may include "urgent")
  if ((artifact.status as string) === "urgent") {
    const ts = artifact.updated ?? artifact.created;
    const minutesAgo = ts
      ? Math.floor((Date.now() - new Date(ts).getTime()) / 60_000)
      : 0;
    return { level: "urgent", minutesAgo };
  }

  const ts = artifact.updated ?? artifact.created;
  if (!ts) return { level: "new", minutesAgo: 0 };

  const minutesAgo = Math.max(
    0,
    Math.floor((Date.now() - new Date(ts).getTime()) / 60_000),
  );
  const hoursAgo = minutesAgo / 60;

  let level: UrgencyLevel;
  if (hoursAgo < 1) {
    level = "new";
  } else if (hoursAgo < 4) {
    level = "needs-action";
  } else if (hoursAgo < 24) {
    level = "stale";
  } else {
    level = "urgent";
  }

  return { level, minutesAgo };
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
// SelectableCardWrapper — thin a11y wrapper (P5-03)
// ---------------------------------------------------------------------------

/**
 * Wraps ArtifactCard with selection ring and onCardClick handler.
 * Follows the Library pattern: plain click selects (updates sidebar),
 * modifier-click (Cmd/Ctrl/Shift/Alt) navigates to the detail page.
 */
interface SelectableCardWrapperProps {
  artifact: ArtifactCardType;
  inboxGroup: InboxGroup;
  urgencyLevel: UrgencyLevel;
  urgencyMinutesAgo: number;
  isSelected: boolean;
  onSelect: (artifact: ArtifactCardType) => void;
  /** FE-04: when provided, rendered as an action overlay on the card row */
  compileSlot?: React.ReactNode;
  /** FE-04 / P1-04: inline error text shown below the card row */
  compileError?: string | null;
  /** P1-04 / F-03: called when the user dismisses the inline compile error */
  onDismissCompileError?: () => void;
}

function SelectableCardWrapper({
  artifact,
  inboxGroup,
  urgencyLevel,
  urgencyMinutesAgo,
  isSelected,
  onSelect,
  compileSlot,
  compileError,
  onDismissCompileError,
}: SelectableCardWrapperProps) {
  const handleCardClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Allow modifier-click to navigate to the detail page (same as Library)
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      onSelect(artifact);
    },
    [artifact, onSelect],
  );

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "rounded-md transition-all",
          isSelected ? "ring-2 ring-primary ring-offset-1" : "ring-0",
        )}
      >
        <ArtifactCard
          artifact={artifact}
          variant="list"
          inboxGroup={inboxGroup}
          urgencyLevel={urgencyLevel}
          urgencyMinutesAgo={urgencyMinutesAgo}
          ctaSlot={compileSlot}
          onCardClick={handleCardClick}
        />
      </div>

      {/* P1-04 / F-03: Inline compile error — persists until user dismisses it.
          Dismiss button requires explicit user action (no auto-clear timer). */}
      {compileError && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between gap-2 px-3 py-1"
        >
          <p className="text-xs text-destructive">{compileError}</p>
          {onDismissCompileError && (
            <button
              type="button"
              aria-label="Dismiss compile error"
              onClick={onDismissCompileError}
              className={cn(
                "shrink-0 text-xs font-medium text-destructive underline-offset-2",
                "hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InboxItemWithCompile — FE-04
// ---------------------------------------------------------------------------

/**
 * Thin wrapper that combines SelectableCardWrapper with CompileButton for
 * items in the needs_compile group. Owns the per-item compile error state.
 *
 * P1-04 / F-03: Error is NOT auto-cleared — it persists until the user
 * explicitly dismisses it (dismiss button in compileError slot) or retries.
 * This ensures compile failures are never silently swallowed.
 *
 * Separate component so the error state is isolated per item — one item's
 * error doesn't pollute others. The optimistic status update is bubbled up
 * via onCompileSuccess so InboxClient can mutate the shared artifacts list.
 */
interface InboxItemWithCompileProps {
  artifact: ArtifactCardType;
  inboxGroup: InboxGroup;
  urgencyLevel: UrgencyLevel;
  urgencyMinutesAgo: number;
  isSelected: boolean;
  onSelect: (artifact: ArtifactCardType) => void;
  onCompileSuccess: (artifactId: string) => void;
  /** P2-01: called with epoch-ms when compile POST returns 202 */
  onCompileStart?: (artifactId: string, startTimeMs: number) => void;
  /** P2-01: called when SSE terminal event arrives */
  onCompileTerminal?: (artifactId: string, isSuccess: boolean) => void;
}

function InboxItemWithCompile({
  artifact,
  inboxGroup,
  urgencyLevel,
  urgencyMinutesAgo,
  isSelected,
  onSelect,
  onCompileSuccess,
  onCompileStart,
  onCompileTerminal,
}: InboxItemWithCompileProps) {
  // P3-02: SSE streaming state — enabled after 202 ACK from compile POST.
  const [sseEnabled, setSseEnabled] = useState(false);
  const [stageIndicatorVisible, setStageIndicatorVisible] = useState(false);
  const [sseError, setSseError] = useState<{ code: string; message: string } | null>(null);

  const { events, terminal, reconnect: sseReconnect } = useCompileEvents({
    artifactId: artifact.id,
    enabled: sseEnabled,
  });

  // When terminal success arrives, refresh the processed section + disable SSE.
  useEffect(() => {
    if (terminal?.status === "success") {
      onCompileSuccess(artifact.id);
      onCompileTerminal?.(artifact.id, true);
    }
    if (terminal?.status === "error" && terminal.error) {
      setSseError(terminal.error);
      setSseEnabled(false);
      onCompileTerminal?.(artifact.id, false);
    }
  }, [terminal, artifact.id, onCompileSuccess, onCompileTerminal]);

  // P3-06: Item-level compile error (from HTTP POST, not SSE).
  const [httpError, setHttpError] = useState<string | null>(null);

  // P1-04 / F-03: No auto-clear timer — error persists until dismissed.
  const handleHttpError = useCallback((msg: string) => {
    setHttpError(msg);
    setSseEnabled(false);
  }, []);

  const handleDismissHttpError = useCallback(() => {
    setHttpError(null);
  }, []);

  const handleDismissSseError = useCallback(() => {
    setSseError(null);
    setStageIndicatorVisible(false);
  }, []);

  const handleRetry = useCallback(() => {
    setSseError(null);
    setHttpError(null);
    setStageIndicatorVisible(false);
    sseReconnect();
  }, [sseReconnect]);

  // --- Compile Button ---
  // After 202 ACK: enable SSE, show stage indicator, disable button.
  // P2-01: notify InboxClient of compile start for batch grouping.
  const handleCompileSuccess202 = useCallback(() => {
    setSseEnabled(true);
    setStageIndicatorVisible(true);
    setHttpError(null);
    setSseError(null);
    onCompileStart?.(artifact.id, Date.now());
  }, [artifact.id, onCompileStart]);

  const { compile, isCompiling } = useCompileArtifact({
    artifactId: artifact.id,
    onSuccess: handleCompileSuccess202,
    onError: handleHttpError,
  });

  // P1-06 (v2.3 onboarding): the compile button is wrapped with InfoTooltip
  // using asChild so the existing button element is the trigger — the click
  // target is fully preserved and the tooltip appears on hover/focus.
  const compileSlot = stageIndicatorVisible ? (
    <CompileStageIndicator
      events={events}
      terminal={terminal}
      onDone={() => setStageIndicatorVisible(false)}
    />
  ) : (
    <div data-tour="inbox-compile-button">
    <InfoTooltip
      asChild
      content={TOOLTIP_COPY.inbox.compileButton}
      side="top"
      align="end"
    >
      <button
        type="button"
        aria-label={
          isCompiling
            ? `Compilation in progress for ${artifact.title}`
            : `Compile ${artifact.title}`
        }
        aria-busy={isCompiling}
        disabled={isCompiling}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isCompiling) {
            compile();
          }
        }}
        className={cn(
          "pointer-events-auto inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5",
          "text-xs font-medium transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isCompiling
            ? "cursor-not-allowed opacity-70 text-muted-foreground border-border"
            : "text-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        {isCompiling && (
          <svg aria-hidden="true" className="size-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {isCompiling ? "Compiling…" : "Compile"}
      </button>
    </InfoTooltip>
    </div>
  );

  // SSE error pill — inline, below the card (higher priority than HTTP error).
  const errorPill = sseError ? (
    <CompileErrorPill
      error={sseError}
      onRetry={handleRetry}
      onDismiss={handleDismissSseError}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "rounded-md transition-all",
          isSelected ? "ring-2 ring-primary ring-offset-1" : "ring-0",
        )}
      >
        <ArtifactCard
          artifact={artifact}
          variant="list"
          inboxGroup={inboxGroup}
          urgencyLevel={urgencyLevel}
          urgencyMinutesAgo={urgencyMinutesAgo}
          ctaSlot={compileSlot}
          onCardClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onSelect(artifact);
          }}
        />
      </div>

      {/* SSE error pill — sticky, no auto-dismiss */}
      {errorPill && <div className="px-1">{errorPill}</div>}

      {/* HTTP error — legacy inline text (P1-04 / F-03) */}
      {!errorPill && httpError && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between gap-2 px-3 py-1"
        >
          <p className="text-xs text-destructive">{httpError}</p>
          <button
            type="button"
            aria-label="Dismiss compile error"
            onClick={handleDismissHttpError}
            className={cn(
              "shrink-0 text-xs font-medium text-destructive underline-offset-2",
              "hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            Dismiss
          </button>
        </div>
      )}
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
// Batch compile state helpers (P2-01)
// ---------------------------------------------------------------------------

/** Per-artifact compile state tracked at InboxClient level for batch grouping. */
interface ArtifactCompileState {
  startTimeMs: number;
  isTerminal: boolean;
  isSuccess: boolean;
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function InboxClient({ initialData }: InboxClientProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // P5-03: selected item state — null until data loads, then auto-selects first.
  const [selectedItem, setSelectedItem] = useState<ArtifactCardType | null>(null);

  // P1-04 / F-04: Track artifact IDs that have a compile job in flight (ref,
  // not state — no re-render needed). We do NOT optimistically flip the row's
  // group. The row stays in needs_compile with CompileButton's own isCompiling
  // feedback until SSE/poll delivers a terminal event (future phase).
  const compilingIdsRef = useRef<Set<string>>(new Set<string>());

  // P2-01: per-artifact compile state for batch grouping.
  const [compileStateMap, setCompileStateMap] = useState<
    Map<string, ArtifactCompileState>
  >(new Map());

  const handleBatchCompileStart = useCallback(
    (artifactId: string, startTimeMs: number) => {
      setCompileStateMap((prev) => {
        const next = new Map(prev);
        next.set(artifactId, { startTimeMs, isTerminal: false, isSuccess: false });
        return next;
      });
    },
    [],
  );

  const handleBatchCompileTerminal = useCallback(
    (artifactId: string, isSuccess: boolean) => {
      setCompileStateMap((prev) => {
        const existing = prev.get(artifactId);
        if (!existing) return prev;
        const next = new Map(prev);
        next.set(artifactId, { ...existing, isTerminal: true, isSuccess });
        return next;
      });
    },
    [],
  );

  // Derive batch entries from compileStateMap for useCompileBatch.
  const batchEntries = useMemo(
    () =>
      Array.from(compileStateMap.entries()).map(([artifactId, state]) => ({
        artifactId,
        startTimeMs: state.startTimeMs,
        isTerminal: state.isTerminal,
        isSuccess: state.isSuccess,
      })),
    [compileStateMap],
  );

  const { batch, isBatch } = useCompileBatch({ entries: batchEntries });

  const { artifacts, hasMore, isLoading, error, loadMore, processedItems, refreshProcessed, removeArtifact } =
    useInboxArtifacts({ initialData, includeProcessed: true });

  const {
    items: pendingItems,
    count: pendingCount,
    isLoading: pendingLoading,
    error: pendingError,
    refetch: pendingRefetch,
  } = useInboxPending();

  // P5-01: Group artifacts by inbox status. Recalculates only when the
  // artifacts array reference changes (load-more appends a new array).
  const groups = useMemo(() => groupArtifacts(artifacts), [artifacts]);

  const handleSelectItem = useCallback((artifact: ArtifactCardType) => {
    setSelectedItem(artifact);
  }, []);

  /**
   * P1-04 / F-04: Do NOT optimistically flip the row's group status on 202 ACK.
   *
   * The old code called optimisticUpdateArtifact(id, { status: "stale" }) which
   * immediately moved the row to NEEDS DESTINATION — a lie if the job later
   * fails or the backend disagrees. Instead we mark the ID as "compiling" so
   * future SSE/poll wiring (Portal v2.x) can use it, and let the row stay in
   * its current group. The CompileButton's own isCompiling/showSuccess states
   * already provide per-button feedback to the user.
   */
  const handleCompileSuccess = useCallback(
    (artifactId: string) => {
      compilingIdsRef.current.add(artifactId);
      // P3-06: refresh the processed section so the newly compiled artifact
      // appears there after a successful terminal SSE event.
      void refreshProcessed();
      // P4-04: invalidate the Library card activity cache so the status badge
      // for this artifact refreshes within ~5 s (staleTime budget).
      invalidateActivityCache(queryClient, artifactId);
    },
    [refreshProcessed, queryClient],
  );

  // P1-02 / F-08: Auto-select first visible inbox item on mount when:
  //   1. Data has loaded (artifacts array is non-empty)
  //   2. No item is currently selected
  //   3. No ?selected= URL param is present (user navigated in with a specific item)
  const hasSelectedParam = Boolean(searchParams.get("selected"));
  const autoSelectDone = useRef(false);

  useEffect(() => {
    if (autoSelectDone.current) return;
    if (hasSelectedParam) {
      autoSelectDone.current = true;
      return;
    }
    if (selectedItem !== null) {
      autoSelectDone.current = true;
      return;
    }
    // Find the first artifact across groups in GROUP_ORDER order
    const firstArtifact =
      groups["needs_fix"][0] ??
      groups["needs_compile"][0] ??
      groups["needs_review"][0] ??
      null;
    if (firstArtifact) {
      setSelectedItem(firstArtifact);
      autoSelectDone.current = true;
    }
  }, [groups, hasSelectedParam, selectedItem]);

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

      {/* P3-06: First-run tour offer banner */}
      <FirstRunOffer tourId="inbox" tourLabel="Inbox" className="mb-1" />

      {/* ------------------------------------------------------------------ */}
      {/* Two-column layout: artifact list (left) + ContextRail (right)      */}
      {/* P5-03: ContextRail hidden below xl (1280px). We use xl (not lg)    */}
      {/* because the inbox list benefits from the extra horizontal space.   */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-4 flex gap-6">
        {/* ---------------------------------------------------------------- */}
        {/* Left: Artifact list — status-grouped (P5-01)                    */}
        {/* ---------------------------------------------------------------- */}
        <section aria-label="Inbox artifacts" className="min-w-0 flex-1">
          {/* sr-only h2 bridges h1 → h3 heading order (WCAG 1.3.1 heading-order) */}
          <h2 className="sr-only">Artifact list</h2>

          {/* P2-03: Pending Approval panel — rendered above status groups when
               there are pending items or the initial fetch is in-flight. */}
          {(pendingCount > 0 || pendingLoading) && (
            <div className="mb-6" data-tour="inbox-pending-approval">
              {/* P1-06: sectionPendingApproval tooltip wired via the info slot. */}
              <PendingApprovalPanel
                items={pendingItems}
                count={pendingCount}
                isLoading={pendingLoading}
                error={pendingError}
                refetch={pendingRefetch}
                info={
                  <InfoTooltip
                    content={TOOLTIP_COPY.inbox.sectionPendingApproval}
                    side="top"
                    align="start"
                  />
                }
              />
            </div>
          )}

          {artifacts.length === 0 && !isLoading ? (
            <InboxEmpty />
          ) : (
            /*
             * P5-01: Render one StatusGroupSection per non-empty group.
             * P5-02: Pass per-item urgency data into ArtifactCard.
             * P5-03: Items wrapped in SelectableCardWrapper for click selection.
             * FE-04: needs_compile items use InboxItemWithCompile for compile button.
             * Order: NEW → NEEDS COMPILE → NEEDS DESTINATION.
             */
            <div className="flex flex-col gap-6">
              {GROUP_ORDER.map((groupKey) => {
                const items = groups[groupKey];
                // P2-12 / F-17: keep group headers rendered even when empty.
                // Return a header with count=0 and a muted "Nothing here" subline
                // so the user can see all three groups at a glance and understand
                // the triage structure even when a group is empty.
                const urgency = items.length > 0 ? deriveGroupUrgency(items) : "normal";
                const tourAttr =
                  groupKey === "needs_fix" ? "inbox-needs-fix-section"
                  : groupKey === "needs_compile" ? "inbox-needs-compile-section"
                  : groupKey === "needs_review" ? "inbox-needs-review-section"
                  : undefined;
                return (
                  <div key={groupKey} {...(tourAttr ? { "data-tour": tourAttr } : {})}>
                  <StatusGroupSection
                    key={groupKey}
                    label={GROUP_LABELS[groupKey]}
                    count={items.length}
                    urgency={urgency}
                    // P1-06 (v2.3 onboarding): section header info tooltip.
                    info={
                      <InfoTooltip
                        content={GROUP_TOOLTIP_CONTENT[groupKey]}
                        side="top"
                        align="start"
                      />
                    }
                    // P1-06 (v2.3 onboarding): urgency badge column explanation.
                    // Placed once on the "new" section header (the first group,
                    // where items arrive fresh and urgency is most actionable).
                    // Per-row wrapping is not possible without modifying the shared
                    // ArtifactCard component (UrgencyBadge is rendered internally
                    // there). A single column-level icon is the least-invasive
                    // approach that surfaces the urgencyBadge copy exactly once
                    // per page load, satisfying AC-4 (PRD §P1-06 count = 7).
                    rightInfo={
                      groupKey === "needs_fix" ? (
                        <InfoTooltip
                          content={TOOLTIP_COPY.inbox.urgencyBadge}
                          icon="info"
                          label="About urgency scores"
                          side="top"
                          align="end"
                        />
                      ) : undefined
                    }
                  >
                    {items.length === 0 ? (
                      // P2-12 / F-17: muted empty-group placeholder so the
                      // triage structure is always visible to the user.
                      <p className="px-1 py-1.5 text-xs text-muted-foreground/60 italic">
                        Nothing here
                      </p>
                    ) : (
                      /*
                       * P2-01: When ≥2 artifacts in this group are compiling
                       * concurrently (within BATCH_WINDOW_MS), wrap them in the
                       * InboxBatchCompileHeader disclosure. The batch only covers
                       * the needs_compile group — the batch state map tracks items
                       * that called onCompileStart, which can only come from
                       * InboxItemWithCompile rows.
                       *
                       * Single-artifact / no-batch: render the existing ul without
                       * any batch chrome (isBatch is false → batch is null).
                       */
                      isBatch && batch && (groupKey === "needs_compile" || groupKey === "needs_fix") ? (
                        <InboxBatchCompileHeader batch={batch}>
                          {items.map((artifact, index) => {
                            const { level, minutesAgo } = deriveItemUrgency(artifact);
                            return (
                              <div
                                key={artifact.id}
                                role="listitem"
                                {...(groupKey === "needs_fix" && index === 0 ? { "data-tour": "inbox-urgency-badge" } : {})}
                              >
                                <InboxItemWithCompile
                                  artifact={artifact}
                                  inboxGroup={groupKey}
                                  urgencyLevel={level}
                                  urgencyMinutesAgo={minutesAgo}
                                  isSelected={selectedItem?.id === artifact.id}
                                  onSelect={handleSelectItem}
                                  onCompileSuccess={handleCompileSuccess}
                                  onCompileStart={handleBatchCompileStart}
                                  onCompileTerminal={handleBatchCompileTerminal}
                                />
                              </div>
                            );
                          })}
                        </InboxBatchCompileHeader>
                      ) : (
                      <ul
                        role="list"
                        aria-label={`${GROUP_LABELS[groupKey]} artifacts`}
                        className="flex flex-col gap-2"
                      >
                        {items.map((artifact, index) => {
                          const { level, minutesAgo } = deriveItemUrgency(artifact);
                          return (
                            <li key={artifact.id} {...(groupKey === "needs_fix" && index === 0 ? { "data-tour": "inbox-urgency-badge" } : {})}>
                              {/*
                               * FE-04: needs_compile and needs_fix groups get
                               * InboxItemWithCompile (includes compile button +
                               * per-item error state). needs_fix items also benefit
                               * from a re-compile action after fixing issues.
                               * All other groups get the plain SelectableCardWrapper.
                               */}
                              {groupKey === "needs_compile" || groupKey === "needs_fix" ? (
                                <InboxItemWithCompile
                                  artifact={artifact}
                                  inboxGroup={groupKey}
                                  urgencyLevel={level}
                                  urgencyMinutesAgo={minutesAgo}
                                  isSelected={selectedItem?.id === artifact.id}
                                  onSelect={handleSelectItem}
                                  onCompileSuccess={handleCompileSuccess}
                                  onCompileStart={handleBatchCompileStart}
                                  onCompileTerminal={handleBatchCompileTerminal}
                                />
                              ) : (
                                <SelectableCardWrapper
                                  artifact={artifact}
                                  inboxGroup={groupKey}
                                  urgencyLevel={level}
                                  urgencyMinutesAgo={minutesAgo}
                                  isSelected={selectedItem?.id === artifact.id}
                                  onSelect={handleSelectItem}
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      )
                    )}
                  </StatusGroupSection>
                  </div>
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
                  // P3-07 / F-24: h-11 (44px) meets WCAG touch-target parity
                  // with the page header controls.
                  "inline-flex h-11 items-center gap-1.5 rounded-md border px-4",
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

          {/* P3-05 / P3-06: Recently processed artifacts (past 24 h).
              P1-06: sectionProcessed tooltip wired via the info slot. */}
          <div data-tour="inbox-processed-section">
          <ProcessedSection
            items={processedItems}
            info={
              <InfoTooltip
                content={TOOLTIP_COPY.inbox.sectionProcessed}
                side="top"
                align="start"
              />
            }
          />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Right: ContextRail — hidden below xl (P5-03)                    */}
        {/* The rail fills 100% of its column; parent controls breakpoint.  */}
        {/* ---------------------------------------------------------------- */}
        <aside
          aria-label="Inbox item context"
          className="hidden w-72 shrink-0 xl:block"
        >
          <InboxContextRail selectedItem={selectedItem} onMoveSuccess={removeArtifact} />
        </aside>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Quick Add modal (form wiring is P3-04)                             */}
      {/* ------------------------------------------------------------------ */}
      <QuickAddModal open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </>
  );
}
