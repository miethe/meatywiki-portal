/**
 * Library screen — Stitch-informed scaffold.
 *
 * Layout: grid/list toggle + filter bar slot + ArtifactCard placeholders + Lens badge slot.
 * Uses Standard Archival shell (audit §2.1).
 *
 * P3-05 fills this with:
 *   - GET /api/artifacts with type/status/workspace filters
 *   - Grid/list toggle with URL-persisted view mode
 *   - Lens Filter Bar (P4-09; URL params: domain[], freshness_class, verification_status)
 *   - Real ArtifactCard data wiring
 *
 * Stitch reference: "Library" screen (ID: 5e22feb4105d40d79251c135df4a4b5a)
 * Shell: Standard Archival
 * Lens badges: compact, on each card
 */

import { ArtifactCard } from "@/components/ui/artifact-card";
import type { ArtifactCard as ArtifactCardType } from "@/types/artifact";

// Placeholder artifacts — replaced by API call in P3-05
const PLACEHOLDER_ARTIFACTS: ArtifactCardType[] = [
  {
    id: "lib-1",
    workspace: "library",
    type: "concept",
    title: "Pydantic v2 Model Patterns",
    status: "active",
    updated: new Date(Date.now() - 1 * 24 * 3600_000).toISOString(),
    file_path: "wiki/concepts/pydantic-v2.md",
    preview: "Best practices for Pydantic v2 model definitions, validators, and serialisation…",
    metadata: { fidelity: "high", freshness: "current" },
  },
  {
    id: "lib-2",
    workspace: "library",
    type: "synthesis",
    title: "Async SQLAlchemy Pattern Review",
    status: "active",
    updated: new Date(Date.now() - 3 * 24 * 3600_000).toISOString(),
    file_path: "wiki/syntheses/async-sqlalchemy.md",
    preview: "Synthesis of patterns across the codebase for SQLAlchemy async sessions…",
    metadata: { fidelity: "medium", freshness: "current", verification_state: "verified" },
  },
  {
    id: "lib-3",
    workspace: "library",
    type: "entity",
    title: "MeatyWiki Engine",
    status: "active",
    updated: new Date(Date.now() - 7 * 24 * 3600_000).toISOString(),
    file_path: "wiki/entities/meatywiki-engine.md",
    metadata: { fidelity: "high", freshness: "stale" },
  },
  {
    id: "lib-4",
    workspace: "library",
    type: "topic",
    title: "Portal Architecture",
    status: "draft",
    updated: new Date(Date.now() - 14 * 24 * 3600_000).toISOString(),
    file_path: "wiki/topics/portal-architecture.md",
    metadata: { freshness: "outdated", verification_state: "unverified" },
  },
];

export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Compiled knowledge artifacts
          </p>
        </div>

        {/* View toggle — P3-05 wires grid/list switch */}
        <div
          role="group"
          aria-label="View layout"
          className="flex rounded-md border"
        >
          <button
            type="button"
            aria-label="List view"
            aria-pressed="false"
            disabled
            title="View toggle implemented in P3-05"
            className="inline-flex h-8 items-center rounded-l-md px-3 text-xs font-medium text-muted-foreground border-r disabled:opacity-50"
          >
            List
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed="true"
            disabled
            title="View toggle implemented in P3-05"
            className="inline-flex h-8 items-center rounded-r-md px-3 text-xs font-medium bg-accent text-accent-foreground disabled:opacity-50"
          >
            Grid
          </button>
        </div>
      </div>

      {/* Filter bar slot — P4-09 Lens Filter Bar mounts here.
          P3-05 adds basic type/status/workspace filters. */}
      <div
        aria-label="Filter bar (implemented in P3-05)"
        className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground"
      >
        Filter bar slot — P3-05
      </div>

      {/* Artifact grid */}
      <section aria-label="Library artifacts">
        <ul
          role="list"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {PLACEHOLDER_ARTIFACTS.map((artifact) => (
            <li key={artifact.id}>
              <ArtifactCard artifact={artifact} variant="grid" />
            </li>
          ))}
        </ul>

        {/* Load more slot */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center rounded-md border px-4 text-sm text-muted-foreground disabled:opacity-50"
            title="Cursor pagination implemented in P3-05"
          >
            Load more
          </button>
        </div>
      </section>
    </div>
  );
}
