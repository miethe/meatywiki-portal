"use client";

/**
 * ContextRail — inline right-column context rail primitive (ADR-DPI-002 Option A.1).
 *
 * Renders a tabbed panel that slots into the right column of an existing
 * Standard-shell page composition. No new shell primitive is introduced;
 * the caller owns the flex/grid layout and provides a right-column slot
 * at the appropriate breakpoint.
 *
 * ## Tab sets
 *
 * Generic surfaces (Artifact Detail Readers + OS tab, Inbox — future):
 *   Properties | Connections | History
 *
 * Research surfaces (Research Artifact Detail, Research Home, Review Queue):
 *   Evidence | Contradictions | Lineage | Metadata
 *
 * The tab set is selected via the `variant` prop:
 *   - "generic"   → Properties / Connections / History
 *   - "research"  → Evidence / Contradictions / Lineage / Metadata
 *
 * Individual panels can also be overridden via `customTabs` for advanced use.
 *
 * ## Action column (DP1-03 #2)
 *
 * When `actions` is provided, the rail renders a rail-owned action column above
 * the tabs. This migrates Artifact Detail Reader action buttons from the header
 * row into the rail per ADR §1 folded sub-decision.
 *
 * ## Backend endpoint status
 *
 * Implemented:
 *   - GET /api/artifacts/:id/edges  — used for Connections + Lineage panels
 *
 * Missing (deferred):
 *   - GET /api/artifacts/:id/lineage  — lineage timeline (runs joined)
 *   - GET /api/artifacts/:id/evidence — evidence + contradiction aggregate
 *
 * Panels requiring missing endpoints render a skeleton placeholder.
 *
 * ## Responsive
 *
 * The rail is hidden below lg breakpoint by default (controlled by parent).
 * The component itself has no breakpoint logic; it fills 100% of its container.
 *
 * ## Accessibility
 *
 * Uses ARIA tablist/tab/tabpanel pattern matching ArtifactDetailClient.
 * WCAG 2.1 AA: visible focus rings, colour + text (never colour-only), aria labels.
 *
 * Stitch refs:
 *   - "Artifact Detail" (ID: 7b5a1a093d1c454c96c913367c7e60fe)
 *   - "Research Artifact - Workflow OS Enhanced" (ID: ee5b9ed70061402c99b091998f9002d8)
 *   - "Research Home" (ID: 0cf6fb7b27d9459e8b5bebfea66915c5)
 *   - "Review Queue" (P4-05)
 *
 * ADR: ADR-DPI-002 Option A.1 (2026-04-21)
 * Tasks: DP4-02b
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Info,
  Clock,
  Link2,
  BookOpen,
  GitMerge,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";
import { FidelityBadge, FreshnessBadge, VerificationBadge } from "@/components/ui/lens-badge";
import {
  useArtifactEdges,
  type ArtifactEdgeItem,
  type EdgeType,
} from "@/hooks/useArtifactEdges";
import { useLineage } from "@/hooks/useLineage";
import { useRecentSyntheses } from "@/hooks/useRecentSyntheses";
import type { SynthesisLineageNode } from "@/lib/api/research";
import type { ArtifactDetail } from "@/types/artifact";

// Convenience alias — ContextRail panels operate on ArtifactDetail
type Artifact = ArtifactDetail;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextRailVariant = "generic" | "research";

export interface ContextRailTab {
  id: string;
  label: string;
  /** Render the panel content. Receives the artifact for data-dependent panels. */
  renderContent: (artifactId: string | undefined, artifact: Artifact | undefined) => ReactNode;
}

export interface ContextRailAction {
  label: string;
  ariaLabel: string;
  /** True when the backend endpoint exists but UI wiring is deferred. */
  hasEndpoint: boolean;
  description: string;
  onClick?: () => void;
  /** Leading icon component (lucide-react). Renders left of label. */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * When true the button is rendered in a disabled / muted state and
   * ignores clicks. Distinct from `!onClick` (un-wired stubs) — use
   * `disabled` for actions that are intentionally blocked at runtime
   * (e.g. already-submitted, in-flight).
   */
  disabled?: boolean;
}

