export interface ArtifactTypePresentation {
  label: string;
  badgeClassName: string;
  accentColor: string;
}

const RAW_CLASS =
  "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/45 dark:text-slate-200";
const LIBRARY_CLASS =
  "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200";
const ANALYSIS_CLASS =
  "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200";
const PROJECT_CLASS =
  "border-indigo-300 bg-indigo-100 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200";
const BLOG_CLASS =
  "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200";

export const ARTIFACT_TYPE_PRESENTATION: Record<string, ArtifactTypePresentation> = {
  raw_note: {
    label: "Raw Note",
    badgeClassName: RAW_CLASS,
    accentColor: "#64748b",
  },
  raw_url: {
    label: "URL Source",
    badgeClassName: RAW_CLASS,
    accentColor: "#475569",
  },
  raw_upload: {
    label: "Upload",
    badgeClassName: RAW_CLASS,
    accentColor: "#334155",
  },
  raw_transcript: {
    label: "Transcript",
    badgeClassName: RAW_CLASS,
    accentColor: "#0f766e",
  },
  raw_import: {
    label: "AI Export",
    badgeClassName: RAW_CLASS,
    accentColor: "#7c3aed",
  },
  file: {
    label: "File",
    badgeClassName: RAW_CLASS,
    accentColor: "#64748b",
  },
  note: {
    label: "Note",
    badgeClassName: RAW_CLASS,
    accentColor: "#64748b",
  },
  source_summary: {
    label: "Source Summary",
    badgeClassName:
      "border-cyan-300 bg-cyan-100 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200",
    accentColor: "#06b6d4",
  },
  concept: {
    label: "Concept",
    badgeClassName: LIBRARY_CLASS,
    accentColor: "#0ea5e9",
  },
  entity: {
    label: "Entity",
    badgeClassName:
      "border-violet-300 bg-violet-100 text-violet-900 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-200",
    accentColor: "#8b5cf6",
  },
  topic: {
    label: "Topic",
    badgeClassName:
      "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-200",
    accentColor: "#f97316",
  },
  topic_note: {
    label: "Topic Note",
    badgeClassName:
      "border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-200",
    accentColor: "#f97316",
  },
  synthesis: {
    label: "Synthesis",
    badgeClassName: ANALYSIS_CLASS,
    accentColor: "#10b981",
  },
  evidence: {
    label: "Evidence",
    badgeClassName:
      "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200",
    accentColor: "#f43f5e",
  },
  evidence_matrix: {
    label: "Evidence Matrix",
    badgeClassName:
      "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200",
    accentColor: "#f43f5e",
  },
  contradiction_matrix: {
    label: "Contradiction Matrix",
    badgeClassName:
      "border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200",
    accentColor: "#ef4444",
  },
  glossary: {
    label: "Glossary",
    badgeClassName:
      "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/55 dark:text-zinc-200",
    accentColor: "#71717a",
  },
  glossary_term: {
    label: "Glossary Term",
    badgeClassName:
      "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/55 dark:text-zinc-200",
    accentColor: "#71717a",
  },
  blog_idea: {
    label: "Blog Idea",
    badgeClassName: BLOG_CLASS,
    accentColor: "#f59e0b",
  },
  blog_outline: {
    label: "Blog Outline",
    badgeClassName: BLOG_CLASS,
    accentColor: "#d97706",
  },
  blog_draft: {
    label: "Blog Draft",
    badgeClassName: BLOG_CLASS,
    accentColor: "#b45309",
  },
  series: {
    label: "Series",
    badgeClassName: BLOG_CLASS,
    accentColor: "#92400e",
  },
  review_comment_set: {
    label: "Review Comments",
    badgeClassName: BLOG_CLASS,
    accentColor: "#a16207",
  },
  context_pack: {
    label: "Context Pack",
    badgeClassName: PROJECT_CLASS,
    accentColor: "#6366f1",
  },
  brief: {
    label: "Brief",
    badgeClassName: PROJECT_CLASS,
    accentColor: "#4f46e5",
  },
  prd: {
    label: "PRD",
    badgeClassName: PROJECT_CLASS,
    accentColor: "#4338ca",
  },
  adr: {
    label: "ADR",
    badgeClassName: PROJECT_CLASS,
    accentColor: "#3730a3",
  },
  implementation_plan: {
    label: "Implementation Plan",
    badgeClassName: PROJECT_CLASS,
    accentColor: "#312e81",
  },
  session_log: {
    label: "Session Log",
    badgeClassName: PROJECT_CLASS,
    accentColor: "#1d4ed8",
  },
  decision: {
    label: "Decision",
    badgeClassName:
      "border-teal-300 bg-teal-100 text-teal-900 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-200",
    accentColor: "#14b8a6",
  },
  risk: {
    label: "Risk",
    badgeClassName:
      "border-red-300 bg-red-100 text-red-900 dark:border-red-700 dark:bg-red-950/50 dark:text-red-200",
    accentColor: "#dc2626",
  },
  workflow_run: {
    label: "Workflow Run",
    badgeClassName:
      "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900 dark:border-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-200",
    accentColor: "#c026d3",
  },
  memory_item: {
    label: "Memory Item",
    badgeClassName:
      "border-lime-300 bg-lime-100 text-lime-900 dark:border-lime-700 dark:bg-lime-950/50 dark:text-lime-200",
    accentColor: "#65a30d",
  },
};

function titleCaseArtifactType(type: string): string {
  return type
    .split("_")
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      if (["AI", "URL", "PRD", "ADR"].includes(upper)) return upper;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function getArtifactTypeLabel(type: string): string {
  return ARTIFACT_TYPE_PRESENTATION[type]?.label ?? titleCaseArtifactType(type);
}

export function getArtifactTypeBadgeClassName(type: string): string {
  return (
    ARTIFACT_TYPE_PRESENTATION[type]?.badgeClassName ??
    "border-border bg-secondary text-secondary-foreground"
  );
}

export function getArtifactTypeAccentColor(type: string): string {
  return ARTIFACT_TYPE_PRESENTATION[type]?.accentColor ?? "hsl(var(--border))";
}
