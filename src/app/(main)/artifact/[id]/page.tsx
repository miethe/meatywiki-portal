/**
 * Artifact Detail screen — Stitch-informed scaffold.
 *
 * Layout: Detail shell variant (breadcrumb-led).
 * Three reader tabs: Source / Knowledge / Draft.
 * Action button row: Compile, Ingest, Lint (1:1 engine commands, v1).
 * Workflow OS tab: Lens Badge Set (full) + Stage Tracker + Handoff Chain skeleton.
 *
 * P3-06 fills this with:
 *   - GET /api/artifacts/:id data wiring
 *   - Tab content rendering (raw markdown / compiled / draft)
 *   - Action buttons triggering POST /api/workflows/{compile,lint}
 *
 * Stitch references:
 *   - "Artifact Detail" (ID: 7b5a1a093d1c454c96c913367c7e60fe) — 3 tab states
 *   - "Research Artifact - Workflow OS Enhanced" (ID: ee5b9ed70061402c99b091998f9002d8) — tab 4
 * Shell: Project Contextual (Detail variant — audit §2.1)
 * Lens badges: full, in header
 */

import Link from "next/link";
import { LensBadgeSet } from "@/components/ui/lens-badge";
import { TypeBadge } from "@/components/ui/type-badge";
import { WorkspaceBadge } from "@/components/ui/workspace-badge";
import { WorkflowStatusBadge } from "@/components/ui/workflow-status-badge";
import { StageTracker } from "@/components/workflow/stage-tracker";

const READER_TABS = ["Source", "Knowledge", "Draft", "Workflow OS"] as const;
type ReaderTab = (typeof READER_TABS)[number];

// Placeholder data — replaced by API call in P3-06
const PLACEHOLDER_ARTIFACT = {
  id: "placeholder",
  title: "Artifact Detail",
  type: "concept",
  workspace: "library" as const,
  status: "active" as const,
  updated: new Date().toISOString(),
  metadata: { fidelity: "high" as const, freshness: "current" as const, verification_state: "verified" as const },
};

export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const artifact = { ...PLACEHOLDER_ARTIFACT, id };

  // Default to Source tab (tab state managed client-side in P3-06)
  // Cast through string to avoid TS narrowing the const — real state in P3-06.
  const activeTab = "Source" as ReaderTab;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumbs (Detail shell) */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/library" className="hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
          Library
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-foreground truncate max-w-[240px]">{artifact.title}</span>
      </nav>

      {/* Artifact header */}
      <div className="flex flex-col gap-2">
        {/* Badge row above title (design spec §3.2 row 6) */}
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={artifact.type} />
          <WorkspaceBadge workspace={artifact.workspace} />
          {/* Lens Badge Set — full variant in header */}
          <LensBadgeSet
            fidelity={artifact.metadata.fidelity}
            freshness={artifact.metadata.freshness}
            verification_state={artifact.metadata.verification_state}
            variant="full"
          />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">{artifact.title}</h1>

        {/* Action buttons — 1:1 engine command mapping (design spec §7) */}
        <div
          role="group"
          aria-label="Artifact actions"
          className="flex flex-wrap items-center gap-2"
        >
          {[
            { label: "Compile", ariaLabel: "Compile this artifact" },
            { label: "Ingest URL", ariaLabel: "Ingest a URL for this artifact" },
            { label: "Lint", ariaLabel: "Lint this artifact" },
          ].map(({ label, ariaLabel }) => (
            <button
              key={label}
              type="button"
              aria-label={ariaLabel}
              disabled
              title="Action buttons implemented in P3-06"
              className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Artifact readers" className="flex border-b">
        {READER_TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={tab === activeTab}
            aria-controls={`artifact-tab-${tab.toLowerCase().replace(" ", "-")}`}
            id={`artifact-tab-btn-${tab.toLowerCase().replace(" ", "-")}`}
            type="button"
            disabled
            title="Tab switching implemented in P3-06"
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none disabled:cursor-default
              ${tab === activeTab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="flex gap-4">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Source tab */}
          <div
            role="tabpanel"
            id="artifact-tab-source"
            aria-labelledby="artifact-tab-btn-source"
            hidden={activeTab !== "Source"}
          >
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                Source reader (raw markdown) — implemented in P3-06.
                <br />
                <code className="text-xs">GET /api/artifacts/{"{id}"}/content</code>
              </p>
            </div>
          </div>

          {/* Knowledge tab */}
          <div
            role="tabpanel"
            id="artifact-tab-knowledge"
            aria-labelledby="artifact-tab-btn-knowledge"
            hidden={activeTab !== "Knowledge"}
          >
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                Knowledge reader (compiled output) — implemented in P3-06.
              </p>
            </div>
          </div>

          {/* Draft tab */}
          <div
            role="tabpanel"
            id="artifact-tab-draft"
            aria-labelledby="artifact-tab-btn-draft"
            hidden={activeTab !== "Draft"}
          >
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">
                Draft reader (editable draft) — implemented in P3-06.
              </p>
            </div>
          </div>

          {/* Workflow OS tab */}
          <div
            role="tabpanel"
            id="artifact-tab-workflow-os"
            aria-labelledby="artifact-tab-btn-workflow-os"
            hidden={activeTab !== "Workflow OS"}
          >
            <div className="flex flex-col gap-4">
              {/* Lens Badge Set full — anchored top of tab (design spec §3.2 row 9) */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Lens assessment</span>
                <LensBadgeSet
                  fidelity={artifact.metadata.fidelity}
                  freshness={artifact.metadata.freshness}
                  verification_state={artifact.metadata.verification_state}
                  variant="full"
                />
              </div>

              {/* Handoff Chain skeleton (design spec §3.1, addendum §6) */}
              <div>
                <h3 className="mb-2 text-sm font-medium">Handoff chain</h3>
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Timeline view — implemented in P3-06.
                  Reads <code className="text-xs">artifact_edges</code> of types{" "}
                  <code className="text-xs">generated_by | handoff_from | handoff_to</code>.
                </div>
              </div>

              {/* Run history with per-run compact StageTracker (design spec §3.2 row 9) */}
              <div>
                <h3 className="mb-2 text-sm font-medium">Run history</h3>
                <div className="flex flex-col gap-2">
                  {/* Placeholder run row */}
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">source_ingest_v1</span>
                      <WorkflowStatusBadge status="complete" />
                    </div>
                    <StageTracker
                      runId="placeholder-run"
                      templateId="source_ingest_v1"
                      status="complete"
                      currentStage={3}
                      variant="compact"
                      mode="static"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata sidebar (visible in detail view) */}
        <aside
          aria-label="Artifact metadata"
          className="hidden w-60 shrink-0 flex-col gap-3 lg:flex"
        >
          <div className="rounded-md border p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Details
            </h3>
            <dl className="flex flex-col gap-1.5 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">ID</dt>
                <dd className="truncate font-mono text-xs">{id}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd>{artifact.status}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Updated</dt>
                <dd className="text-xs">
                  {new Date(artifact.updated).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
