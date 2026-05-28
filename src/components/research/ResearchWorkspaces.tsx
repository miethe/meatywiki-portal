"use client";

/**
 * ResearchWorkspaces — workspace picker + research-derived artifact list.
 *
 * UI:
 *   - Chip row: one chip per workspace slug (inbox / library / research / blog / projects).
 *     Selecting a chip fetches GET /api/research/artifacts?workspace_id=<slug>.
 *   - Artifact list: title, type badge, creation date, link to /artifacts/[id].
 *   - Independent loading / empty / error states per workspace selection.
 *   - "Load more" cursor pagination.
 *
 * Design decisions:
 *   - Chip row is preferred over a dropdown so the five workspaces are always
 *     visible at a glance; chips wrap naturally on narrow viewports.
 *   - No workspace is pre-selected on mount — user initiates the query.
 *   - WCAG 2.1 AA: role="listbox" on chip row, role="option" on each chip,
 *     aria-selected, aria-label on navigation links.
 *
 * P5-05 (portal-research-workflow-realignment-v2-1).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  FolderOpen,
  Layers,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listResearchArtifacts,
  type ResearchArtifactItem,
  type ResearchWorkspaceSlug,
} from "@/lib/api/research-home";

// ---------------------------------------------------------------------------
// Workspace metadata
// ---------------------------------------------------------------------------

interface WorkspaceMeta {
  slug: ResearchWorkspaceSlug;
  label: string;
  Icon: React.ElementType;
}

const WORKSPACES: WorkspaceMeta[] = [
  { slug: "library", label: "Library", Icon: BookOpen },
  { slug: "research", label: "Research", Icon: ScrollText },
  { slug: "projects", label: "Projects", Icon: FolderOpen },
  { slug: "inbox", label: "Inbox", Icon: Layers },
  { slug: "blog", label: "Blog", Icon: ScrollText },
];

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
// Workspace chip
// ---------------------------------------------------------------------------

interface WorkspaceChipProps {
  meta: WorkspaceMeta;
  selected: boolean;
  onSelect: (slug: ResearchWorkspaceSlug) => void;
}

function WorkspaceChip({ meta, selected, onSelect }: WorkspaceChipProps) {
  const { slug, label, Icon } = meta;

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={`Show research artifacts in the ${label} workspace`}
      onClick={() => onSelect(slug)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
        "text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5"
    >
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty + prompt states
// ---------------------------------------------------------------------------

function PromptState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-6 py-7 text-center">
      <Layers aria-hidden="true" className="size-6 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">
        Select a workspace above to browse research-derived artifacts.
      </p>
    </div>
  );
}

function EmptyState({ workspace }: { workspace: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-6 py-7 text-center">
      <Layers aria-hidden="true" className="size-6 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">
        No research artifacts found in the{" "}
        <span className="font-medium text-foreground">{workspace}</span>{" "}
        workspace.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact row
// ---------------------------------------------------------------------------

interface ArtifactRowProps {
  item: ResearchArtifactItem;
  onClick: (id: string) => void;
}

function ArtifactRow({ item, onClick }: ArtifactRowProps) {
  const typeLabel = item.subtype
    ? `${item.type} / ${item.subtype}`
    : item.type;

  return (
    <article
      aria-label={item.title}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card px-3 py-2.5",
        "transition-colors hover:border-border/80 hover:bg-muted/20",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-foreground">
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
      </div>

      <span
        aria-label={`Type: ${typeLabel}`}
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5",
          "text-[10px] font-semibold uppercase tracking-wide",
          "bg-muted text-muted-foreground",
        )}
      >
        {typeLabel}
      </span>

      <button
        type="button"
        aria-label={`View artifact: ${item.title}`}
        onClick={() => onClick(item.artifact_id)}
        className={cn(
          "shrink-0 rounded border border-border px-2 py-0.5",
          "text-[11px] font-medium text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Open
      </button>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResearchWorkspaces() {
  const router = useRouter();

  const [selected, setSelected] = useState<ResearchWorkspaceSlug | null>(null);
  const [artifacts, setArtifacts] = useState<ResearchArtifactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPage = useCallback(
    async (
      workspace: ResearchWorkspaceSlug,
      nextCursor: string | null,
      append: boolean,
    ) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const envelope = await listResearchArtifacts({
          workspace_id: workspace,
          cursor: nextCursor,
          limit: 20,
        });

        if (!mountedRef.current) return;

        setArtifacts((prev) =>
          append ? [...prev, ...envelope.data] : envelope.data,
        );
        setCursor(envelope.cursor);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load research artifacts",
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

  const handleSelect = useCallback(
    (slug: ResearchWorkspaceSlug) => {
      if (slug === selected) return;
      setSelected(slug);
      setArtifacts([]);
      setCursor(null);
      void fetchPage(slug, null, false);
    },
    [selected, fetchPage],
  );

  const handleLoadMore = useCallback(() => {
    if (selected && cursor) void fetchPage(selected, cursor, true);
  }, [selected, cursor, fetchPage]);

  const handleArtifactClick = useCallback(
    (id: string) => {
      router.push(`/artifacts/${encodeURIComponent(id)}`);
    },
    [router],
  );

  const selectedLabel =
    WORKSPACES.find((w) => w.slug === selected)?.label ?? "";
  const hasArtifacts = artifacts.length > 0;
  const hasMore = cursor !== null;

  return (
    <section
      aria-label="Research Workspaces"
      className="flex flex-col gap-3"
    >
      {/* Workspace chip row */}
      <div
        role="listbox"
        aria-label="Workspace filter — select a workspace to view research artifacts"
        aria-orientation="horizontal"
        className="flex flex-wrap gap-2"
      >
        {WORKSPACES.map((meta) => (
          <WorkspaceChip
            key={meta.slug}
            meta={meta}
            selected={selected === meta.slug}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Content area */}
      <div aria-live="polite" aria-atomic="false">
        {/* Prompt (no selection yet) */}
        {!selected && <PromptState />}

        {/* Loading skeleton */}
        {loading && selected && (
          <div
            aria-busy="true"
            aria-label="Loading research artifacts"
            className="flex flex-col gap-2"
          >
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )}

        {/* Error banner */}
        {error && !loading && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <AlertCircle aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && selected && !hasArtifacts && (
          <EmptyState workspace={selectedLabel} />
        )}

        {/* Artifact list */}
        {!loading && hasArtifacts && (
          <div
            role="list"
            aria-label={`Research artifacts in the ${selectedLabel} workspace`}
            className="flex flex-col gap-2"
          >
            {artifacts.map((item) => (
              <div key={item.artifact_id} role="listitem">
                <ArtifactRow item={item} onClick={handleArtifactClick} />
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && !error && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              aria-label="Load more research artifacts"
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
      </div>
    </section>
  );
}
