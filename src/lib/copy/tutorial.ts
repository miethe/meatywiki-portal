/**
 * tutorial.ts — static copy and type definitions for the /tutorial page.
 *
 * FlowCardData mirrors the FlowCardProps in src/components/tutorial/FlowCard.tsx
 * but lives here so the /tutorial page can import data without pulling in React.
 */

/** @deprecated Use FlowCardData — kept for back-compat with existing re-exports */
export type FlowCard = FlowCardData;

export interface FlowCardData {
  /** HTML id — used as anchor target by TutorialNav */
  id: string;
  /** Flow name */
  title: string;
  /** 2-sentence overview */
  summary: string;
  /** Expandable paragraph (collapsed by default) */
  longDescription?: string;
  /** Bullet list of what the user will produce */
  expectedOutput?: string[];
  /** "Open page" link target */
  deepLinkHref: string;
  /** Tour id — null in Phase 2 (tour not wired) */
  tourId: string | null;
  /** Optional screenshot path */
  screenshotSrc?: string;
  /** Completion indicator — always false in Phase 2 */
  isComplete?: boolean;
}

export const FLOW_CARDS: readonly FlowCardData[] = [
  {
    id: "intake-compile",
    title: "Intake → Compile → File-back",
    summary:
      "Drop a raw document into the Inbox and watch MeatyWiki classify, extract, and compile it into a structured wiki artifact. The file-back step writes the finished artifact back to your vault, keeping your Obsidian files as the single source of truth.",
    longDescription:
      "This is the core knowledge pipeline. When you submit a document through the Inbox — a PDF, a chat export, a plain-text note — the engine runs it through a linear ingest → classify → extract → compile sequence. Classification assigns an artifact subtype (concept, entity, topic, summary, etc.) and confidence score. Extraction pulls out structured fields, relationships, and tags. Compilation synthesises a polished wiki entry. Finally, file-back writes the result to the appropriate vault path under wiki/, so your Obsidian vault always reflects the latest compiled state. The Inbox status row streams compile-stage events in real time so you know exactly where your document is at any moment.",
    expectedOutput: [
      "A classified artifact with subtype, tags, and confidence score visible in the Inbox row",
      "A compiled wiki file written to your vault under wiki/{workspace}/",
      "Graph edges linking the new artifact to related concepts and entities",
      "A compile-stage activity log you can expand directly on the Inbox card",
    ],
    deepLinkHref: "/inbox",
    tourId: "inbox",
    screenshotSrc: undefined,
    isComplete: false,
  },
  {
    id: "research-workflow",
    title: "Research Workflow",
    summary:
      "Launch a structured external research run from the wizard and track its progress across five stages in real time. Finished research runs surface as compiled summaries and evidence artifacts you can immediately link to decisions or projects.",
    longDescription:
      "The Research Workflow gives you a repeatable, auditable way to investigate a question. Open the wizard from the /research page, describe your research question, and choose a depth level. MeatyWiki creates an external_research_v1 workflow run and progresses it through planning → search → synthesis → review → done stages, emitting stage events you can watch on the Active Research Runs widget. Each finished run produces a summary artifact and one or more evidence artifacts that land in your vault, ready to inform decisions or support other compilations. The workflow is linear and cancellable at any stage.",
    expectedOutput: [
      "A research summary artifact compiled from external sources and landed in wiki/summaries/",
      "One or more evidence artifacts capturing supporting quotes and citations",
      "Stage-level progress visible on the Active Research Runs widget throughout the run",
      "Graph edges from the summary to any related concepts or entities discovered during research",
    ],
    deepLinkHref: "/research",
    tourId: "researchWizard",
    screenshotSrc: undefined,
    isComplete: false,
  },
  {
    id: "decision-framework",
    title: "Decision Framework",
    summary:
      "Record a decision, attach evidence artifacts, and run a structured evaluation against your active lens dimensions. The framework gives every significant choice a durable, queryable record that connects to the knowledge graph.",
    longDescription:
      "The Decision Framework is how you make reasoning visible and revisitable. Create a decision record with a title, framing, options, and a due date. Attach compiled artifacts as supporting evidence — the framework reads their lens scores and surfaces a structured evaluation view. You can record your final choice and the rationale alongside it, producing an artifact that future queries can surface when similar decisions arise. All decisions are stored in the overlay database and reflected in the graph as decision nodes with edges to their evidence, making your reasoning auditable over time.",
    expectedOutput: [
      "A decision artifact with framing, options, chosen outcome, and rationale saved to the overlay",
      "Attached evidence artifacts linked via graph edges with lens score annotations",
      "A structured evaluation comparing options against active lens dimensions",
      "A queryable decision record surfaced in Library search and the knowledge graph",
    ],
    deepLinkHref: "/decisions",
    tourId: "decisions",
    screenshotSrc: undefined,
    isComplete: false,
  },
  {
    id: "lens-scoring",
    title: "Lens Scoring",
    summary:
      "Understand how every artifact scores across the active lens dimensions — relevance, depth, freshness, confidence, and more. Lens scores let you surface the most valuable knowledge at a glance and filter the Library by what matters to you right now.",
    longDescription:
      "Lens Scoring is MeatyWiki's signal layer on top of compiled knowledge. Each artifact carries scores across up to 16 dimensions derived from its content, recency, source quality, and relationship density in the graph. The Library page surfaces these scores as sortable columns and filter facets, so you can ask questions like \"show me the freshest, highest-confidence concepts in this project.\" The Lens Badge on each card gives you an at-a-glance indicator of overall lens health. Scores update automatically when an artifact is recompiled or when the graph structure around it changes, keeping the signal current without manual intervention.",
    expectedOutput: [
      "Lens score breakdown visible on any artifact card in the Library (relevance, depth, freshness, confidence)",
      "A filtered Library view showing top-scoring artifacts for a chosen lens dimension",
      "Lens Badge indicators on Inbox rows during active compile runs",
      "Understanding of which artifacts need recompilation to improve their lens scores",
    ],
    deepLinkHref: "/library",
    tourId: "lensScoring",
    screenshotSrc: undefined,
    isComplete: false,
  },
  {
    id: "graph-exploration",
    title: "Graph Exploration",
    summary:
      "Navigate your entire knowledge graph interactively — zoom into clusters, follow semantic edges, and discover unexpected connections between artifacts. The graph view is the fastest way to understand the shape of what you know.",
    longDescription:
      "The Graph Explorer renders your vault as a live, filterable network of nodes and edges. Nodes represent compiled artifacts; edges represent relationships (references, derivations, contradictions, semantic similarity via pgvector). A 16-dimension filter taxonomy lets you narrow by workspace, project, domain, freshness, confidence, lens score, and tag simultaneously. Clicking a node opens its detail panel with fidelity, confidence, and lens scores; clicking an edge reveals the relationship type and source. For large vaults (over 15,000 nodes) the renderer automatically switches from sigma.js to cosmos.gl for GPU-accelerated layout. You can export a PNG or SVG snapshot of the current view, and deep links preserve your filter state for future reference.",
    expectedOutput: [
      "An interactive graph view of your compiled vault with nodes grouped by workspace or domain",
      "A filtered subgraph showing relationships between artifacts in a specific project",
      "Discovery of at least one unexpected semantic connection surfaced by the pgvector similarity edges",
      "An exported PNG or SVG snapshot of the graph for sharing or archiving",
    ],
    deepLinkHref: "/graph",
    tourId: "graph",
    screenshotSrc: undefined,
    isComplete: false,
  },
  {
    id: "projects-workspace",
    title: "Projects Workspace",
    summary:
      "Group related artifacts, research runs, and decisions under a named project to keep your work organised and queryable as a coherent unit. Projects give you a scoped view of the graph, Library, and workflows that belong to a single initiative.",
    longDescription:
      "The Projects workspace is the organisational layer above individual artifacts. Create a project, describe its goal, and start attaching artifacts — compiled wiki entries, research summaries, evidence pieces, and decision records all participate. The project scopes the Library filter, the Graph Explorer, and the Active Research Runs widget so every view shows only what belongs to this initiative. Workflow runs launched from within a project automatically tag their output artifacts to the project. When a project is complete you can archive it; archived projects remain queryable but are excluded from active surfaces by default.",
    expectedOutput: [
      "A named project record with a description and associated workspace visible in the Projects list",
      "Library and Graph views scoped to the project's artifacts with a single filter click",
      "Research runs launched within the project that automatically tag output artifacts to it",
      "An archived project record that remains queryable via Library search after completion",
    ],
    deepLinkHref: "/projects",
    tourId: null,
    screenshotSrc: undefined,
    isComplete: false,
  },
  {
    id: "workflow-stages",
    title: "Workflow OS Stages",
    summary:
      "Track every active workflow run across all surfaces in one place and understand exactly which stage each run is in. Workflow OS exposes the full stage lifecycle — from queued through each processing step to terminal success or failure.",
    longDescription:
      "The Workflow OS screen aggregates every workflow run — compile jobs, research runs, and future custom workflows — into a single operational view. Each row shows the run's current stage, elapsed time, and the most recent stage event. You can expand a row to see the full stage history as a timeline, including error messages when a stage fails. The runtime recovery system ensures that orphaned runs (interrupted by a server restart or a stale timeout) are automatically swept at startup and marked with a synthetic terminal event, so the Workflow OS view never shows stale \"in progress\" states. The reaper catches long-running stages that exceed per-stage heartbeat or absolute wallclock limits and terminates them cleanly.",
    expectedOutput: [
      "A real-time list of all active and recently completed workflow runs across compile and research types",
      "Stage-level timeline expansion for any run showing each processing step and its duration",
      "Automatic terminal events for any runs that were interrupted by a server restart",
      "Confidence that no workflow run will appear permanently stuck in an in-progress state",
    ],
    deepLinkHref: "/workflows",
    tourId: "workflowRun",
    screenshotSrc: undefined,
    isComplete: false,
  },
  {
    id: "inbox-triage",
    title: "Inbox Triage",
    summary:
      "Review newly ingested documents, approve or reject them for compilation, and monitor compile progress — all from a single queue. The Inbox is your daily starting point for keeping the vault fresh and the knowledge graph growing.",
    longDescription:
      "The Inbox is the entry point for all new knowledge. Every document you submit lands here first as a raw artifact awaiting triage. The triage flow lets you review the engine's classification suggestion, override it if needed, and approve the artifact for compilation — or reject it if it's noise. Approved artifacts enter the compile queue immediately and their row updates in real time as stages complete, using the CompileStageIndicator to show progress from extract through compile to file-back. A collapsible Processed section at the bottom of the Inbox shows the last 24 hours of completed artifacts so you can audit what landed in the vault. The approval UI supports bulk actions for processing batches of related documents efficiently.",
    expectedOutput: [
      "A triaged Inbox queue with each document showing its classification suggestion and confidence score",
      "At least one artifact approved and tracked through all compile stages with real-time stage indicators",
      "A completed artifact visible in the Processed section with a link to its compiled vault file",
      "Familiarity with the override flow for correcting misclassifications before compilation",
    ],
    deepLinkHref: "/inbox",
    tourId: "inbox",
    screenshotSrc: undefined,
    isComplete: false,
  },
];
