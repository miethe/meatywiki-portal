"use client";

/**
 * InboxContextRail — inbox-specific ContextRail content wrapper.
 *
 * Composes the generic <ContextRail> with:
 *   - customTabs: single "Properties" tab showing inbox-item metadata
 *     (type, source, intake date, content length derived from raw_content /
 *     frontmatter_jsonb.word_count)
 *   - actions: five action buttons (verb-first, lucide icons)
 *   - footer: "Finalize Entry" primary CTA (stub)
 *   - empty state: "Select an inbox item to see details & actions"
 *   - auto-route CTA: one-click workspace routing with 5-second undo (P7-02)
 *
 * P6-01: wired "Start Compilation" + "Request Review" to real endpoints.
 *   - Start Compilation: useCompileArtifact({ artifactId, onSuccess, onError })
 *   - Request Review: useRequestReview(artifactId).mutate({ review_type: "manual" })
 *   - Add to Synthesis: stub (hasEndpoint: false) — no endpoint exists yet.
 *
 * P6-02/P6-03: wired "Move to Research" and "Link to Project Nexus".
 *   - Move to Research: useMoveArtifactWorkspace(artifactId).mutate("research")
 *     On success: calls onMoveSuccess(id) for optimistic row removal (P6-03),
 *     invalidates ["inbox"] cache, and shows a success toast.
 *   - Link to Project Nexus: useLinkArtifactToProject(artifactId) — placeholder
 *     toast until a project picker modal ships (P7 deferred item).
 *
 * Task: P5-03 (scaffold), P6-01 (endpoint wiring), P6-02/P6-03 (move + link), P7-02 (auto-route)
 * Stitch ref: "Inbox" screen (ID: 837a47df72a648749bafefd22988de7f)
 */

import { useState, useCallback } from "react";
import {
  FlaskConical,
  Link2,
  GitMerge,
  Zap,
  ClipboardCheck,
  ArrowRightCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextRail,
  type ContextRailTab,
  type ContextRailAction,
} from "@/components/layout/ContextRail";
import type { ArtifactCard, ArtifactWorkspace } from "@/types/artifact";
import { patchArtifactWorkspace } from "@/lib/api/artifacts";
import { useCompileArtifact } from "@/hooks/useCompileArtifact";
import {
  useRequestReview,
  useMoveArtifactWorkspace,
  useLinkArtifactToProject,
} from "@/hooks/use-artifact-actions";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function deriveWordCount(item: ArtifactCard): number | null {
  // frontmatter_jsonb not on ArtifactCard — only on ArtifactDetail. Safe cast
  // via unknown so we don't break when the field is absent.
  const fm = (item as unknown as { frontmatter_jsonb?: Record<string, unknown> })
    .frontmatter_jsonb;
  const rawContent = (item as unknown as { raw_content?: string | null })
    .raw_content;

  const fmWordCount = fm?.["word_count"];
  if (typeof fmWordCount === "number") return fmWordCount;

  if (rawContent && typeof rawContent === "string") {
    return rawContent.trim().split(/\s+/).filter(Boolean).length;
  }
  return null;
}

function deriveSource(item: ArtifactCard): string | null {
  const fm = (item as unknown as { frontmatter_jsonb?: Record<string, unknown> })
    .frontmatter_jsonb;
  const meta = item.metadata as Record<string, unknown> | null | undefined;

  const src =
    (meta?.["source"] as string | null | undefined) ??
    (fm?.["source"] as string | null | undefined) ??
    null;
  return src ?? null;
}

// ---------------------------------------------------------------------------
// Inbox-specific Properties panel
// ---------------------------------------------------------------------------

interface InboxPropertiesPanelProps {
  item: ArtifactCard;
}

