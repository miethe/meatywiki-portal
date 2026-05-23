export const TOOLTIP_COPY = {
  inbox: {
    sectionNew:
      "Freshly captured items waiting for classification and compilation into wiki artifacts. Review or delete items here before they enter the pipeline.",
    sectionNeedsCompile:
      "Items that have been classified but do not yet have a compiled wiki artifact. Click Compile on any item to start the extract-and-file process.",
    sectionNeedsDestination:
      "Items that compiled successfully but have not been routed to a workspace or project yet. Select a destination to file them into the wiki.",
    sectionProcessed:
      "Items that were successfully compiled and filed within the last 24 hours. This list resets on a rolling basis.",
    sectionPendingApproval:
      "Items the workflow paused for your review before filing, typically due to low classification confidence. Approve or reject each item to continue.",
    compileButton:
      "Runs the classify, extract, compile, and file-back pipeline on this artifact. The job runs in the background and usually completes in under a minute.",
    urgencyBadge:
      "A derived score based on how long the item has been waiting, its source type, and signals in the content. Higher urgency means the item may benefit from earlier attention.",
  },

  library: {
    workspaceChip:
      "The workspace this artifact belongs to (Library, Research, Blog, Projects). Click to filter the view to the same workspace.",
    lensBadgeCluster:
      "Compact readout of this artifact's fidelity, freshness, and confidence scores. Hover each badge for the individual dimension value.",
    fidelityChip:
      "Fidelity tracks how thoroughly the artifact has been extracted and compiled, from F0 (raw capture) to F4 (fully synthesised). Higher fidelity means more structured, cross-linked content.",
    freshnessChip:
      "Freshness reflects how recently the artifact was reviewed or updated relative to its content age. A stale badge signals the artifact may benefit from a recompile.",
    workspaceFacetHeader:
      "Filter the library to one or more workspaces. Selecting multiple workspaces shows artifacts from all of them.",
    artifactTypeFacetHeader:
      "Filter by artifact type — concepts, evidence, ADRs, blog drafts, and more. Types are grouped by category for easier navigation.",
    lensDimensionSlider:
      "Drag to set a minimum threshold for this lens dimension. Only artifacts scoring at or above your chosen value will appear in the results.",
  },

  workflow: {
    stageTrackerRow:
      "Each row represents one pipeline stage (classify, extract, compile, file-back). A filled icon means the stage completed; a spinning icon means it is running now.",
    degradedBadge:
      "The workflow completed but one or more stages produced lower-quality output than expected, often due to ambiguous source material. Review the artifact and recompile if needed.",
    failedBadge:
      "The workflow stopped because a stage encountered an unrecoverable error. Check the stage details for the specific error message before retrying.",
    terminalEventIcon:
      "Marks the final event emitted by the workflow — either a successful file-back or the error that caused the run to stop. Click to expand the event payload.",
    activeWorkflows:
      "Workflows currently running or awaiting a stage transition. Each card streams live stage events via SSE so you can follow progress without refreshing.",
    historicalWorkflows:
      "Completed, failed, or cancelled workflow runs from the last 7 days. Click a row to open the full run detail with stage-by-stage timing and event logs.",
    resourceIntensity:
      "An estimated share of LLM and indexing resources consumed by recent workflow runs. Higher values indicate heavier compile or extraction activity.",
    automatedDiscovery:
      "Automated Discovery watches your vault for new raw captures and queues ingest workflows without manual intervention. Configure trigger sources in Settings.",
  },

  tutorial: {
    resetButton:
      "Clears your saved tutorial progress so you can step through the flows from the beginning. This action only affects the tutorial — your vault and artifacts are not changed.",
    pageHeader:
      "Each flow card walks through a key Portal capability. Use the left nav to jump to a specific flow, or follow them top-to-bottom for a full walkthrough.",
  },

  lens: {
    fidelity:
      "Fidelity (F0–F4) measures how completely an artifact has been compiled — from a raw capture at F0 through full cross-linking and synthesis at F4. Higher fidelity artifacts are more useful for search and graph traversal.",
    freshness:
      "Freshness scores how current an artifact's content is relative to when it was last reviewed or updated. A score near 1.0 means the artifact is up-to-date; scores below 0.4 suggest it may be stale.",
    confidence:
      "Classification confidence is the engine's certainty that it assigned the correct artifact type during ingestion. Low confidence (below 0.5) means the artifact may benefit from manual reclassification.",
    relevance:
      "Relevance measures how closely an artifact matches the active query or context, derived from semantic similarity and recency. This score resets when the context changes.",
    completeness:
      "Completeness tracks whether all expected structured fields for this artifact type are populated. Incomplete artifacts may have missing relationships, empty summaries, or ungrouped evidence.",
  },

  graph: {
    // Primary filter dimensions (server-side)
    filterWorkspace:
      "Limit the graph to nodes belonging to one or more workspaces (Inbox, Library, Research, Blog, Projects). Unselected workspaces are hidden from the canvas and edge counts.",
    filterArtifactType:
      "Show only nodes of the chosen artifact types, grouped by category. Selecting types within a group narrows the graph without affecting edge visibility.",
    filterEdgeType:
      "Control which relationship types appear as edges. All 9 portal-projected edge types are shown; engine-only edge types are not available in the web graph.",
    // Secondary filter dimensions (server-side)
    filterFreshnessClass:
      "Filter nodes to a broad freshness class: Current (recently reviewed), Aging (approaching stale), or Stale (overdue for review).",
    filterProject:
      "Restrict the graph to nodes linked to specific projects. Type to search; select multiple projects to show their combined subgraph.",
    filterDomain:
      "Show nodes from a specific knowledge domain or subject area. Multiple domains can be combined; unmatched nodes are hidden.",
    filterDateRange:
      "Filter nodes by when they were created or last updated. Set a start and end date for the Created or Updated range; leave either blank for an open-ended bound.",
    // Advanced filter dimensions (client-side)
    filterFidelityLevel:
      "Set a minimum fidelity band (F0–F4). Only nodes at or above the selected band appear on the canvas; use the F3+ shortcut to focus on high-quality artifacts.",
    filterFreshnessScore:
      "Set a numeric freshness score range (0.0–1.0). Drag both handles to isolate nodes within a specific freshness window.",
    filterConfidence:
      "Set a classification confidence range. Use the Low confidence shortcut to surface artifacts most likely to benefit from reclassification.",
    filterTags:
      "Filter by one or more tags applied during ingestion or compilation. Nodes matching any selected tag are included; all others are hidden.",
    filterSemanticNeighbor:
      "Show the k nearest semantic neighbors of a selected node, ranked by embedding similarity. Select a node via right-click to activate this filter.",
    // Graph-level controls
    clusterBySelector:
      "Group graph nodes into clusters by a shared property — workspace, domain, project, or artifact type. Clusters reduce visual noise on large graphs and support LOD-0 rendering.",
    lodSelector:
      "Level of detail controls how nodes are rendered at different zoom levels. LOD-0 collapses distant clusters into summary nodes; higher LOD levels reveal individual artifacts.",
    semanticNeighborsToggle:
      "When enabled, edges derived from pgvector embedding similarity are overlaid on the graph alongside explicit vault relationships. Requires semantic indexing to be complete.",
    exportButton:
      "Export a snapshot of the current graph view as a PNG or SVG file. The export captures the visible canvas at its current zoom and filter state.",
  },

  research: {
    researchWizard:
      "Step through the research initiation wizard to define your query, select an AI model route, and launch an external research workflow. The wizard packages your context and sends it to the configured research provider.",
    activeRuns:
      "Tracks research workflows currently in progress. Each card shows the query, elapsed time, and the most recent stage event; click a card to open the full run detail.",
    researchTaskStatus:
      "The current stage of a research task within the workflow — Queued, Running, Awaiting Review, or Complete. Tasks move forward automatically once their upstream stage finishes.",
  },

  decisions: {
    decisionFramework:
      "The Decision Framework workspace organises ADRs, decisions, and evaluation artifacts in one place. Use it to record options, criteria, and the rationale behind choices.",
    evaluationCriteria:
      "Criteria define the dimensions by which options are scored — cost, risk, reversibility, and so on. Each criterion can carry a weight that influences the aggregated evaluation score.",
    decisionStatus:
      "Tracks where a decision stands: Draft (being formulated), Under Review (awaiting input), Accepted (rationale recorded), or Superseded (replaced by a later decision).",
  },

  projects: {
    projectWorkspace:
      "The Projects workspace groups PRDs, ADRs, implementation plans, risks, and briefs under a shared project context. Artifacts here are linked to a project slug for cross-filtering.",
    projectScope:
      "Scope defines the boundaries of a project — which workspaces, domains, or artifact types it covers. Setting a scope helps the engine route newly compiled artifacts to the right project automatically.",
  },

  quickAdd: {
    quickAddButton:
      "Open the quick-add panel to capture a note, URL, file, or AI export directly into the Inbox without leaving the current page. The item will be queued for classification immediately.",
    sourceTypeSelector:
      "Choose the source type that best matches what you are adding — note, URL, file upload, or AI export (ChatGPT, Perplexity, Gemini). The correct type helps the engine pick the right connector and extraction prompts.",
    fileUpload:
      "Drop a file or click to browse. Supported formats include PDFs, Markdown files, and plain text. Images are accepted as opaque uploads; audio files are queued with a pending transcript placeholder.",
  },

  global: {},
} as const;

export type TooltipDomain = keyof typeof TOOLTIP_COPY;
