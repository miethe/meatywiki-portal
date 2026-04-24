"use client";

/**
 * CrossEntitySynthesisTabs — tabbed feed of recent cross-entity synthesis artifacts.
 *
 * ADR-DPI-004 DP1-06 #4: Cross-Entity Synthesis tabbed section.
 *
 * This is a READ-ONLY feed of synthesis artifacts, NOT the Synthesis Builder
 * (DP4-02d). It surfaces recent cross-entity synthesis artifacts grouped by
 * "scope" (e.g., concept ↔ entity, concept ↔ topic, entity ↔ entity).
 *
 * Tab groups:
 *   "All"         — all cross-entity synthesis artifacts, newest first
 *   "Concept ↔ Entity" — syntheses bridging concept + entity subtypes
 *   "Concept ↔ Topic"  — syntheses bridging concept + topic subtypes
 *
 * Backend aggregate endpoint not yet available.
 *   Missing endpoint: GET /api/research/cross-entity-synthesis
 *     Returns: { data: { items: Array<SynthesisItem> } }
 *     SynthesisItem:
 *       { id, title, subtype, scope, updated, source_count, snippet? }
 *     Query params: scope? ("concept_entity" | "concept_topic" | "entity_entity"),
 *                   limit (default 10), topic_id?, cursor?
 *
 * While the endpoint is absent all tabs render skeletons. When the endpoint
 * ships replace stub logic with a hook call (e.g. useCrossEntitySynthesis).
 *
 * WCAG 2.1 AA: tab list + tabpanel with aria-controls / aria-selected pattern.
 *
 * Stitch reference: Research Home (0cf6fb7b…) — Cross-Entity Synthesis tabs.
 */

import { useState } from "react";
import Link from "next/link";
import { Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypeBadge } from "@/components/ui/type-badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SynthesisScope =
  | "all"
  | "concept_entity"
  | "concept_topic"
  | "entity_entity";

export interface SynthesisItem {
  id: string;
  title: string;
  subtype?: string | null;
  scope?: SynthesisScope | null;
  updated?: string | null;
  source_count?: number | null;
  snippet?: string | null;
}

export interface CrossEntitySynthesisTabsProps {
  /** Items per tab; undefined = endpoint missing (show skeleton + notice) */
  items?: SynthesisItem[];
  isLoading?: boolean;
  topicId?: string | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

interface TabDef {
  id: SynthesisScope;
  label: string;
  panelId: string;
}

const TABS: TabDef[] = [
  { id: "all", label: "All", panelId: "synth-panel-all" },
  { id: "concept_entity", label: "Concept ↔ Entity", panelId: "synth-panel-ce" },
  { id: "concept_topic", label: "Concept ↔ Topic", panelId: "synth-panel-ct" },
];

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
// Synthesis item row
// ---------------------------------------------------------------------------

function SynthesisRow({ item }: { item: SynthesisItem }) {
  return (
    <li className="flex items-start gap-2 rounded-md border bg-card px-3 py-2.5 transition-shadow hover:shadow-sm">
      {item.subtype && (
        <span className="mt-0.5 shrink-0">
          <TypeBadge type={item.subtype} />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          href={`/artifact/${item.id}`}
          className={cn(
            "truncate text-sm font-medium text-foreground leading-snug",
            "hover:underline underline-offset-2",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm",
          )}
        >
          {item.title}
        </Link>

        {item.snippet && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {item.snippet}
          </p>
        )}
      </div>

      {item.source_count != null && (
        <span
          aria-label={`${item.source_count} source${item.source_count !== 1 ? "s" : ""}`}
          title="Source count"
          className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
        >
          {item.source_count}
        </span>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyFeed({ tabLabel }: { tabLabel: string }) {
  return (
    <div
      role="status"
      className="rounded-md border border-dashed px-3 py-8 text-center"
    >
      <p className="text-xs text-muted-foreground">
        No {tabLabel.toLowerCase()} syntheses yet.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * CrossEntitySynthesisTabs renders a tabbed feed of cross-entity synthesis artifacts.
 *
 * While backend endpoint is missing renders skeletons.
 * Pass `items` prop when endpoint ships — filtering by tab scope is applied
 * client-side against `item.scope` (replace with server-side when backend supports it).
 */
export function CrossEntitySynthesisTabs({
  items,
  isLoading = false,
  className,
}: CrossEntitySynthesisTabsProps) {
  const [activeTab, setActiveTab] = useState<SynthesisScope>("all");

  const endpointMissing = items === undefined;
  const loading = isLoading || endpointMissing;

  // Client-side filter by scope (replace with server-param when endpoint ships)
  const filteredItems =
    items && activeTab !== "all"
      ? items.filter((item) => item.scope === activeTab)
      : items ?? [];

  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <section aria-labelledby="cross-entity-synth-heading" className={className}>
      <div className="mb-3 flex items-center gap-2">
        <Network aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2
          id="cross-entity-synth-heading"
          className="text-sm font-semibold text-foreground"
        >
          Cross-Entity Synthesis
        </h2>
        {endpointMissing && (
          <span
            className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            role="note"
          >
            Planned
          </span>
        )}
      </div>

      {endpointMissing && (
        <p className="mb-3 text-[11px] text-muted-foreground" role="note">
          Requires{" "}
          <code className="rounded bg-muted px-1 font-mono text-[10px]">
            GET /api/research/cross-entity-synthesis
          </code>{" "}
          — coming soon.
        </p>
      )}

      {/* Tab list */}
      <div
        role="tablist"
        aria-label="Synthesis scope filter"
        className="mb-3 flex gap-1 overflow-x-auto rounded-md border bg-muted/40 p-1"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`synth-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={tab.panelId}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "inline-flex shrink-0 items-center rounded-sm px-3 py-1 text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={activeTabDef.panelId}
        aria-labelledby={`synth-tab-${activeTab}`}
      >
        {loading ? (
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
        ) : filteredItems.length === 0 ? (
          <EmptyFeed tabLabel={activeTabDef.label} />
        ) : (
          <ul
            role="list"
            aria-label={`${activeTabDef.label} cross-entity syntheses`}
            className="flex flex-col gap-1.5"
          >
            {filteredItems.map((item) => (
              <SynthesisRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