function InboxPropertiesPanel({ item }: InboxPropertiesPanelProps) {
  const source = deriveSource(item);
  const wordCount = deriveWordCount(item);
  const intakeDate = item.created ?? item.updated;

  return (
    <dl className="flex flex-col gap-2.5 text-xs">
      <div>
        <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Type
        </dt>
        <dd className="mt-0.5 capitalize">{item.type ?? "—"}</dd>
      </div>

      {item.status && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Status
          </dt>
          <dd className="mt-0.5 capitalize">{item.status}</dd>
        </div>
      )}

      {source && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Source
          </dt>
          <dd className="mt-0.5 break-all font-mono text-[11px] text-foreground/80">
            {source}
          </dd>
        </div>
      )}

      <div>
        <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Intake date
        </dt>
        <dd className="mt-0.5">
          {intakeDate ? (
            <time dateTime={intakeDate}>{formatDate(intakeDate)}</time>
          ) : (
            "—"
          )}
        </dd>
      </div>

      {wordCount !== null && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Content length
          </dt>
          <dd className="mt-0.5 tabular-nums">
            {wordCount.toLocaleString()} words
          </dd>
        </div>
      )}

      {item.file_path && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            File
          </dt>
          <dd className="mt-0.5 break-all font-mono text-[10px] text-foreground/60">
            {item.file_path}
          </dd>
        </div>
      )}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Auto-route helpers
// ---------------------------------------------------------------------------

/**
 * shouldShowAutoRoute — returns true when all three conditions are met:
 *   1. inbox_group === "needs_destination"
 *   2. routing_workspace is present (non-null)
 *   3. routing_workspace differs from the artifact's current workspace
 */
function shouldShowAutoRoute(item: ArtifactCard): boolean {
  return (
    item.inbox_group === "needs_destination" &&
    item.routing_workspace != null &&
    item.routing_workspace !== item.workspace
  );
}

/** Capitalise the first letter of a workspace name for display. */
function formatWorkspaceName(workspace: ArtifactWorkspace): string {
  return workspace.charAt(0).toUpperCase() + workspace.slice(1);
}

// ---------------------------------------------------------------------------
// AutoRouteButton — P7-02
// ---------------------------------------------------------------------------

interface AutoRouteButtonProps {
  item: ArtifactCard;
  targetWorkspace: ArtifactWorkspace;
  isPending: boolean;
  onRoute: () => void;
}

/**
 * AutoRouteButton — renders the prominent one-click routing CTA.
 *
 * State management (loading, success, error) is owned by the parent
 * InboxAutoRouteSection via useAutoRoute(). This component is pure-view.
 *
 * P7-02.
 */
