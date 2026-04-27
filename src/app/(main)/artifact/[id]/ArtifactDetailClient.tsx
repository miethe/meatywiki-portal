"use client";

/**
 * ArtifactDetailClient — fully interactive Artifact Detail screen.
 *
 * Implements P3-06 scope:
 *   - GET /api/artifacts/:id via useArtifact (TanStack Query)
 *   - Loading skeleton, 404 state, generic error state
 *   - Tabs: Source | Knowledge | Draft | Workflow OS | Backlinks
 *   - Source Reader: raw markdown in <pre><code> with monospace styling
 *   - Knowledge Reader: compiled content (compiled_content field)
 *   - Draft Reader: synthesis/draft content or empty state if absent
 *   - Workflow OS tab: WorkflowOSTab (P4-10)
 *   - Backlinks tab: server-side GET /api/artifacts/:id/backlinks with
 *     client-side edge-walk fallback (P7-04)
 *   - Action buttons: Promote, Link, Review (have backend endpoints — disabled
 *     in v1 until POST handlers are wired to UI state); Compile Now + Lint Scope
 *     are engine triggers (deferred to P3-07); all show "not yet wired" tooltip
 *   - HandoffChain in sidebar using artifact_edges
 *
 * P4-04 additions:
 *   - HandoffChainRibbon: horizontal stage pill row between badge row and tabs
 *   - ActivityTimeline: inline activity feed below body/rail grid
 *   - Metadata sidebar: id (copy), created_at, updated_at, status, tags
 *   - Responsive: tabs natural flow on mobile, sidebar hidden on small screens
 *
 * P7-04 additions:
 *   - Backlinks tab: useArtifactBacklinks hook with server-side primary path
 *     and transparent client-side fallback on 404/network error.
 *   - Optional edge_type filter dropdown in Backlinks tab.
 *
 * P2-02 additions (pipeline observability):
 *   - "Processing" tab added after Backlinks, before Derivatives.
 *   - Renders ProcessingHistoryTab which fetches /api/artifacts/:id/processing-history.
 *   - Tab uses `hidden` attribute; TanStack Query caches data across tab switches.
 *
 * P2-06 additions (v1.8 inline editing):
 *   - All 12 editable fields wired with inline-edit components.
 *   - ETag state initialised from GET response header via fetchArtifactEtag.
 *   - Optimistic TanStack Query cache updates with rollback on error.
 *   - Minimal in-component toast notifications (no external library).
 *
 * Rendering decisions:
 *   - raw_content: displayed in <pre><code> block — no dangerouslySetInnerHTML.
 *   - compiled_content: rendered via ArticleViewer from @miethe/ui (PU6-01).
 *     ArticleViewer handles HTML sanitization internally (rehype-sanitize).
 *     No dangerouslySetInnerHTML on any markdown content path.
 *   - draft_content: same as compiled_content — ArticleViewer with variant="editorial".
 *   - format="auto": ArticleViewer detects HTML vs markdown automatically.
 *
 * Stitch references:
 *   - "Artifact Detail" (ID: 7b5a1a093d1c454c96c913367c7e60fe)
 *   - "Research Artifact - Workflow OS Enhanced" (ID: ee5b9ed70061402c99b091998f9002d8)
 *
 * WCAG 2.1 AA: shadcn-style tab semantics; focusable action buttons with
 * aria-disabled; copy button with aria-live announcement.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  StickyNote,
  Archive,
  Link2,
  CheckSquare,
  FileText,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import { TypeBadge } from "@/components/ui/type-badge";
import { WorkspaceBadge } from "@/components/ui/workspace-badge";
import { WorkflowOSTab } from "@/components/workflow/workflow-os-tab";
import { useArtifact } from "@/hooks/useArtifact";
import { useDerivatives } from "@/hooks/useDerivatives";
import { DerivativesList } from "@/components/workflow/derivatives-list";
import { ArtifactFreshnessBadge } from "@/components/artifact/freshness-badge";
import { ContradictionFlag } from "@/components/artifact/contradiction-flag";
import { ContextRail, type ContextRailAction } from "@/components/layout/ContextRail";
import { ArtifactTitleBlock } from "@/components/artifact/artifact-title-block";
import {
  useArtifactBacklinks,
  KNOWN_EDGE_TYPES,
  type BacklinkItem,
} from "@/hooks/useArtifactBacklinks";
import type { EdgeType } from "@/hooks/useArtifactEdges";
import { ArticleViewer } from "@miethe/ui";
import { HandoffChainRibbon } from "@/components/artifact/handoff-chain-ribbon";
import { ActivityTimeline } from "@/components/artifact/activity-timeline";
import { ProcessingHistoryTab } from "@/components/artifact/processing-history-tab";
import { useCompileArtifact } from "@/hooks/useCompileArtifact";
import {
  InlineTextField,
  InlineTextarea,
  InlineSelect,
  InlineChipEditor,
} from "@/components/inline-edit";
import type { ArtifactPatchFields } from "@/lib/api/artifacts";
import { useArtifactFieldSave } from "./useArtifactFieldSave";
import type { ArtifactDetail } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Source-type classification (mirrors API-01 service-layer predicates)
// Source types: raw_* prefix + source_summary
// ---------------------------------------------------------------------------

const SOURCE_TYPES = new Set([
  "raw_note",
  "raw_url",
  "raw_upload",
  "raw_transcript",
  "raw_import",
  "source_summary",
]);

function isSourceType(artifactType: string): boolean {
  return SOURCE_TYPES.has(artifactType) || artifactType.startsWith("raw_");
}

// ---------------------------------------------------------------------------
// Edge type label map (shared with backlinks UI)
// ---------------------------------------------------------------------------

const EDGE_TYPE_LABELS: Record<string, string> = {
  derived_from: "Derived from",
  supports: "Supports",
  relates_to: "Relates to",
  supersedes: "Supersedes",
  contradicts: "Contradicts",
  contains: "Contains",
};

const EDGE_TYPE_COLOURS: Record<string, string> = {
  derived_from: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  supports: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  relates_to: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  supersedes: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  contradicts: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  contains: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

function EdgeTypeBadge({ edgeType }: { edgeType: EdgeType }) {
  const label = EDGE_TYPE_LABELS[edgeType] ?? edgeType;
  const colour = EDGE_TYPE_COLOURS[edgeType] ?? "bg-muted text-muted-foreground";
  return (
    <span
      aria-label={`Edge type: ${label}`}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        colour,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tab definition
// ---------------------------------------------------------------------------

const BASE_TABS = ["Source", "Knowledge", "Draft", "Workflow OS", "Backlinks", "Processing"] as const;
type TabId = (typeof BASE_TABS)[number] | "Derivatives";

function tabPanelId(tab: TabId) {
  return `artifact-tab-panel-${tab.toLowerCase().replace(/\s+/g, "-")}`;
}
function tabButtonId(tab: TabId) {
  return `artifact-tab-btn-${tab.toLowerCase().replace(/\s+/g, "-")}`;
}

// ---------------------------------------------------------------------------
// Inline-edit select options (enum values from backend schemas/core.py)
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "superseded", label: "Superseded" },
];

const WORKSPACE_OPTIONS = [
  { value: "inbox", label: "Inbox" },
  { value: "library", label: "Library" },
  { value: "research", label: "Research" },
  { value: "blog", label: "Blog" },
  { value: "projects", label: "Projects" },
];

const FRESHNESS_CLASS_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "aging", label: "Aging" },
  { value: "stale", label: "Stale" },
];

const VERIFICATION_STATUS_OPTIONS = [
  { value: "unverified", label: "Unverified" },
  { value: "human_review_pending", label: "Human Review Pending" },
  { value: "human_reviewed", label: "Human Reviewed" },
  { value: "machine_verified", label: "Machine Verified" },
];

const PUBLISH_STATE_OPTIONS = [
  { value: "internal", label: "Internal" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "published", label: "Published" },
];

// ---------------------------------------------------------------------------
// Minimal toast system — no external library; shows up to one message at a time
// ---------------------------------------------------------------------------

type ToastKind = "success" | "error";

interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

let toastSeq = 0;

function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((kind: ToastKind, text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id: ++toastSeq, kind, text });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, show, dismiss };
}

function ToastBanner({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const isSuccess = toast.kind === "success";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={toast.text}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium shadow-lg",
        "transition-all duration-200",
        isSuccess
          ? "border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/80 dark:text-emerald-300"
          : "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      {isSuccess ? (
        <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
      ) : (
        <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
      )}
      <span>{toast.text}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="ml-1 rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 rotate-[270deg]" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Derivatives panel (DETAIL-03)
// Uses useDerivatives hook + DerivativesList component.
// Shown when the artifact is a source type (raw_* | source_summary).
// ---------------------------------------------------------------------------

function DerivativesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading derivatives" className="flex flex-col gap-2 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2">
          <div className="h-4 w-16 rounded-sm bg-muted" />
          <div className="h-4 flex-1 rounded bg-muted" />
          <div className="h-4 w-10 rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  );
}

function DerivativesPanel({ artifactId }: { artifactId: string }) {
  const { derivatives, isLoading, isError, error, isNotFound, refetch } =
    useDerivatives(artifactId);

  if (isLoading) {
    return <DerivativesSkeleton />;
  }

  if (isNotFound) {
    // Backend returned 404 not_a_source or not_found — show empty state gracefully
    return (
      <DerivativesList derivatives={[]} />
    );
  }

  if (isError && error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-6 text-center"
      >
        <p className="text-sm font-semibold text-destructive">Failed to load derivatives</p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={refetch}
          className={cn(
            "mt-3 inline-flex h-7 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
            "transition-colors hover:bg-destructive/10",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <DerivativesList
      derivatives={derivatives}
      totalCount={derivatives.length}
    />
  );
}

// ---------------------------------------------------------------------------
// Backlinks panel (P7-04)
// Uses useArtifactBacklinks — server-side primary path with client-side fallback.
// ---------------------------------------------------------------------------

/**
 * Backlink row — mirrors EdgeRow from BacklinksPanel but uses BacklinkItem type.
 */
