/**
 * Inbox screen — Stitch-informed scaffold.
 *
 * Layout: list of ArtifactCard placeholders + Quick Add button slot at top.
 * Uses Standard Archival shell (default per audit §2.1, OQ-I).
 *
 * P3-03 fills this with:
 *   - GET /api/artifacts?workspace=inbox cursor pagination
 *   - Real ArtifactCard data wiring
 *   - Quick Add trigger opening QuickAddModal
 *
 * Stitch reference: "Inbox" screen (ID: 837a47df72a648749bafefd22988de7f)
 * Shell: Standard Archival
 * Lens badges: compact, on each card (when metadata present)
 * Stage Tracker: compact, on cards with active workflow_runs
 */

import { ArtifactCard } from "@/components/ui/artifact-card";
import type { ArtifactCard as ArtifactCardType } from "@/types/artifact";

// Placeholder data — replaced by API call in P3-03
const PLACEHOLDER_ARTIFACTS: ArtifactCardType[] = [
  {
    id: "placeholder-1",
    workspace: "inbox",
    type: "raw_note",
    title: "Untitled note from this morning",
    status: "draft",
    updated: new Date(Date.now() - 5 * 60_000).toISOString(),
    file_path: "raw/placeholder-1.md",
    preview: "Some thoughts on the project direction and next steps…",
  },
  {
    id: "placeholder-2",
    workspace: "inbox",
    type: "concept",
    title: "Knowledge Graph Architecture Patterns",
    status: "active",
    updated: new Date(Date.now() - 2 * 3600_000).toISOString(),
    file_path: "wiki/concepts/kg-architecture.md",
    preview: "Explores approaches to organising interconnected knowledge nodes…",
    metadata: { fidelity: "high", freshness: "current", verification_state: "verified" },
    workflow_status: "complete",
  },
  {
    id: "placeholder-3",
    workspace: "inbox",
    type: "topic",
    title: "LLM Routing Strategies",
    status: "draft",
    updated: new Date(Date.now() - 6 * 3600_000).toISOString(),
    file_path: "raw/llm-routing.md",
    workflow_status: "running",
  },
];

export default function InboxPage() {
  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Recently captured artifacts
          </p>
        </div>

        {/* Quick Add button slot — P3-04 wires the modal trigger here.
            The ShellHeader also exposes a global Quick Add button. */}
        <button
          type="button"
          aria-label="Quick Add artifact"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled
          title="Implemented in P3-04"
        >
          <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Quick Add
        </button>
      </div>

      {/* Artifact list */}
      <section aria-label="Inbox artifacts">
        <ul role="list" className="flex flex-col gap-2">
          {PLACEHOLDER_ARTIFACTS.map((artifact) => (
            <li key={artifact.id}>
              <ArtifactCard artifact={artifact} variant="list" />
            </li>
          ))}
        </ul>

        {/* Load more slot — P3-03 implements cursor pagination */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center rounded-md border px-4 text-sm text-muted-foreground disabled:opacity-50"
            title="Cursor pagination implemented in P3-03"
          >
            Load more
          </button>
        </div>
      </section>
    </div>
  );
}
