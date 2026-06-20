"use client";

/**
 * ArtifactPeekModal — lightweight peek overlay for content-context artifact previews.
 *
 * Wraps @miethe/ui BaseArtifactModal to render a focused summary view of an artifact
 * without mounting the full ArtifactDetailClient (~2600 lines). This is intentionally
 * light: summary prose + Knowledge / Source tab + Connections tab.
 *
 * Tabs:
 *   knowledge   — compiled_content via ArticleViewer (empty state if not yet compiled)
 *   source      — raw_content via ArticleViewer (only shown when artifact is a source type)
 *   connections — incoming + outgoing edges from useArtifactEdges
 *
 * headerActions slot: "Expand" button → router.push(/artifact/:id).
 *
 * Focus trap + Esc are provided by BaseArtifactModal's Radix Dialog primitive.
 *
 * OQ-2: this modal is for CONTENT-CONTEXT opens only. Explicit link clicks in the
 * sidebar, ContextRail, and navigation elements continue to navigate full-page — this
 * modal does NOT intercept those paths.
 *
 * Deep-link via ?peek=<id>: handled by ArtifactPeekProvider (see ArtifactPeekProvider.tsx).
 * This component is agnostic to that mechanism — it just receives `artifactId` and
 * `open`/`onClose` from the provider context.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  Network,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { BaseArtifactModal } from "@miethe/ui";
import { ArticleViewer } from "@miethe/ui";
import { TabsContent } from "@miethe/ui";
import type { ArtifactTypeConfig, ModalTab } from "@miethe/ui";
import { useArtifact } from "@/hooks/useArtifact";
import { useArtifactEdges } from "@/hooks/useArtifactEdges";
import type { ArtifactEdgeItem } from "@/hooks/useArtifactEdges";
import { useArtifactPeek } from "@/components/artifact/ArtifactPeekProvider";
import { cn } from "@/lib/utils";
import { getArtifactTypeLabel } from "@/lib/artifact-type-presentation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Artifact types considered "source" — shown a Source tab alongside Knowledge. */
const SOURCE_TYPES = new Set([
  "raw_note",
  "raw_url",
  "raw_upload",
  "raw_transcript",
  "raw_import",
  "source_summary",
]);

function isSourceType(type: string): boolean {
  return SOURCE_TYPES.has(type) || type.startsWith("raw_");
}

/** Maps MeatyWiki artifact types to Lucide icon names for BaseArtifactModal. */
const ARTIFACT_ICON_MAP: Record<string, string> = {
  raw_note: "StickyNote",
  raw_url: "Globe",
  raw_upload: "Upload",
  raw_transcript: "Mic",
  raw_import: "Download",
  source_summary: "FileText",
  concept: "Lightbulb",
  entity: "Building2",
  topic: "Tag",
  topic_note: "Tag",
  synthesis: "Layers",
  evidence: "Scale",
  evidence_matrix: "Table2",
  contradiction_matrix: "GitCompare",
  glossary: "BookOpen",
  glossary_term: "BookOpen",
  blog_idea: "Pencil",
  blog_outline: "List",
  blog_draft: "FileEdit",
  series: "Library",
  context_pack: "Package",
  brief: "ClipboardList",
  prd: "ClipboardList",
  adr: "Gavel",
  implementation_plan: "Map",
  session_log: "Activity",
  decision: "CheckCircle2",
  risk: "AlertTriangle",
  intent: "Target",
  memory_item: "Brain",
};

/** Maps artifact types to a Tailwind color class for the header icon. */
const ARTIFACT_COLOR_MAP: Record<string, string> = {
  raw_note: "text-slate-500",
  raw_url: "text-slate-500",
  raw_upload: "text-slate-500",
  raw_transcript: "text-teal-600",
  raw_import: "text-violet-600",
  source_summary: "text-cyan-600",
  concept: "text-sky-500",
  entity: "text-violet-500",
  topic: "text-orange-500",
  topic_note: "text-orange-500",
  synthesis: "text-emerald-500",
  evidence: "text-rose-500",
  evidence_matrix: "text-rose-500",
  contradiction_matrix: "text-red-500",
  glossary: "text-zinc-500",
  glossary_term: "text-zinc-500",
  blog_idea: "text-amber-500",
  blog_outline: "text-amber-600",
  blog_draft: "text-amber-700",
  series: "text-amber-800",
  context_pack: "text-indigo-500",
  brief: "text-indigo-600",
  prd: "text-indigo-700",
  adr: "text-indigo-800",
  implementation_plan: "text-blue-600",
  session_log: "text-fuchsia-600",
  decision: "text-teal-600",
  risk: "text-red-600",
  intent: "text-violet-700",
  memory_item: "text-lime-600",
};

