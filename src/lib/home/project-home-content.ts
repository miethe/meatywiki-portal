import {
  Bot,
  Brain,
  ClipboardList,
  Command,
  Database,
  FileJson,
  FileText,
  GitBranch,
  Globe,
  Library,
  MessageSquareText,
  Network,
  PanelsTopLeft,
  Search,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type UseCaseId =
  | "chat-exports"
  | "project-plans"
  | "research"
  | "ideation"
  | "files"
  | "agent-kb";

export interface ProjectUseCase {
  id: UseCaseId;
  title: string;
  icon: LucideIcon;
  summary: string;
  when: string;
  bestSurface: string;
  sources: string[];
  actions: string[];
  watchOut: string;
}

export const projectUseCases: ProjectUseCase[] = [
  {
    id: "chat-exports",
    title: "LLM chat exports",
    icon: MessageSquareText,
    summary: "Turn ChatGPT, Claude, Perplexity, Gemini, and JSONL exports into reusable knowledge.",
    when: "Use it when a chat contains durable decisions, research, implementation notes, or reusable prompts that should not stay trapped in the chat product.",
    bestSurface: "CLI import for batches; Portal upload for one-off review; agents when capture is part of a work session.",
    sources: ["ChatGPT export", "Claude JSON/JSONL", "Perplexity/Gemini export", "Copied transcript"],
    actions: ["Ingest", "Classify", "Extract", "Compile", "Query"],
    watchOut: "Do not treat every brainstorm as permanent. Keep scratch chats out unless they add evidence, decisions, or reusable context.",
  },
  {
    id: "project-plans",
    title: "Project plans and specs",
    icon: ClipboardList,
    summary: "Keep PRDs, implementation plans, progress files, and STATE docs queryable by humans and agents.",
    when: "Use it when a repo has enough plan artifacts that agents need a durable memory layer across sessions.",
    bestSurface: "Project sync and watch mode for repo docs; Portal Library for review; query mode for synthesis.",
    sources: ["PRDs", "Implementation plans", "Progress trackers", "README/CLAUDE/STATE files"],
    actions: ["Project sync", "Search", "Compile", "Synthesize", "File-back"],
    watchOut: "Prefer conservative include patterns so generated build artifacts and irrelevant markdown do not flood the vault.",
  },
  {
    id: "research",
    title: "Research packages",
    icon: Brain,
    summary: "Capture source packs, synthesize findings, and keep evidence trails attached to downstream drafts.",
    when: "Use it when research needs to survive beyond a single answer and later support comparison, briefing, or decision work.",
    bestSurface: "Portal Research workflow for staged review; CLI for repeatable package ingestion.",
    sources: ["Research reports", "External packages", "PDFs", "Source notes"],
    actions: ["Ingest", "Rank", "Synthesize", "Review", "File-back"],
    watchOut: "Keep source coverage explicit. MeatyWiki stores and connects evidence, but it does not make weak sources strong.",
  },
  {
    id: "ideation",
    title: "Ideation worth keeping",
    icon: GitBranch,
    summary: "Promote rough ideas into structured notes only when they become decisions, options, or prompts.",
    when: "Use it when a random idea starts influencing project direction or should be compared against later alternatives.",
    bestSurface: "Quick Add in Portal for short notes; CLI note ingest for batch cleanup; agents for synthesis.",
    sources: ["Raw notes", "Idea lists", "Prompt sketches", "Decision options"],
    actions: ["Capture", "Classify", "Link", "Query"],
    watchOut: "A noisy idea pile makes retrieval worse. Capture selectively or tag as low-fidelity until refined.",
  },
  {
    id: "files",
    title: "Files, PDFs, audio, and URLs",
    icon: FileText,
    summary: "Normalize mixed source material into the same artifact graph as your plans and chats.",
    when: "Use it when useful knowledge arrives outside markdown but still needs to be searched, compiled, or linked.",
    bestSurface: "Portal upload for reviewable intake; CLI ingest for repeatable local pipelines.",
    sources: ["Markdown/text", "PDFs", "URLs", "Audio placeholders", "JSON/JSONL"],
    actions: ["Upload", "Normalize", "Classify", "Extract", "Search"],
    watchOut: "Large files and media can increase processing time. Audio upload exists as intake plumbing; do not assume transcript quality until transcription is explicitly wired.",
  },
  {
    id: "agent-kb",
    title: "Agent backing knowledge",
    icon: Bot,
    summary: "Give Codex, Claude, and other agents a durable project memory they can query instead of rediscovering.",
    when: "Use it when agents repeatedly need prior decisions, conventions, source summaries, or project state across sessions.",
    bestSurface: "Agent query mode and skills for live work; Portal for inspecting what agents are using.",
    sources: ["Agent-authored artifacts", "STATE docs", "Decision records", "Compiled syntheses"],
    actions: ["Query", "Vault read", "Synthesize", "Lint", "File-back"],
    watchOut: "Agent writes should remain routed through supported APIs or CLI flows. Portal/frontend code never writes directly to the vault.",
  },
];

export type InterfaceId = "portal" | "cli" | "agents" | "docs";

export interface InterfaceSurface {
  id: InterfaceId;
  title: string;
  icon: LucideIcon;
  description: string;
  href: string;
  command: string;
  strengths: string[];
}

export const interfaceSurfaces: InterfaceSurface[] = [
  {
    id: "portal",
    title: "Portal UI",
    icon: PanelsTopLeft,
    description: "Use the app when you need to inspect, approve, browse, compare, or visualize the vault.",
    href: "/inbox",
    command: "pnpm dev",
    strengths: ["Inbox review", "Library browsing", "Graph exploration", "Research workflows"],
  },
  {
    id: "cli",
    title: "CLI engine",
    icon: Command,
    description: "Use the CLI for repeatable local operations, project sync, batch ingest, and scripted checks.",
    href: "/docs/user/reference/cli/",
    command: "uv run meatywiki compile --pending",
    strengths: ["Batch ingest", "Project sync", "Doctor checks", "Search/query automation"],
  },
  {
    id: "agents",
    title: "Agents and skills",
    icon: Bot,
    description: "Use agent mode when MeatyWiki should be the backing knowledge base during development or research.",
    href: "/docs/user/use-cases/",
    command: "query tools: vault_search + vault_read",
    strengths: ["Cross-session memory", "Evidence lookup", "Project synthesis", "Prompt/package reuse"],
  },
  {
    id: "docs",
    title: "Docs site",
    icon: Library,
    description: "Use docs for operator guidance, feature inventory, architecture visuals, and exact command references.",
    href: "/docs/",
    command: "uv run mkdocs serve",
    strengths: ["Quick Start", "Where To Go", "Use cases", "Feature inventory"],
  },
];

export type CapabilityId =
  | "capture"
  | "compile"
  | "search"
  | "research"
  | "graph"
  | "quality";

export interface Capability {
  id: CapabilityId;
  title: string;
  icon: LucideIcon;
  status: "Current" | "Current with caveat" | "Planned";
  description: string;
  examples: string[];
}

export const capabilities: Capability[] = [
  {
    id: "capture",
    title: "Capture and normalize",
    icon: FileJson,
    status: "Current",
    description: "Bring notes, exports, URLs, PDF text, JSON/JSONL, and selected upload placeholders into a common artifact envelope.",
    examples: ["Portal upload", "CLI ingest", "AI export connectors", "Project directory sync"],
  },
  {
    id: "compile",
    title: "Classify, extract, compile",
    icon: Workflow,
    status: "Current",
    description: "Run the linear compilation loop so artifacts gain types, summaries, links, and file-backed syntheses.",
    examples: ["classify", "extract", "compile", "lint"],
  },
  {
    id: "search",
    title: "Search and query",
    icon: Search,
    status: "Current with caveat",
    description: "Use FTS and optional semantic search to retrieve artifacts, then use query mode for cited synthesis.",
    examples: ["FTS search", "semantic search", "agent query", "cross-project query"],
  },
  {
    id: "research",
    title: "Research workflows",
    icon: Brain,
    status: "Current",
    description: "Stage research intake, synthesis, draft creation, review, and file-back in the Portal workflow surfaces.",
    examples: ["Research wizard", "Saved packages", "Synthesis", "Review checklist"],
  },
  {
    id: "graph",
    title: "Graph and relationships",
    icon: Network,
    status: "Current",
    description: "Inspect how artifacts, concepts, evidence, projects, and decisions connect across the vault.",
    examples: ["Graph Explorer", "relationship chips", "edge evidence", "suite handoffs"],
  },
  {
    id: "quality",
    title: "Quality and reconciliation",
    icon: Database,
    status: "Current with caveat",
    description: "Keep the vault canonical, derive overlays, reconcile drift, and surface cost/quality signals where available.",
    examples: ["reconcile --check", "doctor", "lens signals", "estimated cost"],
  },
];

export type SuiteStatus = "Current" | "Advisory" | "Coming Soon" | "Deferred";

export interface SuiteIntegration {
  app: string;
  icon: LucideIcon;
  status: SuiteStatus;
  current: string;
  planned: string;
}

export const suiteIntegrations: SuiteIntegration[] = [
  {
    app: "SkillMeat",
    icon: Network,
    status: "Advisory",
    current: "MeatyWiki has an optional SAM/SkillMeat hook path that is disabled by default and advisory-only; Portal proxy paths remain intentionally stubbed.",
    planned: "Versioned context artifacts, skill/package governance, quality gates, and richer artifact registration.",
  },
  {
    app: "CCDash",
    icon: Globe,
    status: "Advisory",
    current: "MeatyWiki has an optional metadata-only CCDash telemetry hook, disabled by default. Full consumer-side wiring should be verified before claiming live analytics.",
    planned: "Richer usage rollups, quality metrics, and planning/agent performance loops.",
  },
  {
    app: "IntentTree",
    icon: GitBranch,
    status: "Coming Soon",
    current: "IntentTree can hold cached MeatyWiki-style references, but live bidirectional task binding and deep-link panels are still placeholder/future-facing.",
    planned: "STATE.md sync, artifact-to-task evidence handoff, and quality-gated plan execution loops.",
  },
];

export type CostStageId = "capture" | "classify" | "extract" | "compile" | "lint" | "query";

export interface CostStage {
  id: CostStageId;
  label: string;
  model: string;
  action: string;
  inputPerMillion: number;
  outputPerMillion: number;
  inputMultiplier: number;
  outputMultiplier: number;
  defaultEnabled: boolean;
  batchable: boolean;
  localOnly?: boolean;
}

export const costStages: CostStage[] = [
  {
    id: "capture",
    label: "Capture/index",
    model: "Local connectors",
    action: "Normalize source files and update local indices",
    inputPerMillion: 0,
    outputPerMillion: 0,
    inputMultiplier: 0,
    outputMultiplier: 0,
    defaultEnabled: true,
    batchable: false,
    localOnly: true,
  },
  {
    id: "classify",
    label: "Classify",
    model: "Claude Haiku 4.5",
    action: "Assign artifact type and routing profile",
    inputPerMillion: 1,
    outputPerMillion: 5,
    inputMultiplier: 1,
    outputMultiplier: 0.08,
    defaultEnabled: true,
    batchable: false,
  },
  {
    id: "extract",
    label: "Extract",
    model: "Claude Sonnet 4.6",
    action: "Extract metadata, summaries, and link candidates",
    inputPerMillion: 3,
    outputPerMillion: 15,
    inputMultiplier: 1,
    outputMultiplier: 0.25,
    defaultEnabled: true,
    batchable: false,
  },
  {
    id: "compile",
    label: "Compile/synthesize",
    model: "Claude Opus 4.8",
    action: "Synthesize context and write durable knowledge artifacts",
    inputPerMillion: 5,
    outputPerMillion: 25,
    inputMultiplier: 2.5,
    outputMultiplier: 0.5,
    defaultEnabled: true,
    batchable: true,
  },
  {
    id: "lint",
    label: "Lint",
    model: "Claude Sonnet 4.6",
    action: "Audit contradictions, formatting, and graph quality",
    inputPerMillion: 3,
    outputPerMillion: 15,
    inputMultiplier: 0.6,
    outputMultiplier: 0.1,
    defaultEnabled: false,
    batchable: true,
  },
  {
    id: "query",
    label: "Agent query",
    model: "Claude Opus 4.8",
    action: "Answer a project question using vault search/read tools",
    inputPerMillion: 5,
    outputPerMillion: 25,
    inputMultiplier: 1.5,
    outputMultiplier: 0.35,
    defaultEnabled: false,
    batchable: false,
  },
];

export const pricingAssumptionNote =
  "Estimator defaults were checked on 2026-06-12 against current public Anthropic and OpenAI pricing pages. Treat this as planning math, not persisted telemetry.";