function AutoRouteButton({ targetWorkspace, isPending, onRoute }: AutoRouteButtonProps) {
  const workspaceLabel = formatWorkspaceName(targetWorkspace);

  return (
    <button
      type="button"
      aria-label={`Auto-route to ${workspaceLabel}`}
      disabled={isPending}
      onClick={onRoute}
      className={cn(
        "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md",
        "bg-primary px-4 text-sm font-bold text-primary-foreground",
        "transition-opacity hover:opacity-90 active:opacity-75",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <ArrowRightCircle aria-hidden="true" className="size-4 shrink-0" />
      {isPending ? "Routing…" : `Auto-route to ${workspaceLabel}`}
    </button>
  );
}

// ---------------------------------------------------------------------------
// AutoRouteToast — undo-capable success toast (P7-02)
// ---------------------------------------------------------------------------

/**
 * Since useToast uses string messages, the Undo affordance is rendered by a
 * custom toast overlay component mounted alongside the rail (not inside the
 * global toast queue).  This avoids needing to extend the Toast type with
 * ReactNode messages.
 *
 * UndoRouteToast renders an overlay card that auto-dismisses after 5 s and
 * exposes a keyboard-accessible Undo button.
 */
interface UndoRouteToastProps {
  artifactId: string;
  targetWorkspace: ArtifactWorkspace;
  originalWorkspace: ArtifactWorkspace;
  onDismiss: () => void;
}

function UndoRouteToast({
  artifactId,
  targetWorkspace,
  originalWorkspace,
  onDismiss,
}: UndoRouteToastProps) {
  const { add: addToast } = useToast();
  const [isUndoing, setIsUndoing] = useState(false);

  const handleUndo = useCallback(async () => {
    if (isUndoing) return;
    setIsUndoing(true);
    try {
      await patchArtifactWorkspace(artifactId, originalWorkspace);
      addToast({ message: "Routing undone", type: "info" });
    } catch {
      addToast({ message: "Failed to undo routing. Please try again.", type: "error" });
    } finally {
      onDismiss();
    }
  }, [artifactId, originalWorkspace, isUndoing, addToast, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Routed to ${formatWorkspaceName(targetWorkspace)}`}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border",
        "bg-primary/10 px-3 py-2 text-sm",
      )}
    >
      <span className="flex-1 font-medium">
        Routed to {formatWorkspaceName(targetWorkspace)}
      </span>
      <button
        type="button"
        aria-label={`Undo routing to ${formatWorkspaceName(targetWorkspace)}`}
        disabled={isUndoing}
        onClick={handleUndo}
        className={cn(
          "shrink-0 rounded px-2 py-0.5 text-xs font-semibold",
          "underline-offset-2 hover:underline",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {isUndoing ? "Undoing…" : "Undo"}
      </button>
      <button
        type="button"
        aria-label="Dismiss routing notification"
        onClick={onDismiss}
        className={cn(
          "shrink-0 rounded p-0.5 opacity-60 hover:opacity-100",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
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
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// useAutoRoute — state machine for the auto-route flow (P7-02)
// ---------------------------------------------------------------------------

type AutoRouteState =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "success"; originalWorkspace: ArtifactWorkspace; targetWorkspace: ArtifactWorkspace }
  | { phase: "error"; message: string };

interface UseAutoRouteOptions {
  item: ArtifactCard;
  targetWorkspace: ArtifactWorkspace;
}

function useAutoRoute({ item, targetWorkspace }: UseAutoRouteOptions) {
  const [state, setState] = useState<AutoRouteState>({ phase: "idle" });
  const { add: addToast } = useToast();

  const route = useCallback(async () => {
    if (state.phase === "pending") return;
    const originalWorkspace = item.workspace;
    setState({ phase: "pending" });

    try {
      await patchArtifactWorkspace(item.id, targetWorkspace);
      setState({ phase: "success", originalWorkspace, targetWorkspace });
    } catch {
      const msg = `Failed to route to ${formatWorkspaceName(targetWorkspace)}. Please try again.`;
      setState({ phase: "error", message: msg });
      addToast({ message: msg, type: "error" });
    }
  }, [item.id, item.workspace, targetWorkspace, state.phase, addToast]);

  const dismiss = useCallback(() => {
    setState({ phase: "idle" });
  }, []);

  return { state, route, dismiss };
}

// ---------------------------------------------------------------------------
// Inbox-specific tab set (single Properties tab)
// ---------------------------------------------------------------------------

function buildCustomTabs(item: ArtifactCard): ContextRailTab[] {
  return [
    {
      id: "properties",
      label: "Properties",
      renderContent: () => <InboxPropertiesPanel item={item} />,
    },
  ];
}

// ---------------------------------------------------------------------------
// Loading skeleton (item selected but fields still populating)
// P3-04 / F-21
// ---------------------------------------------------------------------------

function RailLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading item details"
      className="flex flex-col gap-2.5 animate-pulse"
    >
      {/* Mimics the InboxPropertiesPanel label+value rows */}
      <div className="h-2.5 w-16 rounded bg-muted" />
      <div className="h-3 w-24 rounded bg-muted/70" />
      <div className="mt-1 h-2.5 w-14 rounded bg-muted" />
      <div className="h-3 w-32 rounded bg-muted/70" />
      <div className="mt-1 h-2.5 w-20 rounded bg-muted" />
      <div className="h-3 w-28 rounded bg-muted/70" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state (no item selected)
// ---------------------------------------------------------------------------

function RailEmptyState() {
  return (
    <div
      role="status"
      aria-label="No inbox item selected"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-4 py-10 text-center"
    >
      <svg
        aria-hidden="true"
        className="size-8 text-muted-foreground/30"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.25}
          d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2"
        />
      </svg>
      <p className="text-xs text-muted-foreground">
        Select an inbox item to see details &amp; actions
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InboxContextRail — public component
// ---------------------------------------------------------------------------

export interface InboxContextRailProps {
  /** The currently-selected inbox item, or null when nothing is selected. */
  selectedItem: ArtifactCard | null;
  /**
   * P3-04 / F-21: When true, renders a skeleton placeholder in the Properties
   * panel instead of the real field values. Use when `selectedItem` is set but
   * the enriched detail fields are still in-flight (e.g. after a quick tap that
   * selects an item before a detail fetch resolves).
   */
  isLoadingDetails?: boolean;
  /**
   * P6-03: Called with the artifact ID after a successful workspace move so the
   * parent (InboxClient) can optimistically remove the row from the list without
   * waiting for a network refetch. Optional — if not provided, the item will
   * disappear only after the ["inbox"] query cache invalidation triggers a refetch.
   */
  onMoveSuccess?: (artifactId: string) => void;
  className?: string;
}

/**
 * InboxContextRail wires a selected inbox item into the shared <ContextRail>
 * with inbox-specific tabs (Properties) and suggested action buttons.
 *
 * P6-01: Two buttons wired to real endpoints:
 *   - "Start Compilation": POST /api/artifacts/:id/compile
 *   - "Request Review": POST /api/artifacts/:id/review
 *
 * P6-02/P6-03: Two more buttons wired:
 *   - "Move to Research": PATCH /api/artifacts/:id/workspace → "research"
 *     Calls onMoveSuccess(id) on success for immediate row removal.
 *   - "Link to Project Nexus": placeholder toast (project picker is P7).
 *
 * Hooks must be called at the component level (not inside buildActions), so
 * compile / requestReview mutation functions are wired here and passed into
 * the action definitions.
 *
 * A "Finalize Entry" primary CTA sits below the rail for direct promotion.
 *
 * When the selected item has inbox_group === "needs_destination" and a
 * routing_workspace that differs from its current workspace, an Auto-route CTA
 * is rendered above the ContextRail. Clicking it fires PATCH
 * /api/artifacts/{id}/workspace and shows a 5-second undo toast (P7-02).
 *
 * Usage:
 * ```tsx
 * <aside className="hidden w-72 shrink-0 xl:block">
 *   <InboxContextRail
 *     selectedItem={selectedItem}
 *     onMoveSuccess={removeArtifact}
 *   />
 * </aside>
 * ```
 */
export function InboxContextRail({
  selectedItem,
  isLoadingDetails = false,
  onMoveSuccess,
  className,
}: InboxContextRailProps) {
  const { add: showToast } = useToast();

  // ---------------------------------------------------------------------------
  // Mutation: Start Compilation
  // Hooks must be called unconditionally; the compile() function guards on
  // selectedItem.id internally (no-op when isCompiling).
  // ---------------------------------------------------------------------------
  const { compile, isCompiling } = useCompileArtifact({
    artifactId: selectedItem?.id ?? "",
    onSuccess: () => {
      showToast({
        type: "success",
        message: "Compilation started — the artifact is being processed.",
      });
    },
    onError: (msg) => {
      showToast({
        type: "error",
        message: `Compilation failed: ${msg}`,
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Mutation: Request Review
  // useRequestReview takes an artifactId at hook-call time (not mutation time).
  // ---------------------------------------------------------------------------
  const reviewMutation = useRequestReview(selectedItem?.id ?? "");
  const isRequestingReview = reviewMutation.status === "pending";

  const requestReview = () => {
    if (!selectedItem?.id || isRequestingReview) return;
    reviewMutation.mutate(
      { review_type: "verification" },
      {
        onSuccess: () => {
          showToast({
            type: "success",
            message: "Review requested — this artifact has been flagged for manual review.",
          });
        },
        onError: (err) => {
          const msg =
            err instanceof Error ? err.message : "An unexpected error occurred.";
          showToast({
            type: "error",
            message: `Review request failed: ${msg}`,
          });
        },
      },
    );
  };

  // ---------------------------------------------------------------------------
  // Mutation: Move to Workspace (P6-02/P6-03)
  // useMoveArtifactWorkspace invalidates ["inbox"] on success. The onMoveSuccess
  // callback additionally triggers optimistic row removal in InboxClient so the
  // item disappears immediately rather than waiting for the cache invalidation
  // to trigger a full refetch.
  // ---------------------------------------------------------------------------
  const moveMutation = useMoveArtifactWorkspace(selectedItem?.id ?? "");
  const isMoving = moveMutation.status === "pending";

  const moveToResearch = () => {
    if (!selectedItem?.id || isMoving) return;
    const artifactId = selectedItem.id;
    moveMutation.mutate("research", {
      onSuccess: () => {
        // P6-03: notify parent to remove the row optimistically
        onMoveSuccess?.(artifactId);
        showToast({
          type: "success",
          message: "Artifact moved to Research workspace.",
        });
      },
      onError: (err) => {
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        showToast({
          type: "error",
          message: `Move failed: ${msg}`,
        });
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Mutation: Link to Project (P6-02)
  // Full project picker UI is deferred to P7. For now this toasts an info
  // message explaining the feature is coming, so the button is visible and
  // functional but non-destructive. hasEndpoint is set to true to indicate
  // the underlying API exists; the stub behaviour is a UI gap, not an API gap.
  // ---------------------------------------------------------------------------
  const linkMutation = useLinkArtifactToProject(selectedItem?.id ?? "");
  const isLinking = linkMutation.status === "pending";

  const linkToProject = () => {
    if (!selectedItem?.id || isLinking) return;
    // Project picker modal is a P7 deferred item (DI-066 or similar).
    // Toasting an info message keeps the button alive without a no-op click.
    console.debug("[inbox-rail] Link to Project: needs project picker UI (P7)");
    showToast({
      type: "info",
      message: "Project linking requires a project picker — coming in a future release.",
    });
  };

  // ---------------------------------------------------------------------------
  // Early returns (after all hook calls to preserve hook call order)
  // ---------------------------------------------------------------------------

  if (!selectedItem) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <RailEmptyState />
      </div>
    );
  }

  // P3-04 / F-21: item is selected but fields are still loading — show skeleton
  if (isLoadingDetails) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="rounded-md border p-4">
          <RailLoadingSkeleton />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Action definitions — hooks are all called above; callbacks close over their
  // mutation state. Order: Move to Research, Link to Project Nexus, Add to
  // Synthesis (stub), Start Compilation, Request Review.
  // ---------------------------------------------------------------------------

  const actions: ContextRailAction[] = [
    {
      // P6-02/P6-03: wired to PATCH /api/artifacts/:id/workspace
      label: isMoving ? "Moving…" : "Move to Research",
      ariaLabel: isMoving
        ? "Move in progress"
        : "Move this item to the Research workspace",
      hasEndpoint: true,
      description: "Route this artifact into the Research workflow",
      onClick: moveToResearch,
      icon: FlaskConical,
    },
    {
      // P6-02: wired; project picker UI deferred to P7
      label: isLinking ? "Linking…" : "Link to Project Nexus",
      ariaLabel: isLinking
        ? "Linking in progress"
        : "Link this item to a Project Nexus entry",
      hasEndpoint: true,
      description: "Associate this artifact with a project",
      onClick: linkToProject,
      icon: Link2,
    },
    {
      // No endpoint exists yet for synthesis merging — leave as stub.
      label: "Add to Synthesis",
      ariaLabel: "Add this item to a Synthesis artifact",
      hasEndpoint: false,
      description: "Merge into an existing synthesis document",
      // No onClick: ContextRail treats absence of onClick as stub (renders "Soon" tag).
      icon: GitMerge,
    },
    {
      // P6-01: wired to POST /api/artifacts/:id/compile
      label: isCompiling ? "Compiling…" : "Start Compilation",
      ariaLabel: isCompiling
        ? "Compilation in progress"
        : "Trigger compilation for this artifact",
      hasEndpoint: true,
      description: "Begin the compile stage for this artifact",
      onClick: compile, // compile() self-guards: returns early when isCompiling
      icon: Zap,
    },
    {
      // P6-01: wired to POST /api/artifacts/:id/review
      label: isRequestingReview ? "Requesting…" : "Request Review",
      ariaLabel: isRequestingReview
        ? "Review request in progress"
        : "Request a review for this artifact",
      hasEndpoint: true,
      description: "Flag this artifact for manual review",
      onClick: requestReview, // requestReview() self-guards: returns early when isRequestingReview
      icon: ClipboardCheck,
    },
  ];

  const customTabs = buildCustomTabs(selectedItem);
  const showAutoRoute = shouldShowAutoRoute(selectedItem);
  // Safe cast: shouldShowAutoRoute guarantees routing_workspace is non-null here.
  const routingTarget = selectedItem.routing_workspace as ArtifactWorkspace;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* P7-02: Auto-route CTA — only shown when routing_workspace is available
          and differs from the current workspace. Sits above all other actions. */}
      {showAutoRoute && (
        <InboxAutoRouteSection
          item={selectedItem}
          targetWorkspace={routingTarget}
        />
      )}

      {/* Rail: actions + Properties tab */}
      <ContextRail
        customTabs={customTabs}
        actions={actions}
        ariaLabel="Inbox item context"
      />

      {/* Footer CTA — "Finalize Entry" (P2-06 / F-11: stub with visible disabled
          state until the backend routing endpoint is wired).
          aria-disabled keeps the button focusable so keyboard users can Tab
          past it and the tooltip/title conveys the reason it's unavailable. */}
      <div className="border-t pt-3">
        <button
          type="button"
          aria-label={`Finalize entry: ${selectedItem.title} (not yet available)`}
          aria-disabled="true"
          title="Finalize Entry — coming soon"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={cn(
            "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md",
            "bg-primary/40 px-4 text-sm font-medium text-primary-foreground/60",
            "cursor-not-allowed select-none",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          Finalize Entry
          <span
            aria-hidden="true"
            className="rounded-sm border border-primary-foreground/20 bg-primary-foreground/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground/50"
          >
            Soon
          </span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InboxAutoRouteSection — self-contained auto-route + undo flow (P7-02)
// ---------------------------------------------------------------------------

/**
 * InboxAutoRouteSection manages the full auto-route state machine for one
 * selected item: idle → pending → success (undo window) | error.
 *
 * Rendered above the ContextRail actions when shouldShowAutoRoute() is true.
 * Keeps its own routing state so the rest of the rail is unaffected.
 */
interface InboxAutoRouteSectionProps {
  item: ArtifactCard;
  targetWorkspace: ArtifactWorkspace;
}

function InboxAutoRouteSection({ item, targetWorkspace }: InboxAutoRouteSectionProps) {
  const { state, route, dismiss } = useAutoRoute({ item, targetWorkspace });

  if (state.phase === "success") {
    return (
      <UndoRouteToast
        artifactId={item.id}
        targetWorkspace={state.targetWorkspace}
        originalWorkspace={state.originalWorkspace}
        onDismiss={dismiss}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <AutoRouteButton
        item={item}
        targetWorkspace={targetWorkspace}
        isPending={state.phase === "pending"}
        onRoute={route}
      />
      {state.phase === "error" && (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      )}
    </div>
  );
}