function getTypeConfig(type: string): ArtifactTypeConfig | undefined {
  const icon = ARTIFACT_ICON_MAP[type] ?? "FileText";
  const color = ARTIFACT_COLOR_MAP[type] ?? "text-muted-foreground";
  return { icon, color };
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const KNOWLEDGE_TAB: ModalTab = {
  value: "knowledge",
  label: "Knowledge",
  icon: BookOpen,
};

const SOURCE_TAB: ModalTab = {
  value: "source",
  label: "Source",
  icon: FileText,
};

const CONNECTIONS_TAB: ModalTab = {
  value: "connections",
  label: "Connections",
  icon: Network,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingPane() {
  return (
    <div
      role="status"
      aria-label="Loading artifact"
      className="flex h-full items-center justify-center py-20"
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

function ErrorPane({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 py-16 text-center"
    >
      <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Renders the compact summary prose block above the tab area. */
function SummaryBlock({ summary }: { summary: string | null | undefined }) {
  if (!summary) return null;
  return (
    <div className="border-b px-6 pb-4 pt-3">
      <p className="text-sm leading-relaxed text-muted-foreground line-clamp-4">{summary}</p>
    </div>
  );
}

/** Single edge row in the Connections tab. Clicking opens the connected artifact in the peek modal. */
function EdgeRow({ edge, direction }: { edge: ArtifactEdgeItem; direction: "incoming" | "outgoing" }) {
  const { openPeek } = useArtifactPeek();
  const Arrow = direction === "incoming" ? ArrowDownLeft : ArrowUpRight;
  const colorClass = direction === "incoming"
    ? "text-sky-600 dark:text-sky-400"
    : "text-emerald-600 dark:text-emerald-400";

  const label = edge.title ?? edge.artifact_id;

  return (
    <li>
      <button
        type="button"
        onClick={() => openPeek(edge.artifact_id)}
        aria-label={`Peek at ${label}`}
        className={cn(
          "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left",
          "hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          "transition-colors",
        )}
      >
        {/* Direction arrow is decorative — direction is conveyed by the section heading */}
        <Arrow
          className={cn("mt-0.5 h-4 w-4 flex-shrink-0", colorClass)}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {label}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="capitalize">{edge.type.replace(/_/g, " ")}</span>
            {edge.subtype ? ` · ${edge.subtype}` : ""}
          </p>
        </div>
      </button>
    </li>
  );
}

/** Connections tab content with incoming + outgoing edge lists. */
function ConnectionsTabContent({ artifactId }: { artifactId: string }) {
  const { data, isLoading, isError } = useArtifactEdges(artifactId);

  if (isLoading) return <LoadingPane />;
  if (isError || !data) {
    return <ErrorPane message="Could not load connections for this artifact." />;
  }

  const totalEdges = data.incoming.length + data.outgoing.length;

  if (totalEdges === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <Network className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">No connections recorded.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 overflow-y-auto py-4">
      {data.incoming.length > 0 && (
        <section aria-labelledby="peek-incoming-heading">
          <h3
            id="peek-incoming-heading"
            className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Incoming ({data.incoming.length})
          </h3>
          <ul className="space-y-0.5">
            {data.incoming.map((edge) => (
              <EdgeRow
                key={`in-${edge.artifact_id}-${edge.type}`}
                edge={edge}
                direction="incoming"
              />
            ))}
          </ul>
        </section>
      )}

      {data.outgoing.length > 0 && (
        <section aria-labelledby="peek-outgoing-heading">
          <h3
            id="peek-outgoing-heading"
            className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Outgoing ({data.outgoing.length})
          </h3>
          <ul className="space-y-0.5">
            {data.outgoing.map((edge) => (
              <EdgeRow
                key={`out-${edge.artifact_id}-${edge.type}`}
                edge={edge}
                direction="outgoing"
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ArtifactPeekModalProps {
  /** Artifact ID to display. When null/undefined, the modal renders nothing. */
  artifactId: string | null | undefined;
  /** Whether the modal is open. */
  open: boolean;
  /** Called when the modal should close (Esc, overlay click, explicit close). */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ArtifactPeekModal — lightweight artifact peek dialog.
 *
 * Renders a subset of artifact data (summary + 2-3 tabs) over any page.
 * Does not re-mount ArtifactDetailClient; all data is fetched fresh via
 * useArtifact + useArtifactEdges at the modal level.
 *
 * Client-only component — must be used inside a client component tree
 * (Next.js App Router: 'use client' files or dynamic() import with ssr: false).
 */
export function ArtifactPeekModal({
  artifactId,
  open,
  onClose,
}: ArtifactPeekModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<string>("knowledge");

  // Fetch artifact detail when we have an ID and the modal is open.
  const { artifact, isLoading, isError, isNotFound } = useArtifact(
    artifactId ?? "",
  );

  // Reset to knowledge tab whenever a new artifact is opened.
  React.useEffect(() => {
    if (open && artifactId) {
      setActiveTab("knowledge");
    }
  }, [open, artifactId]);

  // Do not render anything if no artifact ID is provided.
  if (!artifactId) return null;

  // Build tab list based on artifact type (available after data loads).
  const showSourceTab =
    artifact !== undefined && isSourceType(artifact.type);

  const tabs: ModalTab[] = [
    KNOWLEDGE_TAB,
    ...(showSourceTab ? [SOURCE_TAB] : []),
    CONNECTIONS_TAB,
  ];

  // Expand action — navigate to full artifact detail page.
  function handleExpand() {
    if (!artifactId) return;
    onClose();
    router.push(`/artifact/${encodeURIComponent(artifactId)}`);
  }

  // Build minimal ModalArtifact shape for the BaseArtifactModal header.
  // While loading, provide a stable description so Radix Dialog always has an
  // accessible describedby target and never emits the aria-describedby warning.
  const modalArtifact = artifact
    ? {
        name: artifact.title,
        type: artifact.type,
        description: getArtifactTypeLabel(artifact.type),
      }
    : {
        name: "Loading…",
        type: "unknown",
        description: "Loading artifact details",
      };

  // Header actions slot — Expand button.
  const headerActions = (
    <button
      type="button"
      onClick={handleExpand}
      disabled={!artifact}
      aria-label={`Open ${artifact?.title ?? "artifact"} on full page`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5",
        "text-sm font-medium text-foreground shadow-sm",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "transition-colors",
      )}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      Expand
    </button>
  );

  // Summary block (rendered above tabs via aboveTabsContent).
  const aboveTabsContent =
    artifact && artifact.summary ? (
      <SummaryBlock summary={artifact.summary} />
    ) : undefined;

  return (
    <BaseArtifactModal
      artifact={modalArtifact}
      open={open}
      onClose={onClose}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabs={tabs}
      headerActions={headerActions}
      aboveTabsContent={aboveTabsContent}
      getTypeConfig={getTypeConfig}
      maxWidth="max-w-3xl lg:max-w-4xl"
    >
      {/* Knowledge tab — compiled content */}
      <TabsContent
        value="knowledge"
        className="flex-1 overflow-y-auto px-0 py-4 focus-visible:ring-0"
      >
        {isLoading && <LoadingPane />}
        {isError && !isLoading && (
          <ErrorPane
            message={
              isNotFound
                ? "This artifact was not found."
                : "Failed to load artifact. The backend may be unavailable."
            }
          />
        )}
        {artifact && !isLoading && !isError && (
          artifact.compiled_content ? (
            <ArticleViewer
              content={artifact.compiled_content}
              variant="editorial"
              format="auto"
              sanitize
              className="px-6"
            />
          ) : (
            <div
              role="status"
              className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed mx-6 py-12 text-center"
            >
              <p className="text-sm text-muted-foreground">No compiled content yet.</p>
              <p className="text-xs text-muted-foreground/60">
                Run Compile from the full artifact view to generate knowledge output.
              </p>
            </div>
          )
        )}
      </TabsContent>

      {/* Source tab — shown for raw/* and source_summary types */}
      {showSourceTab && (
        <TabsContent
          value="source"
          className="flex-1 overflow-y-auto px-0 py-4 focus-visible:ring-0"
        >
          {artifact.raw_content ? (
            <ArticleViewer
              content={artifact.raw_content}
              variant="editorial"
              format="auto"
              sanitize
              className="px-6"
            />
          ) : (
            <div
              role="status"
              className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed mx-6 py-12 text-center"
            >
              <p className="text-sm text-muted-foreground">No source content.</p>
              <p className="text-xs text-muted-foreground/60">
                Source content appears after the artifact is ingested.
              </p>
            </div>
          )}
        </TabsContent>
      )}

      {/* Connections tab — incoming + outgoing edges */}
      <TabsContent
        value="connections"
        className="flex-1 overflow-y-auto px-0 focus-visible:ring-0"
      >
        <ConnectionsTabContent artifactId={artifactId} />
      </TabsContent>
    </BaseArtifactModal>
  );
}
