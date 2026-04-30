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

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { StatusGroupSection } from "@/components/ui/status-group-section";
import { QuickAddModal } from "@/components/quick-add/quick-add-modal";
import { InboxContextRail } from "@/components/inbox/InboxContextRail";
import { useInboxArtifacts } from "@/hooks/useInboxArtifacts";
import { useCompileArtifact } from "@/hooks/useCompileArtifact";
import type { ServiceModeEnvelope, ArtifactCard as ArtifactCardType } from "@/types/artifact";
import type { UrgencyLevel } from "@/components/ui/urgency-badge";

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
  // FE-04: forward-compat for needs_review status (maps to compile group)
  needs_review: "needs_compile",
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
// CompileButton — FE-04
// ---------------------------------------------------------------------------

/**
 * CompileButton owns its own useCompileArtifact state so each inbox item
 * can be independently compiling without lifting all compile state to the
 * parent. This is Option (a) from the FE-04 task spec.
 *
 * Lifecycle:
 *   idle      → "Compile" button shown
 *   compiling → spinner + "Compiling…" label, button disabled
 *   success   → "Compiled ✓" shown for 3 s, then reverts to idle
 *               (parent also receives onSuccess callback to trigger optimistic update)
 *   error     → parent receives onError callback; button reverts to idle
 *
 * Accessibility:
 *   - aria-busy on the button during in-flight request
 *   - aria-label includes artifact title for screen-reader context
 *   - pointer-events-auto: sits inside the ArtifactCard stretch-link overlay,
 *     so onClick must stopPropagation to prevent navigation.
 */