function BacklinkRow({ item }: { item: BacklinkItem }) {
  const hasTitle = item.title !== null && item.title !== undefined;
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2.5 text-sm transition-shadow hover:shadow-sm">
      {item.subtype && <TypeBadge type={item.subtype} />}
      <EdgeTypeBadge edgeType={item.type} />
      {hasTitle ? (
        <Link
          href={`/artifact/${item.artifact_id}`}
          className={cn(
            "min-w-0 flex-1 truncate font-medium text-foreground leading-snug",
            "hover:underline underline-offset-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
          )}
        >
          {item.title}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate">
          <Link
            href={`/artifact/${item.artifact_id}`}
            className={cn(
              "font-mono text-[12px] text-foreground/80",
              "hover:underline underline-offset-2",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
            )}
          >
            {item.artifact_id}
          </Link>
          <span className="ml-1.5 text-[11px] text-muted-foreground">(not indexed)</span>
        </span>
      )}
    </li>
  );
}

/**
 * BacklinksSection — a labelled list of items with a direction icon.
 */
function BacklinksSection({
  label,
  items,
  icon,
  emptyHint,
  listAriaLabel,
}: {
  label: string;
  items: BacklinkItem[];
  icon: React.ReactNode;
  emptyHint: string;
  listAriaLabel: string;
}) {
  const headingId = `backlinks-section-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex items-center gap-1.5">
        <span aria-hidden="true" className="text-muted-foreground">
          {icon}
        </span>
        <h3 id={headingId} className="text-sm font-semibold text-foreground">
          {label}
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({items.length})
          </span>
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <ul role="list" aria-label={listAriaLabel} className="flex flex-col gap-1.5">
          {items.map((item) => (
            <BacklinkRow key={`${item.artifact_id}-${item.type}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * BacklinksTab — rendered inside the Backlinks tab panel.
 *
 * Renders an edge_type filter dropdown + incoming/outgoing sections.
 * Primary data source: GET /api/artifacts/:id/backlinks.
 * Fallback: client-side edge-walk via GET /api/artifacts/:id/edges.
 */
function BacklinksTab({ artifactId }: { artifactId: string }) {
  const [edgeType, setEdgeType] = useState<EdgeType | "">("");

  const {
    incoming,
    outgoing,
    items,
    isLoading,
    isError,
    error,
    refetch,
    isFallback,
  } = useArtifactBacklinks(artifactId, edgeType || null);

  // Loading skeleton
  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Backlinks loading" className="flex flex-col gap-6">
        {[0, 1].map((section) => (
          <div key={section} className="flex flex-col gap-2">
            <div className="flex animate-pulse items-center gap-1.5">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
            </div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="flex animate-pulse items-center gap-2 rounded-md border bg-card px-3 py-2.5"
              >
                <div className="h-4 w-14 rounded-sm bg-muted" />
                <div className="h-4 w-16 rounded-sm bg-muted" />
                <div className="h-4 w-40 rounded bg-muted" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Error state — only shown when fallback also failed
  if (isError && error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 py-12 text-center"
      >
        <p className="text-sm font-medium text-foreground">Failed to load backlinks</p>
        <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={refetch}
          className={cn(
            "inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
            "transition-colors hover:bg-destructive/10",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Try again
        </button>
      </div>
    );
  }

  // Determine whether to show split view (incoming/outgoing) or flat list.
  // Primary path returns a flat list (isFallback=false); fallback has split.
  const hasSplit = isFallback;
  const hasAnyItems = hasSplit
    ? incoming.length > 0 || outgoing.length > 0
    : items.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------------ */}
      {/* Edge type filter dropdown                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="backlinks-edge-type-filter"
          className="text-xs font-medium text-muted-foreground"
        >
          Filter by type
        </label>
        <div className="relative">
          <select
            id="backlinks-edge-type-filter"
            value={edgeType}
            onChange={(e) => setEdgeType(e.target.value as EdgeType | "")}
            aria-label="Filter backlinks by edge type"
            className={cn(
              "h-7 appearance-none rounded-md border bg-background pl-2.5 pr-7 text-xs font-medium text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "transition-colors hover:border-primary/60",
            )}
          >
            <option value="">All types</option>
            {KNOWN_EDGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {EDGE_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        {/* Fallback indicator — subtle, informational only */}
        {isFallback && (
          <span
            role="note"
            aria-label="Using client-side edge data (server backlinks endpoint unavailable)"
            className="ml-auto text-[10px] text-muted-foreground/60"
          >
            (client data)
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* No edges                                                            */}
      {/* ------------------------------------------------------------------ */}
      {!hasAnyItems && (
        <div
          role="status"
          aria-label="No backlinks found"
          className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed py-16 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ArrowDownLeft aria-hidden="true" className="size-6 text-muted-foreground" />
          </div>
          <div className="max-w-xs">
            <p className="text-sm font-medium text-foreground">No backlinks found</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {edgeType
                ? `No edges of type "${EDGE_TYPE_LABELS[edgeType] ?? edgeType}" found.`
                : "This artifact has no incoming or outgoing edges in the overlay. Edges are created during compilation."}
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Populated state                                                      */}
      {/* ------------------------------------------------------------------ */}
      {hasAnyItems && hasSplit && (
        <>
          <BacklinksSection
            label="Incoming"
            items={incoming}
            icon={<ArrowDownLeft className="size-4" />}
            emptyHint="No artifacts reference this one."
            listAriaLabel="Incoming edges"
          />
          <BacklinksSection
            label="Outgoing"
            items={outgoing}
            icon={<ArrowUpRight className="size-4" />}
            emptyHint="This artifact does not reference others."
            listAriaLabel="Outgoing edges"
          />
        </>
      )}

      {hasAnyItems && !hasSplit && (
        <section aria-labelledby="backlinks-all-heading">
          <h3 id="backlinks-all-heading" className="sr-only">
            Backlinks ({items.length})
          </h3>
          <ul role="list" aria-label="Backlinks" className="flex flex-col gap-1.5">
            {items.map((item) => (
              <BacklinkRow key={`${item.artifact_id}-${item.type}`} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading artifact"
      className="flex flex-col gap-4 animate-pulse"
    >
      {/* Breadcrumb */}
      <div className="h-3.5 w-32 rounded bg-muted" />
      {/* Badge row */}
      <div className="flex gap-2">
        <div className="h-5 w-16 rounded-sm bg-muted" />
        <div className="h-5 w-12 rounded-sm bg-muted" />
      </div>
      {/* Title */}
      <div className="h-7 w-2/3 rounded bg-muted" />
      {/* Action buttons — 5 distinct static widths */}
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded-md bg-muted" />
        <div className="h-8 w-16 rounded-md bg-muted" />
        <div className="h-8 w-20 rounded-md bg-muted" />
        <div className="h-8 w-28 rounded-md bg-muted" />
        <div className="h-8 w-24 rounded-md bg-muted" />
      </div>
      {/* Tab bar */}
      <div className="flex gap-4 border-b pb-px">
        {BASE_TABS.map((t) => (
          <div key={t} className="h-4 w-16 rounded bg-muted" />
        ))}
      </div>
      {/* Content */}
      <div className="flex gap-4">
        <div className="h-48 flex-1 rounded-md bg-muted" />
        <div className="hidden h-48 w-60 rounded-md bg-muted lg:block" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

function NotFoundState({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link
          href="/library"
          className="hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Library
        </Link>
        <span aria-hidden="true">/</span>
        <span>Not found</span>
      </nav>
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
      >
        <p className="text-sm font-semibold text-destructive">Artifact not found</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{id}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          This artifact may have been deleted or the ID is incorrect.
        </p>
        <Link
          href="/library"
          className={cn(
            "mt-4 inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Back to Library
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
    >
      <p className="text-sm font-semibold text-destructive">Failed to load artifact</p>
      <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "mt-4 inline-flex h-8 items-center rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive",
          "transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Reader — raw markdown / text
// ---------------------------------------------------------------------------

function SourceReader({ content }: { content: string | null | undefined }) {
  if (!content) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center"
      >
        <p className="text-sm text-muted-foreground">No source content available.</p>
        <p className="text-xs text-muted-foreground/60">
          Source content is populated after the first vault read.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-md border bg-muted/30">
      <pre className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-foreground/80">
        <code>{content}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knowledge Reader — compiled HTML / markdown output (PU6-01)
// Uses ArticleViewer from @miethe/ui with variant="editorial".
// ArticleViewer handles HTML detection (format="auto") and sanitization
// internally via rehype-sanitize. No dangerouslySetInnerHTML on this path.
// ---------------------------------------------------------------------------

function KnowledgeReader({ content }: { content: string | null | undefined }) {
  if (!content) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center"
      >
        <p className="text-sm text-muted-foreground">No compiled content yet.</p>
        <p className="text-xs text-muted-foreground/60">
          Run Compile to generate the knowledge reader output.
        </p>
      </div>
    );
  }
  return (
    <ArticleViewer
      content={content}
      format="auto"
      variant="editorial"
      frontmatter="hide"
      sanitize={true}
      generateHeadingIds={true}
      className="rounded-md border bg-card p-6"
    />
  );
}

// ---------------------------------------------------------------------------
// Draft Reader — synthesis/draft content (PU6-01)
// Uses ArticleViewer from @miethe/ui with variant="editorial".
// DP3-02 #7: Draft uses same typography ruleset as Knowledge to avoid drift.
// ---------------------------------------------------------------------------

function DraftReader({ content }: { content: string | null | undefined }) {
  if (!content) {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center"
      >
        <p className="text-sm text-muted-foreground">No draft content</p>
        <p className="text-xs text-muted-foreground/60">
          Draft content appears here for synthesis and staged artifacts.
        </p>
      </div>
    );
  }
  return (
    <ArticleViewer
      content={content}
      format="auto"
      variant="editorial"
      frontmatter="hide"
      sanitize={true}
      generateHeadingIds={true}
      className="rounded-md border bg-card p-6"
    />
  );
}

// WorkflowOSPlaceholder removed — replaced by WorkflowOSTab (P4-10).

// ---------------------------------------------------------------------------
// Action buttons — rail-owned column (ADR-DPI-002 §1 DP1-03 #2)
// Migrated from header row to ContextRail action column.
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Editable metadata section (P2-06)
//
// Groups the 12 inline-editable fields in a labelled two-column grid
// below the badge row. Non-editable system fields (id, type, subtype,
// lifecycle_stage, created, updated, schema_version, lens_* badge fields,
// compile_*, content_hash, file_path) are NOT included here — they remain
// as plain-text in ArtifactTitleBlock and ContextRail.
// ---------------------------------------------------------------------------

interface EditableMetadataSectionProps {
  artifact: ArtifactDetail;
  onSave: (field: keyof ArtifactPatchFields, value: unknown) => Promise<void>;
}

/**
 * A single metadata row: label + inline-edit widget.
 */
function MetaRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        id={htmlFor ? `${htmlFor}-label` : undefined}
        className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70"
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function EditableMetadataSection({ artifact, onSave }: EditableMetadataSectionProps) {
  // Tags and owners have special diff semantics — their onSave wrappers handle
  // the tags_add / tags_remove transformation so the generic handler isn't used.
  const currentTags = (artifact.frontmatter_jsonb?.["tags"] as string[] | null) ?? [];
  const currentOwners = (artifact.frontmatter_jsonb?.["owners"] as string[] | null) ?? [];

  const handleTagsSave = useCallback(
    async (newTags: string[]) => {
      const tagsAdd = newTags.filter((t) => !currentTags.includes(t));
      const tagsRemove = currentTags.filter((t) => !newTags.includes(t));
      await onSave("tags_add", { tags_add: tagsAdd, tags_remove: tagsRemove });
    },
    [currentTags, onSave],
  );

  const handleOwnersSave = useCallback(
    async (newOwners: string[]) => {
      await onSave("owners", newOwners);
    },
    [onSave],
  );

  return (
    <section
      aria-label="Editable artifact metadata"
      className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-md border bg-card/50 p-4 sm:grid-cols-2"
    >
      {/* 1. title */}
      <MetaRow label="Title">
        <InlineTextField
          value={artifact.title ?? ""}
          onSave={(v) => onSave("title", v)}
          label="Title"
          maxLength={200}
          placeholder="Artifact title"
        />
      </MetaRow>

      {/* 2. description */}
      <MetaRow label="Description">
        <InlineTextarea
          value={artifact.frontmatter_jsonb?.["description"] as string ?? ""}
          onSave={(v) => onSave("description", v)}
          label="Description"
          rows={2}
          placeholder="Brief description…"
        />
      </MetaRow>

      {/* 3. status */}
      <MetaRow label="Status">
        <InlineSelect
          value={artifact.status ?? ""}
          options={STATUS_OPTIONS}
          onSave={(v) => onSave("status", v)}
          label="Status"
          placeholder="Select status"
        />
      </MetaRow>

      {/* 4. workspace */}
      <MetaRow label="Workspace">
        <InlineSelect
          value={artifact.workspace ?? ""}
          options={WORKSPACE_OPTIONS}
          onSave={(v) => onSave("workspace", v)}
          label="Workspace"
          placeholder="Select workspace"
        />
      </MetaRow>

      {/* 5. tags */}
      <MetaRow label="Tags">
        <InlineChipEditor
          values={currentTags}
          onSave={handleTagsSave}
          label="Tags"
          placeholder="Add tag…"
        />
      </MetaRow>

      {/* 6. domain */}
      <MetaRow label="Domain">
        <InlineTextField
          value={artifact.frontmatter_jsonb?.["domain"] as string ?? ""}
          onSave={(v) => onSave("domain", v)}
          label="Domain"
          placeholder="e.g. philosophy, engineering"
        />
      </MetaRow>

      {/* 7. project */}
      <MetaRow label="Project">
        <InlineTextField
          value={artifact.frontmatter_jsonb?.["project"] as string ?? ""}
          onSave={(v) => onSave("project", v)}
          label="Project"
          placeholder="Project name"
        />
      </MetaRow>

      {/* 8. freshness_class */}
      <MetaRow label="Freshness">
        <InlineSelect
          value={
            (artifact.frontmatter_jsonb?.["freshness_class"] as string) ??
            ""
          }
          options={FRESHNESS_CLASS_OPTIONS}
          onSave={(v) => onSave("freshness_class", v)}
          label="Freshness class"
          placeholder="Select freshness"
        />
      </MetaRow>

      {/* 9. verification_status */}
      <MetaRow label="Verification">
        <InlineSelect
          value={
            (artifact.frontmatter_jsonb?.["verification_status"] as string) ??
            ""
          }
          options={VERIFICATION_STATUS_OPTIONS}
          onSave={(v) => onSave("verification_status", v)}
          label="Verification status"
          placeholder="Select verification"
        />
      </MetaRow>

      {/* 10. series */}
      <MetaRow label="Series">
        <InlineTextField
          value={artifact.frontmatter_jsonb?.["series"] as string ?? ""}
          onSave={(v) => onSave("series", v)}
          label="Series"
          placeholder="Series name"
        />
      </MetaRow>

      {/* 11. publish_state */}
      <MetaRow label="Publish State">
        <InlineSelect
          value={
            (artifact.frontmatter_jsonb?.["publish_state"] as string) ?? ""
          }
          options={PUBLISH_STATE_OPTIONS}
          onSave={(v) => onSave("publish_state", v)}
          label="Publish state"
          placeholder="Select publish state"
        />
      </MetaRow>

      {/* 12. owners */}
      <MetaRow label="Owners">
        <InlineChipEditor
          values={currentOwners}
          onSave={handleOwnersSave}
          label="Owners"
          placeholder="Add owner…"
        />
      </MetaRow>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ArtifactDetailClientProps {
  id: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ArtifactDetailClient({ id }: ArtifactDetailClientProps) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>("Source");
  const { artifact, isLoading, isError, error, isNotFound, refetch } =
    useArtifact(id);

  // ---- Toast notifications (P2-06) ----
  const { toast: activeToast, show: showToast, dismiss: dismissToast } = useToast();

  // ---- Per-field save handler (extracted to useArtifactFieldSave — P2-07) ----
  const { handleFieldSave } = useArtifactFieldSave({
    artifactId: id,
    showToast,
  });

  // Compile success feedback: auto-clears after 3 seconds (FE-03).
  const [compileSuccess, setCompileSuccess] = useState(false);

  const { compile, isCompiling, error: compileError } = useCompileArtifact({
    artifactId: id,
    onSuccess: () => {
      setCompileSuccess(true);
      // Invalidate artifact detail so Knowledge tab refreshes
      refetch();
    },
  });

  // Auto-clear success message after 3s
  useEffect(() => {
    if (!compileSuccess) return;
    const timer = setTimeout(() => setCompileSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [compileSuccess]);

  // Deep-link: if ?tab=derivatives is present AND the artifact is a source type,
  // activate the Derivatives tab on mount / when the artifact loads.
  // useEffect is placed before early returns to satisfy the Rules of Hooks.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "derivatives" && artifact && isSourceType(artifact.type)) {
      setActiveTab("Derivatives");
    }
    if (tabParam === "backlinks" && artifact) {
      setActiveTab("Backlinks");
    }
    if (tabParam === "processing" && artifact) {
      setActiveTab("Processing");
    }
  }, [searchParams, artifact]);

  // ---- Loading / error states ----
  // Wrap each early-return in a scrollable padded container since the shell's
  // <main> is `overflow-hidden` for full-bleed routes (see shell-client.tsx).
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <DetailSkeleton />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <NotFoundState id={id} />
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  // Guard: artifact may still be undefined if query is disabled
  if (!artifact) {
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <DetailSkeleton />
      </div>
    );
  }

  // Determine whether this artifact is a source type (raw_* | source_summary).
  // The Derivatives tab is only visible for source-type artifacts.
  const showDerivativesTab = isSourceType(artifact.type);

  // Build the list of visible tabs for this artifact.
  const visibleTabs: TabId[] = showDerivativesTab
    ? [...BASE_TABS, "Derivatives"]
    : [...BASE_TABS];

  // FE-03: Compile Now is only shown when status is "needs_review" or "inbox".
  // The status field is typed as ArtifactStatus ("draft"|"active"|"archived"|"stale")
  // but the backend may return "needs_review" before the type is widened — treat
  // it as a runtime string comparison for forward-compatibility.
  const artifactStatus = artifact.status as string;
  const showCompileAction =
    artifactStatus === "needs_review" || artifactStatus === "inbox";

  // Build rail actions dynamically so Compile Now can have a real onClick
  // and can be conditionally excluded for statuses that don't need it.
  const railActions: ContextRailAction[] = [
    {
      label: "Add Note",
      ariaLabel: "Add a note to this artifact",
      hasEndpoint: false,
      description: "Note creation — deferred to v1.5 write path",
      icon: StickyNote,
    },
    {
      label: "Promote to Archive",
      ariaLabel: "Promote artifact to archive lifecycle stage",
      hasEndpoint: true,
      description: "POST /api/artifacts/:id/promote — wired in a future P3 task",
      icon: Archive,
    },
    {
      label: "Link Related",
      ariaLabel: "Link this artifact to a related artifact",
      hasEndpoint: true,
      description: "POST /api/artifacts/:id/link — wired in a future P3 task",
      icon: Link2,
    },
    {
      label: "Request Review",
      ariaLabel: "Add this artifact to the review queue",
      hasEndpoint: true,
      description: "POST /api/artifacts/:id/review — wired in a future P3 task",
      icon: CheckSquare,
    },
    ...(showCompileAction
      ? [
          {
            label: isCompiling ? "Compiling..." : "Compile Now",
            ariaLabel: isCompiling
              ? "Compilation in progress"
              : "Trigger compilation workflow for this artifact",
            hasEndpoint: true,
            description: "POST /api/artifacts/:id/compile (FE-03)",
            onClick: isCompiling ? undefined : compile,
            icon: isCompiling ? Loader2 : FileText,
          } satisfies ContextRailAction,
        ]
      : []),
  ];

  return (
    // Full-bleed route: <main> is overflow-hidden + unpadded. This page owns
    // its padding and partitions the viewport into:
    //   1) Locked top region: title block + key-detail badges (shrink-0).
    //   2) Body row (flex-1, min-h-0): main content column (scrolls), right
    //      ContextRail (scrolls independently).
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      {/* ------------------------------------------------------------------ */}
      {/* Locked top region — title + key-detail badges (does not scroll)    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex shrink-0 flex-col gap-4">
        <ArtifactTitleBlock artifact={artifact} />

        <div className="flex flex-col gap-2">
          {/* Lens Badge Set — FULL variant, above the tab bar per manifest §3.4 */}
          <LensBadgeSet artifact={artifact} variant="detail" />

          {/* Type / workspace / indicator badge row */}
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={artifact.type} />
            <WorkspaceBadge workspace={artifact.workspace} />
            <ArtifactFreshnessBadge
              freshness={artifact.frontmatter_jsonb?.["lens_freshness"] as string | null | undefined}
              staleAfter={artifact.frontmatter_jsonb?.["stale_after"] as string | null | undefined}
            />
            <ContradictionFlag artifactId={artifact.id} />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body row: main content column + right ContextRail.                  */}
      {/* Each column scrolls independently inside the row's flex height.    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-h-0 flex-1 gap-6">
        {/* Main content column — scrolls independently of the rail and of   */}
        {/* the locked top region. pr-1 keeps cards clear of the scrollbar.  */}
        <div className="flex h-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {/* Handoff Chain ribbon (P4-04) */}
          <HandoffChainRibbon artifact={artifact} />

          {/* Inline-editable metadata section (P2-06) */}
          <EditableMetadataSection artifact={artifact} onSave={handleFieldSave} />

          {/* Tab bar — sticky at top of content scroll so the active tab
              stays reachable while reader content scrolls beneath it.
              Outer wrapper provides height; inner div handles horizontal
              overflow (CSS coerces overflow-y to auto when overflow-x is
              non-visible, collapsing height to 0 in flex columns). */}
          <div className="sticky top-0 z-10 shrink-0 border-b bg-background">
            <div
              role="tablist"
              aria-label="Artifact readers"
              className="-mx-1 flex overflow-x-auto px-1 scrollbar-none [-webkit-overflow-scrolling:touch]"
            >
              {visibleTabs.map((tab) => (
                <button
                  key={tab}
                  id={tabButtonId(tab)}
                  role="tab"
                  type="button"
                  aria-selected={tab === activeTab}
                  aria-controls={tabPanelId(tab)}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    tab === activeTab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Reader panels */}
          <div className="min-w-0 flex-1">
          {/* Source tab */}
          <div
            id={tabPanelId("Source")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Source")}
            hidden={activeTab !== "Source"}
          >
            <SourceReader content={artifact.raw_content} />
          </div>

          {/* Knowledge tab */}
          <div
            id={tabPanelId("Knowledge")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Knowledge")}
            hidden={activeTab !== "Knowledge"}
          >
            <KnowledgeReader content={artifact.compiled_content} />
          </div>

          {/* Draft tab */}
          <div
            id={tabPanelId("Draft")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Draft")}
            hidden={activeTab !== "Draft"}
          >
            <DraftReader content={artifact.draft_content} />
          </div>

          {/* Workflow OS tab */}
          <div
            id={tabPanelId("Workflow OS")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Workflow OS")}
            hidden={activeTab !== "Workflow OS"}
          >
            <WorkflowOSTab
              artifact={artifact}
              enabled={activeTab === "Workflow OS"}
            />
          </div>

          {/* Backlinks tab (P7-04) */}
          <div
            id={tabPanelId("Backlinks")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Backlinks")}
            hidden={activeTab !== "Backlinks"}
          >
            {activeTab === "Backlinks" && (
              <BacklinksTab artifactId={artifact.id} />
            )}
          </div>

          {/* Processing history tab (P2-02) */}
          <div
            id={tabPanelId("Processing")}
            role="tabpanel"
            aria-labelledby={tabButtonId("Processing")}
            hidden={activeTab !== "Processing"}
          >
            <ProcessingHistoryTab artifactId={artifact.id} />
          </div>

          {/* Derivatives tab — source-type artifacts only (DETAIL-03) */}
          {showDerivativesTab && (
            <div
              id={tabPanelId("Derivatives")}
              role="tabpanel"
              aria-labelledby={tabButtonId("Derivatives")}
              hidden={activeTab !== "Derivatives"}
            >
              <DerivativesPanel artifactId={artifact.id} />
            </div>
          )}
        </div>

          {/* Activity Timeline (P4-04) — full-width feed at bottom of      */}
          {/* the scrollable content column.                                  */}
          <ActivityTimeline artifactId={artifact.id} />
        </div>

        {/* ContextRail — inline right-column rail (ADR-DPI-002 Option A.1).
            Scrolls independently of the content column so users can review
            actions and context without losing their place in the reader.    */}
        <aside
          aria-label="Context rail"
          className="hidden h-full w-72 shrink-0 overflow-y-auto lg:block"
        >
          {/* FE-03: Compile feedback — success + error shown above the rail */}
          {compileSuccess && (
            <div
              role="status"
              aria-live="polite"
              aria-label="Compilation queued successfully"
              className={cn(
                "mb-2 flex items-center gap-2 rounded-md border border-emerald-500/30",
                "bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700",
                "dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400",
              )}
            >
              <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
              Compile job queued
            </div>
          )}
          {compileError && !compileSuccess && (
            <div
              role="alert"
              aria-live="assertive"
              className={cn(
                "mb-2 rounded-md border border-destructive/30 bg-destructive/5",
                "px-3 py-2 text-xs text-destructive",
              )}
            >
              {compileError}
            </div>
          )}
          <ContextRail
            variant="generic"
            artifactId={artifact.id}
            artifact={artifact}
            actions={railActions}
            ariaLabel="Artifact context"
          />
        </aside>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Toast notification (P2-06) — fixed bottom-right, auto-dismissing   */}
      {/* ------------------------------------------------------------------ */}
      {activeToast && (
        <ToastBanner toast={activeToast} onDismiss={dismissToast} />
      )}
    </div>
  );
}
