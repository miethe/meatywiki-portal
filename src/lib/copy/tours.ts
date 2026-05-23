export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  disableBeacon?: boolean;
}

export const TOURS = {
  inbox: [
    {
      target: '[data-tour="inbox-new-section"]',
      title: 'New Items',
      content:
        'Fresh artifacts land here after ingest. Review them before they move into the compile queue.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="inbox-needs-compile-section"]',
      title: 'Needs Compile',
      content:
        'These artifacts have been reviewed but still need a full compile pass to produce wiki content.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="inbox-compile-button"]',
      title: 'Compile Selected',
      content:
        'Select one or more artifacts and trigger a compile workflow. Stage progress appears inline as it runs.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="inbox-urgency-badge"]',
      title: 'Urgency Badges',
      content:
        'Colored badges signal how long an artifact has been waiting — amber means days, red means overdue.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="inbox-processed-section"]',
      title: 'Processed Items',
      content:
        'The last 24 hours of completed artifacts appear here so you can quickly verify results.',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '[data-tour="inbox-pending-approval"]',
      title: 'Pending Approval',
      content:
        'Artifacts flagged for human review stay here until you approve or reject each one.',
      placement: 'top',
      disableBeacon: true,
    },
  ],

  library: [
    {
      target: '[data-tour="library-workspace-selector"]',
      title: 'Workspace Selector',
      content:
        'Switch between Concepts, Entities, Topics, Syntheses, and other workspaces to filter the full artifact library.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="library-artifact-card"]',
      title: 'Artifact Cards',
      content:
        'Each card shows title, type, source, and last-compiled date. Click to open the full detail view.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="library-lens-badges"]',
      title: 'Lens Badges',
      content:
        'These scores reflect how well the artifact performs across lens dimensions like fidelity and freshness.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="library-filter-bar"]',
      title: 'Filter Bar',
      content:
        'Narrow results by artifact type, source domain, date range, or any active lens dimension.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="library-search"]',
      title: 'Semantic Search',
      content:
        'Search uses pgvector embeddings — results rank by meaning, not just keywords.',
      placement: 'bottom',
      disableBeacon: true,
    },
  ],

  artifactDetail: [
    {
      target: '[data-tour="artifact-detail-header"]',
      title: 'Title & Metadata',
      content:
        'This block shows artifact type, workspace, source URL, ingest date, and current lifecycle state.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="artifact-detail-body"]',
      title: 'Compiled Content',
      content:
        'The main body renders the compiled wiki output — structured markdown produced by the extract and compile stages.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="artifact-detail-history-tab"]',
      title: 'Processing History',
      content:
        'Switch here to see every workflow run, stage-level events, errors, and cost telemetry for this artifact.',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '[data-tour="artifact-detail-lens-panel"]',
      title: 'Lens Scoring',
      content:
        'A radar chart breaks down scores across fidelity, freshness, confidence, and other active lens dimensions.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="artifact-detail-edges"]',
      title: 'Edges & Relationships',
      content:
        'Related artifacts are listed here by edge type — supports, contradicts, extends, and more.',
      placement: 'left',
      disableBeacon: true,
    },
  ],

  workflowRun: [
    {
      target: '[data-tour="workflow-stage-tracker"]',
      title: 'Stage Tracker',
      content:
        'Each bubble represents one pipeline stage. Green means complete, amber means running, red means failed.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="workflow-stage-details"]',
      title: 'Stage Details',
      content:
        'Click any stage to expand its log output, token usage, and elapsed time.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="workflow-operator-actions"]',
      title: 'Operator Actions',
      content:
        'Retry a failed run, cancel an in-progress run, or approve a held artifact from this action bar.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="workflow-timeline"]',
      title: 'Event Timeline',
      content:
        'A chronological feed of all stage events, including synthetic recovery events from the startup sweep.',
      placement: 'top',
      disableBeacon: true,
    },
  ],

  graph: [
    {
      target: '[data-tour="graph-canvas"]',
      title: 'Graph Canvas',
      content:
        'Nodes are artifacts; edges are typed relationships. Drag, zoom, or scroll to navigate the full knowledge graph.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="graph-filter-panel"]',
      title: 'Filter Panel',
      content:
        'Narrow the graph by node type, edge type, workspace, project, date range, freshness, or lens confidence.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="graph-cluster-controls"]',
      title: 'Cluster Controls',
      content:
        'Group nodes by domain, workspace, or project to reveal high-level structure in large graphs.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="graph-lod-selector"]',
      title: 'Detail Level',
      content:
        'LOD-0 shows cluster summaries; higher levels reveal individual nodes. The renderer auto-degrades on mobile.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="graph-semantic-neighbors"]',
      title: 'Semantic Neighbors',
      content:
        'Select any node and this panel surfaces the closest artifacts by embedding similarity via pgvector.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="graph-export-button"]',
      title: 'Export Snapshot',
      content:
        'Download the current view as a PNG or SVG — useful for embedding in docs or sharing context.',
      placement: 'left',
      disableBeacon: true,
    },
  ],

  researchWizard: [
    {
      target: '[data-tour="research-start-button"]',
      title: 'Start Research',
      content:
        'Launch the research wizard to configure a new external research workflow from a topic or question.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="research-scope-selection"]',
      title: 'Scope Selection',
      content:
        'Define the research scope — choose a workspace, add seed concepts, and set the depth for source discovery.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="research-active-runs"]',
      title: 'Active Research Runs',
      content:
        'Running workflows appear here with live stage progress. Each row links to its full workflow run viewer.',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '[data-tour="research-results"]',
      title: 'Research Results',
      content:
        'Completed runs surface extracted artifacts, suggested edges, and a synthesis draft ready for review.',
      placement: 'top',
      disableBeacon: true,
    },
  ],

  decisions: [
    {
      target: '[data-tour="decisions-list"]',
      title: 'Decision List',
      content:
        'All tracked decisions are listed here, ordered by recency. Click any row to open the full decision table.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="decisions-table"]',
      title: 'Decision Table',
      content:
        'Options are rows; criteria are columns. Fill in evaluations directly in the table cells.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="decisions-criteria"]',
      title: 'Evaluation Criteria',
      content:
        'Add, remove, or reweight criteria here. Weights are normalized and applied to compute option scores.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="decisions-artifact-links"]',
      title: 'Linked Artifacts',
      content:
        'Attach supporting artifacts — evidence, syntheses, or external sources — to any decision or option.',
      placement: 'top',
      disableBeacon: true,
    },
  ],

  lensScoring: [
    {
      target: '[data-tour="lens-radar-chart"]',
      title: 'Lens Radar Chart',
      content:
        'The radar chart plots all active lens dimensions for this artifact — a wider shape means stronger overall quality.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="lens-dimension-sliders"]',
      title: 'Dimension Scores',
      content:
        'Each slider shows the computed score for one dimension. Hover a label for the scoring rationale.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="lens-score-explanation"]',
      title: 'Score Explanation',
      content:
        'This panel surfaces the reasoning behind each score — useful for understanding why freshness or confidence is low.',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '[data-tour="lens-comparison"]',
      title: 'Compare Artifacts',
      content:
        'Pin a second artifact to overlay its radar chart and compare lens scores side by side.',
      placement: 'top',
      disableBeacon: true,
    },
  ],
} as const satisfies Readonly<Record<string, readonly TourStep[]>>;

export type TourId = keyof typeof TOURS;
