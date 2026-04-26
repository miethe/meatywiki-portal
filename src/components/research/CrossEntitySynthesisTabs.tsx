"use client";

/**
 * CrossEntitySynthesisTabs — tabbed feed of recent cross-entity synthesis artifacts.
 *
 * ADR-DPI-004 DP1-06 #4: Cross-Entity Synthesis tabbed section.
 *
 * This is a READ-ONLY feed of synthesis artifacts, NOT the Synthesis Builder
 * (DP4-02d). It surfaces recent cross-entity synthesis artifacts grouped by
 * entity. Each entity drives a tab label; clicking a tab shows that entity's
 * associated synthesis list. An "All" tab flattens every entity's syntheses.
 *
 * Data source: GET /api/research/cross-entity-synthesis via useCrossEntitySynthesis().
 * Cursor pagination — "Load more" appends additional entity tabs and their
 * associated syntheses.
 *
 * WCAG 2.1 AA: tab list + tabpanel with aria-controls / aria-selected pattern.
 *
 * Stitch reference: Research Home (0cf6fb7b…) — Cross-Entity Synthesis tabs.
 * Portal v1.7 Phase 4 (P4-08).
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { Network, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";
import { useCrossEntitySynthesis } from "@/hooks/useCrossEntitySynthesis";
import type { ArtifactCard } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div
      aria-hidden="true"
      className="flex animate-pulse items-start gap-2 rounded-md border bg-card px-3 py-2.5"
    >
      <div className="mt-0.5 h-4 w-14 rounded-sm bg-muted" />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Synthesis artifact row
// ---------------------------------------------------------------------------

function SynthesisRow({ artifact }: { artifact: ArtifactCard }) {
  return (
    <li className="flex items-start gap-2 rounded-md border bg-card px-3 py-2.5 transition-shadow hover:shadow-sm">
      {artifact.subtype && (
        <span className="mt-0.5 shrink-0">
          <TypeBadge type={artifact.subtype} />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/artifact/${artifact.id}`}
          className={cn(
            "truncate text-sm font-medium text-foreground leading-snug",
            "hover:underline underline-offset-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
          )}
        >
          {artifact.title}
        </Link>

        {artifact.updated && (
          <p className="text-xs text-muted-foreground">
            {new Date(artifact.updated).toLocaleDateString()}
          </p>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyFeed({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="rounded-md border border-dashed px-3 py-8 text-center"
    >
      <p className="text-xs text-muted-foreground">
        {label === "All"
          ? "No cross-entity syntheses found."
          : `No syntheses for ${label}.`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface CrossEntitySynthesisTabsProps {
  className?: string;
}

/**
 * CrossEntitySynthesisTabs renders a tabbed feed of cross-entity synthesis
 * artifacts, driven by live data from useCrossEntitySynthesis().
 *
 * Entity names serve as tab labels. The "All" tab is always present and
 * flattens every entity's synthesis list. Clicking "Load more" fetches the
 * next cursor page and appends any new entity tabs and their syntheses.
 */
export function CrossEntitySynthesisTabs({
  className,
}: CrossEntitySynthesisTabsProps) {
  const {
    entries,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
  } = useCrossEntitySynthesis();

  // Active tab is either "all" or an entity id string
  const [activeTab, setActiveTab] = useState<string>("all");

  // Build tab list from loaded entries
  const tabs = useMemo(() => {
    const entityTabs = entries.map((entry) => ({
      id: entry.entity.id,
      label: entry.entity.title,
    }));
    return [{ id: "all", label: "All" }, ...entityTabs];
  }, [entries]);

  // Resolve currently visible syntheses
  const visibleSyntheses = useMemo<ArtifactCard[]>(() => {
    if (activeTab === "all") {
      return entries.flatMap((entry) => entry.syntheses);
    }
    const entry = entries.find((e) => e.entity.id === activeTab);
    return entry?.syntheses ?? [];
  }, [entries, activeTab]);

  // Keep active tab valid when entries change (e.g., initial load sets "all")
  const activeTabDef = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  const activeTabId = activeTabDef?.id ?? "all";
  const activeTabLabel = activeTabDef?.label ?? "All";
  const panelId = `synth-panel-${activeTabId}`;

  return (
    <section aria-labelledby="cross-entity-synth-heading" className={className}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Network aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2
          id="cross-entity-synth-heading"
          className="text-sm font-semibold text-foreground"
        >
          Cross-Entity Synthesis
        </h2>
      </div>

      {/* Error state */}
      {isError && (
        <div role="alert" className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error?.message ?? "Failed to load cross-entity syntheses."}
        </div>
      )}

      {/* Tab list — hidden while loading first page */}
      {!isLoading && (
        <div
          role="tablist"
          aria-label="Synthesis entity filter"
          className="mb-3 flex gap-1 overflow-x-auto rounded-md border bg-muted/40 p-1"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`synth-tab-${tab.id}`}
              aria-selected={activeTabId === tab.id}
              aria-controls={`synth-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex shrink-0 items-center rounded-sm px-3 py-1 text-xs font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                activeTabId === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`synth-tab-${activeTabId}`}
      >
        {isLoading ? (
          <ul
            role="list"
            aria-busy="true"
            aria-label="Cross-entity synthesis loading"
            className="flex flex-col gap-1.5"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </ul>
        ) : visibleSyntheses.length === 0 ? (
          <EmptyFeed label={activeTabLabel} />
        ) : (
          <ul
            role="list"
            aria-label={`${activeTabLabel} cross-entity syntheses`}
            className="flex flex-col gap-1.5"
          >
            {visibleSyntheses.map((artifact) => (
              <SynthesisRow key={artifact.id} artifact={artifact} />
            ))}
          </ul>
        )}
      </div>

      {/* Load more */}
      {!isLoading && hasNextPage && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border bg-background px-4 py-1.5 text-xs font-medium",
              "text-muted-foreground hover:text-foreground transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <ChevronDown aria-hidden="true" className="size-3" />
                Load more
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