interface CompileButtonProps {
  artifactId: string;
  artifactTitle: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function CompileButton({
  artifactId,
  artifactTitle,
  onSuccess,
  onError,
}: CompileButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { compile, isCompiling } = useCompileArtifact({
    artifactId,
    onSuccess: () => {
      setShowSuccess(true);
      // Auto-clear success label after 3 s
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
      onSuccess();
    },
    onError,
  });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const label = isCompiling ? "Compiling…" : showSuccess ? "Compiled ✓" : "Compile";
  const ariaLabel = isCompiling
    ? `Compilation in progress for ${artifactTitle}`
    : showSuccess
    ? `Compilation queued for ${artifactTitle}`
    : `Compile ${artifactTitle}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-busy={isCompiling}
      disabled={isCompiling}
      onClick={(e) => {
        // Prevent the ArtifactCard stretch link from navigating
        e.preventDefault();
        e.stopPropagation();
        if (!isCompiling && !showSuccess) {
          compile();
        }
      }}
      className={cn(
        "pointer-events-auto inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5",
        "text-xs font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isCompiling || showSuccess
          ? "cursor-not-allowed opacity-70 text-muted-foreground border-border"
          : "text-foreground hover:bg-accent hover:text-accent-foreground",
        showSuccess && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
      )}
    >
      {isCompiling && (
        // Inline spinner — CSS animation, no extra dependency
        <svg
          aria-hidden="true"
          className="size-3 animate-spin"
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
      )}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SelectableCardWrapper — thin a11y wrapper (P5-03)
// ---------------------------------------------------------------------------

/**
 * Wraps an ArtifactCard in a <button> so it is click + keyboard selectable.
 * We prefer a real <button> for native keyboard semantics (Enter/Space fires
 * onClick automatically) without manual onKeyDown handlers.
 *
 * Selected state adds a primary ring so the selected item is unmistakable
 * without relying on colour alone (WCAG 1.4.1).
 *
 * FE-04: compileButton is rendered as a sibling below the card (not inside
 * the button) to keep the DOM valid (no interactive content inside <button>).
 * The error message is also rendered as a sibling below the card row.
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
  /** FE-04: inline error text shown below the card row */
  compileError?: string | null;
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
}: SelectableCardWrapperProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="relative">
        <button
          type="button"
          aria-pressed={isSelected}
          aria-label={`Select inbox item: ${artifact.title}`}
          onClick={() => onSelect(artifact)}
          className={cn(
            "w-full text-left rounded-md transition-all",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
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
          />
        </button>
      </div>

      {/* FE-04: Inline compile error — shown below card row, auto-cleared by parent */}
      {compileError && (
        <p
          role="alert"
          aria-live="assertive"
          className="px-3 text-xs text-destructive"
        >
          {compileError}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InboxItemWithCompile — FE-04
// ---------------------------------------------------------------------------

/**
 * Thin wrapper that combines SelectableCardWrapper with CompileButton for
 * items in the needs_compile group. Owns the per-item compile error state
 * and the 5 s auto-clear timer for it.
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
}

function InboxItemWithCompile({
  artifact,
  inboxGroup,
  urgencyLevel,
  urgencyMinutesAgo,
  isSelected,
  onSelect,
  onCompileSuccess,
}: InboxItemWithCompileProps) {
  const [itemError, setItemError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleError = useCallback((msg: string) => {
    setItemError(msg);
    // Auto-clear after 5 s
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setItemError(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const compileSlot = (
    <CompileButton
      artifactId={artifact.id}
      artifactTitle={artifact.title}
      onSuccess={() => onCompileSuccess(artifact.id)}
      onError={handleError}
    />
  );

  return (
    <SelectableCardWrapper
      artifact={artifact}
      inboxGroup={inboxGroup}
      urgencyLevel={urgencyLevel}
      urgencyMinutesAgo={urgencyMinutesAgo}
      isSelected={isSelected}
      onSelect={onSelect}
      compileSlot={compileSlot}
      compileError={itemError}
    />
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

  // P5-03: selected item state — null until data loads, then auto-selects first.
  const [selectedItem, setSelectedItem] = useState<ArtifactCardType | null>(null);

  const { artifacts, hasMore, isLoading, error, loadMore, optimisticUpdateArtifact } =
    useInboxArtifacts({ initialData });

  // P5-01: Group artifacts by inbox status. Recalculates only when the
  // artifacts array reference changes (load-more appends a new array).
  const groups = useMemo(() => groupArtifacts(artifacts), [artifacts]);

  const handleSelectItem = useCallback((artifact: ArtifactCardType) => {
    setSelectedItem(artifact);
  }, []);

  /**
   * FE-04: Optimistically move an artifact from needs_compile → needs_destination
   * after a successful compile trigger. We use "stale" since that maps to
   * needs_destination in STATUS_TO_GROUP (matches the compile→destination flow).
   *
   * This gives instant visual feedback (item moves groups) without a network
   * roundtrip. If the backend returns a different status on next page load that
   * is fine — the data will reconcile on refresh.
   */
  const handleCompileSuccess = useCallback(
    (artifactId: string) => {
      optimisticUpdateArtifact(artifactId, { status: "stale" });
    },
    [optimisticUpdateArtifact],
  );

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
                      {items.map((artifact) => {
                        const { level, minutesAgo } = deriveItemUrgency(artifact);
                        return (
                          <li key={artifact.id}>
                            {/*
                             * FE-04: needs_compile group gets InboxItemWithCompile
                             * (includes compile button + per-item error state).
                             * All other groups get the plain SelectableCardWrapper.
                             */}
                            {groupKey === "needs_compile" ? (
                              <InboxItemWithCompile
                                artifact={artifact}
                                inboxGroup={groupKey}
                                urgencyLevel={level}
                                urgencyMinutesAgo={minutesAgo}
                                isSelected={selectedItem?.id === artifact.id}
                                onSelect={handleSelectItem}
                                onCompileSuccess={handleCompileSuccess}
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

        {/* ---------------------------------------------------------------- */}
        {/* Right: ContextRail — hidden below xl (P5-03)                    */}
        {/* The rail fills 100% of its column; parent controls breakpoint.  */}
        {/* ---------------------------------------------------------------- */}
        <aside
          aria-label="Inbox item context"
          className="hidden w-72 shrink-0 xl:block"
        >
          <InboxContextRail selectedItem={selectedItem} />
        </aside>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Quick Add modal (form wiring is P3-04)                             */}
      {/* ------------------------------------------------------------------ */}
      <QuickAddModal open={quickAddOpen} onOpenChange={setQuickAddOpen} />
    </>
  );
}