export interface ContextRailProps {
  /** Selects the tab set. Ignored when `customTabs` is provided. */
  variant?: ContextRailVariant;
  /** Override the tab set entirely. */
  customTabs?: ContextRailTab[];
  /** The artifact whose context to display. */
  artifactId?: string;
  /** Full artifact object (for Properties panel). */
  artifact?: Artifact;
  /** Action buttons rendered above the tabs (rail-owned action column). */
  actions?: ContextRailAction[];
  className?: string;
  /** Accessible label for the tab list. Defaults to "Context rail". */
  ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

/**
 * Coming-soon placeholder. Used for panels backed by missing endpoints.
 */
function ComingSoonPanel({
  label,
  reason,
}: {
  label: string;
  reason: string;
}) {
  return (
    <div
      role="status"
      aria-label={`${label} — planned`}
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-3 py-8 text-center"
    >
      <Info aria-hidden="true" className="size-5 text-muted-foreground/50" />
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {reason}
        </p>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
          Coming soon
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edge type badge (shared with BacklinksPanel — replicated to avoid coupling)
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
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium leading-tight",
        colour,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Compact edge row (rail-optimised, narrower than BacklinksPanel's EdgeRow)
// ---------------------------------------------------------------------------

function CompactEdgeRow({ edge }: { edge: ArtifactEdgeItem }) {
  const hasTitle = edge.title !== null && edge.title !== undefined;
  return (
    <li className="flex flex-wrap items-start gap-1.5 rounded-md border bg-card px-2.5 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-1">
        {edge.subtype && <TypeBadge type={edge.subtype} />}
        <EdgeTypeBadge edgeType={edge.type} />
      </div>
      {hasTitle ? (
        <Link
          href={`/artifact/${edge.artifact_id}`}
          className={cn(
            "w-full truncate font-medium text-foreground",
            "hover:underline underline-offset-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
          )}
        >
          {edge.title}
        </Link>
      ) : (
        <span className="w-full truncate">
          <Link
            href={`/artifact/${edge.artifact_id}`}
            className={cn(
              "font-mono text-[11px] text-foreground/80",
              "hover:underline underline-offset-2",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
            )}
          >
            {edge.artifact_id}
          </Link>
          <span className="ml-1 text-[10px] text-muted-foreground">(not indexed)</span>
        </span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Panel: Properties (generic variant)
// ---------------------------------------------------------------------------

function PropertiesPanel({ artifact }: { artifact: Artifact | undefined }) {
  if (!artifact) {
    return (
      <div
        role="status"
        className="flex items-center justify-center py-8 text-xs text-muted-foreground"
      >
        No artifact selected
      </div>
    );
  }

  const tags = Array.isArray(artifact.frontmatter_jsonb?.["tags"])
    ? (artifact.frontmatter_jsonb["tags"] as string[])
    : [];

  // Lens dimensions — from metadata if available, fallback to frontmatter fields
  const fidelity = artifact.metadata?.fidelity
    ?? (artifact.frontmatter_jsonb?.["lens_fidelity"] as string | null | undefined);
  const freshness = artifact.metadata?.freshness
    ?? (artifact.frontmatter_jsonb?.["lens_freshness"] as string | null | undefined);
  const verificationState = artifact.metadata?.verification_state
    ?? (artifact.frontmatter_jsonb?.["verification_state"] as string | null | undefined);
  const hasLensBadges = Boolean(fidelity || freshness || verificationState);

  // Word count — from raw_content if available; frontmatter_jsonb fallback
  const wordCountFm = artifact.frontmatter_jsonb?.["word_count"];
  const wordCount: number | null =
    typeof wordCountFm === "number"
      ? wordCountFm
      : artifact.raw_content
        ? artifact.raw_content.trim().split(/\s+/).filter(Boolean).length
        : null;

  return (
    <dl className="flex flex-col gap-2.5 text-xs">
      {/* Lens badges — fidelity / freshness / verification */}
      {hasLensBadges && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Lens
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            <FidelityBadge value={fidelity as Parameters<typeof FidelityBadge>[0]["value"]} />
            <FreshnessBadge value={freshness as Parameters<typeof FreshnessBadge>[0]["value"]} />
            <VerificationBadge value={verificationState as Parameters<typeof VerificationBadge>[0]["value"]} />
          </dd>
        </div>
      )}

      <div>
        <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Type
        </dt>
        <dd className="mt-0.5 capitalize">{artifact.type ?? "—"}</dd>
      </div>

      {artifact.workspace && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </dt>
          <dd className="mt-0.5 capitalize">{artifact.workspace}</dd>
        </div>
      )}

      <div>
        <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Status
        </dt>
        <dd className="mt-0.5 capitalize">{artifact.status ?? "—"}</dd>
      </div>

      {artifact.created && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Created
          </dt>
          <dd className="mt-0.5">
            <time dateTime={artifact.created}>
              {new Date(artifact.created).toLocaleDateString()}
            </time>
          </dd>
        </div>
      )}
      {artifact.updated && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Updated
          </dt>
          <dd className="mt-0.5">
            <time dateTime={artifact.updated}>
              {new Date(artifact.updated).toLocaleDateString()}
            </time>
          </dd>
        </div>
      )}

      {wordCount !== null && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Word Count
          </dt>
          <dd className="mt-0.5 tabular-nums">{wordCount.toLocaleString()}</dd>
        </div>
      )}

      {artifact.slug && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Slug
          </dt>
          <dd className="mt-0.5 break-all font-mono text-[10px] text-foreground/80">
            {artifact.slug}
          </dd>
        </div>
      )}
      {artifact.file_path && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            File
          </dt>
          <dd className="mt-0.5 break-all font-mono text-[10px] text-foreground/60">
            {artifact.file_path}
          </dd>
        </div>
      )}
      {tags.length > 0 && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Tags
          </dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </dd>
        </div>
      )}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Panel: Connections (generic variant) — backed by /edges endpoint
// ---------------------------------------------------------------------------

function ConnectionsPanel({ artifactId }: { artifactId: string | undefined }) {
  const { data, isLoading, isError, error, refetch } = useArtifactEdges(
    artifactId ?? null,
  );

  if (!artifactId) {
    return (
      <div
        role="status"
        className="py-6 text-center text-xs text-muted-foreground"
      >
        No artifact selected
      </div>
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading connections" className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="flex animate-pulse items-center gap-1.5 rounded-md border bg-card px-2.5 py-2"
          >
            <div className="h-3 w-12 rounded-sm bg-muted" />
            <div className="h-3 w-16 rounded-sm bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (isError && error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-4 text-center"
      >
        <AlertCircle aria-hidden="true" className="size-4 text-destructive" />
        <p className="text-xs text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={refetch}
          className={cn(
            "inline-flex h-7 items-center rounded border border-destructive/40 px-2 text-[11px] text-destructive",
            "hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Retry
        </button>
      </div>
    );
  }

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const allEdges = [...incoming, ...outgoing];

  if (allEdges.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2 rounded-md border border-dashed px-3 py-6 text-center"
      >
        <GitMerge aria-hidden="true" className="size-5 text-muted-foreground/40" />
        <p className="text-xs font-medium text-foreground">No connections yet</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Connections will surface as the artifact grows and is compiled.
        </p>
      </div>
    );
  }

  // Group by semantic category for readability.
  // Synthesis: derived_from + contains edges (this artifact feeds/is fed by a synthesis)
  // Evidence cited by: supports edges where this artifact is supported-by others
  // Links: relates_to, contradicts, supersedes — general cross-references
  const synthTypes: EdgeType[] = ["derived_from", "contains"];
  const evidenceTypes: EdgeType[] = ["supports"];

  const synthEdges = allEdges.filter((e) => synthTypes.includes(e.type));
  const evidenceEdges = allEdges.filter((e) => evidenceTypes.includes(e.type));
  const linkEdges = allEdges.filter(
    (e) => !synthTypes.includes(e.type) && !evidenceTypes.includes(e.type),
  );

  // If groups produce nothing meaningful (all edges fit a single bucket), fall
  // back to the classic incoming/outgoing split so nothing is hidden.
  const useGrouped = synthEdges.length > 0 || evidenceEdges.length > 0;

  if (!useGrouped) {
    return (
      <div className="flex flex-col gap-3">
        {incoming.length > 0 && (
          <section aria-labelledby="rail-incoming-heading">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ArrowDownLeft aria-hidden="true" className="size-3" />
              <span id="rail-incoming-heading">Incoming ({incoming.length})</span>
            </div>
            <ul role="list" aria-label="Incoming edges" className="flex flex-col gap-1">
              {incoming.map((edge) => (
                <CompactEdgeRow key={`in-${edge.artifact_id}-${edge.type}`} edge={edge} />
              ))}
            </ul>
          </section>
        )}
        {outgoing.length > 0 && (
          <section aria-labelledby="rail-outgoing-heading">
            <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ArrowUpRight aria-hidden="true" className="size-3" />
              <span id="rail-outgoing-heading">Outgoing ({outgoing.length})</span>
            </div>
            <ul role="list" aria-label="Outgoing edges" className="flex flex-col gap-1">
              {outgoing.map((edge) => (
                <CompactEdgeRow key={`out-${edge.artifact_id}-${edge.type}`} edge={edge} />
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {synthEdges.length > 0 && (
        <section aria-labelledby="rail-synth-heading">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <BookOpen aria-hidden="true" className="size-3" />
            <span id="rail-synth-heading">Synthesis references ({synthEdges.length})</span>
          </div>
          <ul role="list" aria-label="Synthesis reference edges" className="flex flex-col gap-1">
            {synthEdges.map((edge) => (
              <CompactEdgeRow key={`synth-${edge.artifact_id}-${edge.type}`} edge={edge} />
            ))}
          </ul>
        </section>
      )}
      {evidenceEdges.length > 0 && (
        <section aria-labelledby="rail-evidence-heading">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <ArrowDownLeft aria-hidden="true" className="size-3" />
            <span id="rail-evidence-heading">Evidence cited by ({evidenceEdges.length})</span>
          </div>
          <ul role="list" aria-label="Evidence cited-by edges" className="flex flex-col gap-1">
            {evidenceEdges.map((edge) => (
              <CompactEdgeRow key={`evid-${edge.artifact_id}-${edge.type}`} edge={edge} />
            ))}
          </ul>
        </section>
      )}
      {linkEdges.length > 0 && (
        <section aria-labelledby="rail-links-heading">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Link2 aria-hidden="true" className="size-3" />
            <span id="rail-links-heading">Links ({linkEdges.length})</span>
          </div>
          <ul role="list" aria-label="Linked artifacts" className="flex flex-col gap-1">
            {linkEdges.map((edge) => (
              <CompactEdgeRow key={`link-${edge.artifact_id}-${edge.type}`} edge={edge} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: History (generic variant) — empty state (OQ-P3-03-C)
// Activity endpoint not yet shipped. Render graceful placeholder.
// P4-04 wires the inline body timeline; this panel shows the rail view.
// ---------------------------------------------------------------------------

/**
 * Placeholder timeline entry shape — used only if activity data arrives later.
 * Backend: GET /api/artifacts/:id/activity (not yet shipped as of v1.5).
 */
interface ActivityEntry {
  id: string;
  actor: string;
  action: string;
  /** ISO 8601 string */
  timestamp: string;
  /** Optional short summary of what changed */
  summary?: string | null;
}

function RelativeTime({ iso }: { iso: string }) {
  const ms = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return <span>{secs}s ago</span>;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return <span>{mins}m ago</span>;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return <span>{hours}h ago</span>;
  const days = Math.floor(hours / 24);
  return <span>{days}d ago</span>;
}

function ActivityTimelineEntry({ entry }: { entry: ActivityEntry }) {
  const initials = entry.actor
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <li className="flex items-start gap-2.5">
      {/* Avatar */}
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {initials}
      </span>
      <div className="flex flex-col gap-0.5">
        <p className="text-[11px] leading-snug text-foreground">
          <span className="font-medium">{entry.actor}</span>{" "}
          <span className="text-muted-foreground">{entry.action}</span>
        </p>
        {entry.summary && (
          <p className="text-[10px] text-muted-foreground/80">{entry.summary}</p>
        )}
        <time
          dateTime={entry.timestamp}
          className="text-[10px] text-muted-foreground/60"
        >
          <RelativeTime iso={entry.timestamp} />
        </time>
      </div>
    </li>
  );
}

function HistoryPanel({ entries }: { entries?: ActivityEntry[] | null }) {
  // Activity endpoint (GET /api/artifacts/:id/activity) is not yet shipped.
  // OQ-P3-03-C: render graceful empty state; do NOT mock fixture data.
  if (!entries || entries.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2.5 rounded-md border border-dashed px-3 py-8 text-center"
      >
        <Clock aria-hidden="true" className="size-5 text-muted-foreground/40" />
        <div>
          <p className="text-xs font-medium text-foreground">No activity yet</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Revisions, promotions, and system events will appear here once the
            activity endpoint ships.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul
      role="list"
      aria-label="Activity history"
      className="flex flex-col gap-3"
    >
      {entries.map((entry) => (
        <ActivityTimelineEntry key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Panel: Evidence (research variant) — deferred (no evidence aggregate endpoint)
// ---------------------------------------------------------------------------

function EvidencePanel() {
  return (
    <ComingSoonPanel
      label="Evidence"
      reason="GET /api/artifacts/:id/evidence aggregate endpoint is not yet shipped."
    />
  );
}

// ---------------------------------------------------------------------------
// Panel: Contradictions (research variant) — deferred (no aggregate endpoint)
// ---------------------------------------------------------------------------

function ContradictionsPanel() {
  return (
    <ComingSoonPanel
      label="Contradictions"
      reason={
        "GET /api/artifacts/:id/evidence (grouped contradictions) is not yet shipped. " +
        "Contradiction flag is available on the artifact header."
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Panel: Lineage (research variant) — wired to synthesis-lineage endpoint
// ---------------------------------------------------------------------------

/**
 * Recursive node renderer for the synthesis lineage tree.
 *
 * Renders a collapsible sub-tree. Root node is rendered by ResearchLineagePanel;
 * children are rendered recursively. Depth is capped at 10 by the backend,
 * so no explicit depth guard is required here.
 */
function LineageNode({
  node,
  isRoot = false,
}: {
  node: SynthesisLineageNode;
  isRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const edgeLabel = node.edge_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <li
      className={cn(
        "flex flex-col gap-0.5",
        !isRoot && "pl-3 border-l border-muted",
      )}
    >
      {/* Node row */}
      <div className="flex items-start gap-1.5">
        {/* Expand toggle — only visible when children exist */}
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? "Collapse children" : "Expand children"}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground",
              "hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            <span aria-hidden="true" className="text-[10px] leading-none">
              {expanded ? "▾" : "▸"}
            </span>
          </button>
        ) : (
          /* Spacer so leaf nodes align with expandable nodes */
          <span aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        )}

        {/* Content */}
        <div className="flex min-w-0 flex-col gap-0.5">
          {/* Edge type badge — omit on root */}
          {!isRoot && (
            <span className="inline-flex w-fit items-center rounded-sm bg-sky-100 px-1.5 py-0.5 text-[9px] font-medium leading-tight text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
              {edgeLabel}
            </span>
          )}
          <Link
            href={`/artifact/${node.artifact_id}`}
            className={cn(
              "truncate text-[11px] font-medium leading-snug text-foreground",
              "hover:underline underline-offset-2",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
              isRoot && "text-xs",
            )}
          >
            {node.title || node.artifact_id}
          </Link>
          <span className="text-[10px] capitalize text-muted-foreground/70">
            {node.artifact_type}
          </span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <ul
          role="list"
          aria-label={`Children of ${node.title || node.artifact_id}`}
          className="mt-1 flex flex-col gap-1"
        >
          {node.children.map((child) => (
            <LineageNode
              key={`${child.artifact_id}-${child.edge_type}-${child.depth}`}
              node={child}
            />
          ))}
        </ul>
      )}

      {/* Sibling overflow hint */}
      {node.next_sibling_cursor && (
        <p className="mt-0.5 pl-5 text-[10px] italic text-muted-foreground/60">
          More siblings not shown
        </p>
      )}
    </li>
  );
}

function ResearchLineagePanel({ artifactId }: { artifactId: string | undefined }) {
  const { data, isLoading, isError, error, refetch } = useLineage(artifactId);

  if (!artifactId) {
    return (
      <div
        role="status"
        className="py-6 text-center text-xs text-muted-foreground"
      >
        No artifact selected
      </div>
    );
  }

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading lineage" className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="flex animate-pulse items-center gap-1.5 px-1"
          >
            <div
              className="size-4 shrink-0 rounded-sm bg-muted"
              style={{ marginLeft: `${(i % 3) * 12}px` }}
            />
            <div className="h-3 flex-1 rounded bg-muted" style={{ maxWidth: `${70 - i * 8}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (isError && error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-4 text-center"
      >
        <AlertCircle aria-hidden="true" className="size-4 text-destructive" />
        <p className="text-xs text-muted-foreground">Unable to load lineage</p>
        <p className="text-[10px] text-muted-foreground/70">{error.message}</p>
        <button
          type="button"
          onClick={refetch}
          className={cn(
            "inline-flex h-7 items-center rounded border border-destructive/40 px-2 text-[11px] text-destructive",
            "hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Retry
        </button>
      </div>
    );
  }

  // Artifact not in overlay yet
  if (!data?.found || !data.root) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2 rounded-md border border-dashed px-3 py-6 text-center"
      >
        <GitMerge aria-hidden="true" className="size-5 text-muted-foreground/40" />
        <p className="text-xs font-medium text-foreground">No lineage data</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Lineage appears after the artifact is compiled and reconciled into
          the overlay.
        </p>
      </div>
    );
  }

  const root = data.root;
  const hasChildren = root.children.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <ul role="tree" aria-label="Synthesis lineage tree" className="flex flex-col gap-1">
        <LineageNode node={root} isRoot />
      </ul>

      {!hasChildren && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No child artifacts derived from this one yet.
        </p>
      )}

      {/* Diagnostic footer */}
      <p className="mt-1 text-[10px] text-muted-foreground/50">
        Depth {data.depth} &middot; {data.raw_edge_count} edge
        {data.raw_edge_count !== 1 ? "s" : ""} traversed
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Metadata (research variant) — same data as Properties, research framing
// ---------------------------------------------------------------------------

function ResearchMetadataPanel({ artifact }: { artifact: Artifact | undefined }) {
  if (!artifact) {
    return (
      <div
        role="status"
        className="py-6 text-center text-xs text-muted-foreground"
      >
        No artifact selected
      </div>
    );
  }

  const fm = artifact.frontmatter_jsonb ?? {};
  const metaKeys = Object.keys(fm).filter(
    (k) => !["tags"].includes(k),
  );

  return (
    <dl className="flex flex-col gap-2.5 text-xs">
      <div>
        <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Type
        </dt>
        <dd className="mt-0.5 capitalize">{artifact.type ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Status
        </dt>
        <dd className="mt-0.5 capitalize">{artifact.status ?? "—"}</dd>
      </div>
      {artifact.summary && (
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Summary
          </dt>
          <dd className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {artifact.summary}
          </dd>
        </div>
      )}
      {/* Dynamic frontmatter fields — research artifacts may carry custom keys */}
      {metaKeys.slice(0, 8).map((key) => {
        const val = fm[key];
        const displayVal =
          typeof val === "string" || typeof val === "number" || typeof val === "boolean"
            ? String(val)
            : Array.isArray(val)
              ? (val as string[]).join(", ")
              : null;
        if (!displayVal) return null;
        return (
          <div key={key}>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {key.replace(/_/g, " ")}
            </dt>
            <dd className="mt-0.5 break-all font-mono text-[10px] text-foreground/80">
              {displayVal}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Panel: Syntheses (research variant) — recent synthesis artifacts list
// Backed by GET /api/research/recent-syntheses (P4-01).
// ---------------------------------------------------------------------------

/**
 * Compact row for a single synthesis artifact.
 * Renders the title linked to the detail page plus a relative updated_at time.
 */
function SynthesisRow({ id, title, updated }: { id: string; title: string; updated: string | null }) {
  return (
    <li className="flex flex-col gap-0.5 rounded-md border bg-card px-2.5 py-2 text-xs">
      <Link
        href={`/artifact/${id}`}
        className={cn(
          "truncate font-medium text-foreground",
          "hover:underline underline-offset-2",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
        )}
      >
        {title}
      </Link>
      {updated && (
        <time
          dateTime={updated}
          className="text-[10px] text-muted-foreground/70"
        >
          <RelativeTime iso={updated} />
        </time>
      )}
    </li>
  );
}

/**
 * Exported variant of SynthesesPanel that accepts an optional topicId scope.
 * Used by Research Home when the user selects a topic in the WorkspaceSelector.
 */
export function ResearchSynthesesPanel({ topicId }: { topicId?: string }) {
  return <SynthesesPanel topicId={topicId} />;
}

function SynthesesPanel({ topicId }: { topicId?: string } = {}) {
  const { syntheses, isLoading, isError, error } = useRecentSyntheses({
    limit: 10,
    ...(topicId ? { topic_id: topicId } : {}),
  });

  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="Loading recent syntheses" className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="flex animate-pulse flex-col gap-1 rounded-md border bg-card px-2.5 py-2"
          >
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-2.5 w-1/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (isError && error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-4 text-center"
      >
        <AlertCircle aria-hidden="true" className="size-4 text-destructive" />
        <p className="text-xs text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (syntheses.length === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2 rounded-md border border-dashed px-3 py-6 text-center"
      >
        <FileText aria-hidden="true" className="size-5 text-muted-foreground/40" />
        <p className="text-xs font-medium text-foreground">No recent syntheses.</p>
      </div>
    );
  }

  return (
    <ul role="list" aria-label="Recent syntheses" className="flex flex-col gap-1">
      {syntheses.map((item) => (
        <SynthesisRow
          key={item.id}
          id={item.id}
          title={item.title}
          updated={item.updated}
        />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Tab sets
// ---------------------------------------------------------------------------

const GENERIC_TABS: ContextRailTab[] = [
  {
    id: "properties",
    label: "Properties",
    renderContent: (_id, artifact) => <PropertiesPanel artifact={artifact} />,
  },
  {
    id: "connections",
    label: "Connections",
    renderContent: (artifactId) => <ConnectionsPanel artifactId={artifactId} />,
  },
  {
    id: "history",
    label: "History",
    // Activity entries are not yet fetched (endpoint not shipped).
    // OQ-P3-03-C: pass null so HistoryPanel renders the graceful empty state.
    renderContent: () => <HistoryPanel entries={null} />,
  },
];

const RESEARCH_TABS: ContextRailTab[] = [
  {
    id: "evidence",
    label: "Evidence",
    renderContent: () => <EvidencePanel />,
  },
  {
    id: "contradictions",
    label: "Contradictions",
    renderContent: () => <ContradictionsPanel />,
  },
  {
    id: "lineage",
    label: "Lineage",
    renderContent: (artifactId) => <ResearchLineagePanel artifactId={artifactId} />,
  },
  {
    id: "syntheses",
    label: "Syntheses",
    renderContent: () => <SynthesesPanel />,
  },
  {
    id: "metadata",
    label: "Metadata",
    renderContent: (_id, artifact) => <ResearchMetadataPanel artifact={artifact} />,
  },
];

// ---------------------------------------------------------------------------
// ContextRail — main component
// ---------------------------------------------------------------------------

/**
 * ContextRail renders a tabbed right-column context panel for detail surfaces.
 *
 * Mount in a flex/grid right-column slot. The parent controls visibility
 * at responsive breakpoints (typically `hidden lg:flex` or similar).
 *
 * Example:
 * ```tsx
 * <div className="flex gap-6">
 *   <div className="min-w-0 flex-1">{mainContent}</div>
 *   <div className="hidden w-72 shrink-0 lg:block">
 *     <ContextRail variant="generic" artifactId={id} artifact={artifact} />
 *   </div>
 * </div>
 * ```
 */
export function ContextRail({
  variant = "generic",
  customTabs,
  artifactId,
  artifact,
  actions,
  className,
  ariaLabel = "Context rail",
}: ContextRailProps) {
  const tabs = customTabs ?? (variant === "research" ? RESEARCH_TABS : GENERIC_TABS);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id ?? "");

  // Guard: no tabs configured
  if (tabs.length === 0) return null;

  // Ensure activeTabId is valid (e.g. after prop change)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  function tabBtnId(tabId: string) {
    return `ctx-rail-tab-btn-${tabId}`;
  }
  function tabPanelId(tabId: string) {
    return `ctx-rail-tab-panel-${tabId}`;
  }

  return (
    <div
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-3", className)}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Rail-owned action column (DP1-03 #2)                               */}
      {/* Action buttons migrate from header row into this column per ADR §1 */}
      {/* ------------------------------------------------------------------ */}
      {actions && actions.length > 0 && (
        <div
          role="group"
          aria-label="Artifact actions"
          className="flex flex-col gap-1.5"
        >
          {actions.map(({ label, ariaLabel: btnAriaLabel, description, onClick, icon: Icon, disabled }) => (
            <button
              key={label}
              type="button"
              aria-label={btnAriaLabel}
              aria-disabled={(disabled || !onClick) ? "true" : undefined}
              disabled={disabled}
              title={description}
              onClick={
                disabled
                  ? undefined
                  : onClick
                    ? onClick
                    : () => {
                        console.debug(`[ContextRail] Action stub: "${label}" — ${description}`);
                      }
              }
              className={cn(
                // shadcn Button variant="outline" pattern
                "inline-flex h-8 w-full items-center justify-start gap-2 rounded-md border bg-background px-3 text-xs font-medium",
                "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                disabled
                  ? "cursor-not-allowed text-muted-foreground opacity-60"
                  : onClick
                    ? "hover:bg-accent hover:text-accent-foreground"
                    : "cursor-default text-muted-foreground hover:bg-muted/50",
              )}
            >
              {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Tab bar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex overflow-x-auto border-b scrollbar-none [-webkit-overflow-scrolling:touch]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={tabBtnId(tab.id)}
            role="tab"
            type="button"
            aria-selected={tab.id === activeTab.id}
            aria-controls={tabPanelId(tab.id)}
            onClick={() => setActiveTabId(tab.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              tab.id === activeTab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab panels                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            id={tabPanelId(tab.id)}
            role="tabpanel"
            aria-labelledby={tabBtnId(tab.id)}
            hidden={tab.id !== activeTab.id}
            className="px-0.5 pb-2"
          >
            {tab.id === activeTab.id
              ? tab.renderContent(artifactId, artifact)
              : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Named panel exports — for surfaces that want to compose panels individually
// ---------------------------------------------------------------------------

export type { ActivityEntry };

export {
  PropertiesPanel,
  ConnectionsPanel,
  HistoryPanel,
  EvidencePanel,
  ContradictionsPanel,
  ResearchLineagePanel as LineagePanel,
  ResearchMetadataPanel as MetadataGridPanel,
};

// ---------------------------------------------------------------------------
// Tab set exports — for surfaces that want to extend the default tab set
// ---------------------------------------------------------------------------

export { GENERIC_TABS, RESEARCH_TABS };
