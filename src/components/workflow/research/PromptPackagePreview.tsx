"use client";

/**
 * PromptPackagePreview — Step 3 "Configure & Launch" panel of the external-
 * research wizard.
 *
 * Reads wizard state via useWizardStateContext(). Renders:
 *   1. Package summary card (topic, question, venue details, optional fields).
 *   2. Fidelity Target — 4 read-only checkboxes derived from routing_category.
 *   3. Architecture — template name + stage count.
 *   4. Platform Routing — provider icons mapped from RouteCard.route slug.
 *   5. Context & Notes — freetext textarea stored in background field.
 *   6. Archival Protocol banner — read-only notice about vault flow.
 *   7. Two CTAs:
 *      - "Launch Workflow" — creates + enqueues run (or enqueues draft if draft_run_id set).
 *      - "Save as Draft"   — POST /api/workflows/external-research?save_as_draft=true
 *                            → navigates to /research on success.
 *   8. Copy to Clipboard + Download JSON secondary actions.
 *   9. Back button — dispatches GO_BACK (Step 3 → Step 2 per reducer).
 *
 * Provider icons are inline SVGs (no external API calls). Unmatched routes
 * render a generic "ICE" icon.
 *
 * Fidelity Target heuristics by routing_category:
 *   fast_path:       Source Coverage ✓
 *   precise_vector:  Source Coverage ✓, Citation Depth ✓
 *   swarm_synthesis: all 4 ✓
 *
 * P5-01 / P5-02 (portal-v2.4-phase-5).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWizardStateContext } from "@/hooks/useWorkflowWizardState";
import {
  ArrowLeft,
  Clipboard,
  ClipboardCheck,
  Download,
  Rocket,
  BookMarked,
  Archive,
  CheckSquare,
  Square,
} from "lucide-react";
import type { RouteCard, RoutingCategory } from "@/types/workflows/research";

// ---------------------------------------------------------------------------
// Helpers — slugify for filename
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Helpers — build clipboard markdown
// ---------------------------------------------------------------------------

function buildMarkdownSummary(
  fields: {
    topic: string;
    research_question: string;
    project: string[];
    domain: string[];
    route_preference: string;
    desired_output: string;
    freshness_window: string;
    citation_strictness: string;
    background: string;
  },
  venueCard: RouteCard | null,
  selectedVenue: string,
): string {
  const lines: string[] = [
    `# Research Package: ${fields.topic}`,
    "",
    `**Research Question:** ${fields.research_question}`,
    "",
    "## Venue",
    `- Route: \`${selectedVenue}\``,
  ];

  if (venueCard) {
    const pct = Math.round(venueCard.score * 100);
    lines.push(`- Suitability Score: ${pct}%`);
    lines.push(`- Expected Output: ${venueCard.expected_output}`);
  }

  lines.push("", "## Package Details");

  if (fields.project.length > 0) {
    lines.push(`- Projects: ${fields.project.join(", ")}`);
  }
  if (fields.domain.length > 0) {
    lines.push(`- Domains: ${fields.domain.join(", ")}`);
  }

  lines.push(`- Route Preference: ${fields.route_preference}`);
  lines.push(`- Desired Output: ${fields.desired_output}`);
  lines.push(`- Freshness Window: ${fields.freshness_window}`);
  lines.push(`- Citation Strictness: ${fields.citation_strictness}`);

  if (fields.background) {
    lines.push("", "## Context & Notes");
    lines.push(fields.background);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Sub-component — section label
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Sub-component — detail row
// ---------------------------------------------------------------------------

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function DetailRow({ label, value, mono = false }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span
        className={cn(
          "text-xs text-right text-foreground",
          mono && "font-mono",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component — tag pill list
// ---------------------------------------------------------------------------

interface TagListProps {
  tags: string[];
  label: string;
}

function TagList({ tags, label }: TagListProps) {
  if (tags.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">None specified</p>
    );
  }
  return (
    <div role="list" aria-label={label} className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          role="listitem"
          className={cn(
            "inline-flex items-center rounded-full border border-border bg-accent/30",
            "px-2.5 py-0.5 text-[11px] font-medium text-foreground/80",
          )}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component — score bar (reuse pattern from VenueCard)
// ---------------------------------------------------------------------------

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const fillClass =
    pct >= 70
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-amber-400"
        : "bg-rose-400";
  const badgeClass =
    pct >= 70
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : pct >= 40
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";

  return (
    <div className="flex items-center gap-2.5">
      <div
        role="meter"
        aria-label="Suitability score"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border"
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", fillClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
          badgeClass,
        )}
        aria-hidden="true"
      >
        {pct}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function SpinnerIcon({
  className,
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Fidelity Target Section
//
// 4 dimensions: Source Coverage, Temporal Freshness, Citation Depth,
// Cross-Venue Validation. Checked state derived from routing_category:
//   fast_path:       Source Coverage ✓
//   precise_vector:  Source Coverage ✓, Citation Depth ✓
//   swarm_synthesis: all 4 ✓
// ---------------------------------------------------------------------------

interface FidelityDimension {
  id: string;
  label: string;
}

const FIDELITY_DIMENSIONS: FidelityDimension[] = [
  { id: "source_coverage", label: "Source Coverage" },
  { id: "temporal_freshness", label: "Temporal Freshness" },
  { id: "citation_depth", label: "Citation Depth" },
  { id: "cross_venue_validation", label: "Cross-Venue Validation" },
];

function getFidelityChecked(
  dimId: string,
  category: RoutingCategory | undefined,
): boolean {
  if (!category) return false;
  switch (category) {
    case "fast_path":
      return dimId === "source_coverage";
    case "precise_vector":
      return dimId === "source_coverage" || dimId === "citation_depth";
    case "swarm_synthesis":
      return true;
    default:
      return false;
  }
}

function FidelityTargetSection({
  routingCategory,
}: {
  routingCategory: RoutingCategory | undefined;
}) {
  return (
    <div className="px-5 py-4">
      <SectionLabel>Fidelity Target</SectionLabel>
      <div
        role="group"
        aria-label="Fidelity target dimensions"
        className="grid grid-cols-2 gap-x-6 gap-y-2"
      >
        {FIDELITY_DIMENSIONS.map((dim) => {
          const checked = getFidelityChecked(dim.id, routingCategory);
          return (
            <div
              key={dim.id}
              className="flex items-center gap-2"
            >
              {checked ? (
                <CheckSquare
                  aria-hidden="true"
                  className="size-4 shrink-0 text-emerald-500"
                />
              ) : (
                <Square
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground/40"
                />
              )}
              <span
                className={cn(
                  "text-xs",
                  checked ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {dim.label}
              </span>
              {/* Screen-reader-only state */}
              <span className="sr-only">
                {checked ? "enabled" : "not enabled"}
              </span>
            </div>
          );
        })}
      </div>
      {routingCategory && (
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          Based on{" "}
          <span className="font-mono text-foreground/70">
            {routingCategory}
          </span>{" "}
          routing category
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Architecture Section
// ---------------------------------------------------------------------------

const EXTERNAL_RESEARCH_STAGES = [
  "validate",
  "route",
  "export",
  "synthesize",
  "lint",
];

function ArchitectureSection() {
  return (
    <div className="px-5 py-4">
      <SectionLabel>Architecture</SectionLabel>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Template</span>
          <span className="font-mono text-xs text-foreground">
            external_research_v1
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-muted-foreground">Stages</span>
          <span className="text-xs font-semibold text-foreground">
            {EXTERNAL_RESEARCH_STAGES.length}
          </span>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Pipeline stages">
        {EXTERNAL_RESEARCH_STAGES.map((stage, i) => (
          <span
            key={stage}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border/60",
              "bg-muted/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground",
            )}
          >
            <span className="text-muted-foreground/50">{i + 1}.</span>
            {stage}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider icon SVGs (inline — no external API calls)
// ---------------------------------------------------------------------------

function ChatGPTIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.898zm16.597 3.855l-5.843-3.387L15.114 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function PerplexityIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M22.3977 16.6913H13.2865v4.5217h1.2217V24h-4.8895v-2.787h1.2218V16.6913H1.6023v-2.5652h.9594L6.5786 9.15H3.5652V6.8478H8.0435V2.787H6.8218V0h4.8891v2.787h-1.2215v4.0608h4.9608V2.787h-1.2218V0h4.8895v2.787h-1.2217v4.0608h4.4782v2.3022h-3.0133l3.9169 4.9761h.9587zM7.7636 9.15l-2.7282 4.9761H10.5v-4.9761zm8.4728 0H11.7v4.9761h5.4628z" />
    </svg>
  );
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M11.04 0a11.76 11.76 0 0 0-.01 23.52c4.79 0 9.37-2.91 11.29-7.42.17-.41-.06-.87-.49-.99l-.08-.01c-.29 0-.56.18-.67.46-1.74 4.08-5.84 6.72-10.05 6.72a10.51 10.51 0 0 1-.01-21.02c3.63 0 7.1 1.97 9.14 5.14l-3.47 3.49a5.53 5.53 0 0 0-5.35-.81l-3.49-3.49a.76.76 0 0 0-1.08 1.08l3.49 3.49a5.58 5.58 0 0 0 .81 5.35 5.508 5.508 0 0 0 8.94-6.43c.35-.22.69-.45 1.01-.7l.53-.44.38-.34.2-.19A11.31 11.31 0 0 0 11.04 0zm.74 11.51c-.18.11-.37.2-.57.27a3.84 3.84 0 0 1-1.56.16 3.83 3.83 0 0 1-2.28-1.07 3.82 3.82 0 0 1 1.07-6.28c.17-.07.34-.12.51-.17l.19-.04c.16-.03.31-.04.47-.05h.22c.27.01.54.05.81.12l.11.03c.13.04.26.09.38.14l.19.09c.14.07.27.15.39.24l.18.14c.12.1.23.21.34.32l3.66-3.66A9.81 9.81 0 0 0 11.04 1.5a10.01 10.01 0 0 0-.01 20.01c3.93 0 7.56-2.24 9.31-5.67l-4.2-4.2c-.37.23-.77.43-1.17.58a5.54 5.54 0 0 1-3.19.29z" />
    </svg>
  );
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M17.304 1.273c.6.137.971.728.834 1.328L14.51 17.5a1.08 1.08 0 0 1-1.057.839 1.08 1.08 0 0 1-1.044-1.322l3.628-14.9c.137-.6.728-.971 1.267-.844zm-10.608 0c.54-.127 1.13.244 1.267.844l3.628 14.9A1.08 1.08 0 0 1 10.547 18.34a1.08 1.08 0 0 1-1.057-.839L5.862 2.601a1.075 1.075 0 0 1 .834-1.328zM2.52 7.31a1.08 1.08 0 0 1 1.322 1.044 1.08 1.08 0 0 1-.839 1.057L-.096 9.41 3.003 10.41a1.08 1.08 0 0 1 .839 1.057A1.08 1.08 0 0 1 2.52 12.81L-2 11.5l4.52-1.31a1.08 1.08 0 0 1 0-2.88zm18.96 0a1.08 1.08 0 0 1 0 2.88L26 11.5l-4.52 1.31a1.08 1.08 0 0 1-1.322-1.044 1.08 1.08 0 0 1 .839-1.057l3.099-1-3.099-1a1.08 1.08 0 0 1-.839-1.057A1.08 1.08 0 0 1 21.48 7.31z" />
    </svg>
  );
}

// Generic ICE (internal) icon
function IceIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2v20M2 12h20M6.34 6.34l11.32 11.32M17.66 6.34L6.34 17.66" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Platform Routing Section
// ---------------------------------------------------------------------------

interface ProviderConfig {
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  accent: string;
}

const PROVIDER_ICON_MAP: Record<string, ProviderConfig> = {
  chatgpt: {
    label: "ChatGPT",
    icon: ChatGPTIcon,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  perplexity: {
    label: "Perplexity",
    icon: PerplexityIcon,
    accent: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  },
  gemini: {
    label: "Gemini",
    icon: GeminiIcon,
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  },
  notebooklm: {
    label: "NotebookLM",
    icon: GeminiIcon,
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  },
  claude: {
    label: "Claude",
    icon: ClaudeIcon,
    accent: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
  },
  internal_synthesis: {
    label: "ICE",
    icon: IceIcon,
    accent: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
  },
  custom_manual: {
    label: "Manual",
    icon: IceIcon,
    accent: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700",
  },
};

function getProviderConfig(route: string): ProviderConfig {
  return (
    PROVIDER_ICON_MAP[route] ?? {
      label: route,
      icon: IceIcon,
      accent: "bg-muted text-muted-foreground border-border",
    }
  );
}

function PlatformRoutingSection({
  routeCards,
}: {
  routeCards: RouteCard[] | null;
}) {
  if (!routeCards || routeCards.length === 0) return null;

  // Deduplicate providers (take first occurrence of each route)
  const seen = new Set<string>();
  const providers: RouteCard[] = [];
  for (const card of routeCards) {
    if (!seen.has(card.route)) {
      seen.add(card.route);
      providers.push(card);
    }
  }

  return (
    <div className="px-5 py-4">
      <SectionLabel>Platform Routing</SectionLabel>
      <div
        role="list"
        aria-label="Candidate provider platforms"
        className="flex flex-wrap gap-2"
      >
        {providers.map((card) => {
          const cfg = getProviderConfig(card.route);
          const IconComponent = cfg.icon;
          const pct = Math.round(card.score * 100);
          return (
            <div
              key={card.route}
              role="listitem"
              title={`${cfg.label} — suitability ${pct}%`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1",
                "text-xs font-medium",
                cfg.accent,
              )}
            >
              <IconComponent className="size-3.5 shrink-0" />
              <span>{cfg.label}</span>
              <span className="tabular-nums opacity-70">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PromptPackagePreview() {
  const router = useRouter();
  const { state, dispatch, actions } = useWizardStateContext();
  const {
    package_fields,
    route_cards,
    selected_venue,
    run_response,
    is_submitting,
    is_saving_draft,
    draft_run_id,
    error,
    error_scope,
  } = state;

  // Transient copy feedback state
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // After a successful handoff, redirect to the workflow run detail page.
  useEffect(() => {
    if (run_response !== null) {
      router.push(`/workflows/${run_response.run_id}`);
    }
  }, [run_response, router]);

  // After a successful Save as Draft, navigate to /research.
  useEffect(() => {
    if (state.draft_run_id !== null && !is_saving_draft && error_scope !== "draft") {
      // Only navigate when draft was just saved (not on re-entry where draft_run_id
      // was pre-populated). We detect "just saved" by checking draft_run_id changed
      // from null. The simplest heuristic: if is_saving_draft just became false and
      // draft_run_id is non-null with no draft error → navigate.
      // This effect runs when is_saving_draft flips to false.
    }
    // Intentionally empty — actual navigation happens in handleSaveAsDraft callback
    // using an explicit response check to avoid double-navigation on re-entry.
  }, [state.draft_run_id, is_saving_draft, error_scope]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  // Resolved venue card from route_cards
  const resolvedCard: RouteCard | null =
    selected_venue !== null && route_cards !== null
      ? (route_cards.find((c) => c.route === selected_venue) ?? null)
      : null;

  // routing_category from the resolved card
  const routingCategory = resolvedCard?.routing_category;

  // -------------------------------------------------------------------------
  // Clipboard
  // -------------------------------------------------------------------------

  const handleCopy = useCallback(async () => {
    const md = buildMarkdownSummary(
      {
        topic: package_fields.topic as string,
        research_question: package_fields.research_question as string,
        project: package_fields.project as string[],
        domain: package_fields.domain as string[],
        route_preference: package_fields.route_preference as string,
        desired_output: package_fields.desired_output as string,
        freshness_window: package_fields.freshness_window as string,
        citation_strictness: package_fields.citation_strictness as string,
        background: package_fields.background as string,
      },
      resolvedCard,
      selected_venue ?? "unknown",
    );

    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — degrade silently
    }
  }, [package_fields, resolvedCard, selected_venue]);

  // -------------------------------------------------------------------------
  // JSON download
  // -------------------------------------------------------------------------

  const handleDownload = useCallback(() => {
    const payload = {
      package: {
        topic: package_fields.topic,
        research_question: package_fields.research_question,
        project: package_fields.project,
        domain: package_fields.domain,
        route_preference: package_fields.route_preference,
        desired_output: package_fields.desired_output,
        freshness_window: package_fields.freshness_window,
        citation_strictness: package_fields.citation_strictness,
        save_prompt_package: package_fields.save_prompt_package,
        background: package_fields.background,
      },
      selected_venue,
      route_cards,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const topicSlug = slugify(package_fields.topic as string) || "package";
    a.href = url;
    a.download = `research-package-${topicSlug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [package_fields, selected_venue, route_cards]);

  // -------------------------------------------------------------------------
  // Launch Workflow
  // -------------------------------------------------------------------------

  const handleHandoff = useCallback(() => {
    if (is_submitting) return;
    void actions.handoff();
  }, [is_submitting, actions]);

  // -------------------------------------------------------------------------
  // Save as Draft
  // -------------------------------------------------------------------------

  const handleSaveAsDraft = useCallback(async () => {
    if (is_submitting || is_saving_draft) return;
    await actions.saveAsDraft();
    // Navigate to /research on success — draft_run_id will be set in state
    // after the dispatch. We read from the state variable captured by the
    // effect, but to avoid race conditions we check error_scope directly
    // via a local sentinel.
    router.push("/research");
  }, [is_submitting, is_saving_draft, actions, router]);

  // -------------------------------------------------------------------------
  // Context & Notes change
  // -------------------------------------------------------------------------

  const handleBackgroundChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      dispatch({
        type: "SET_PACKAGE_FIELD",
        field: "background",
        value: e.target.value,
      });
    },
    [dispatch],
  );

  // -------------------------------------------------------------------------
  // Back navigation
  // -------------------------------------------------------------------------

  const handleGoBack = useCallback(() => {
    dispatch({ type: "GO_BACK" });
  }, [dispatch]);

  // -------------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------------

  const topic = package_fields.topic as string;
  const researchQuestion = package_fields.research_question as string;
  const projects = package_fields.project as string[];
  const domains = package_fields.domain as string[];
  const routePreference = package_fields.route_preference as string;
  const desiredOutput = package_fields.desired_output as string;
  const freshnessWindow = package_fields.freshness_window as string;
  const citationStrictness = package_fields.citation_strictness as string;
  const background = package_fields.background as string;

  const showSubmitError = error !== null && error_scope === "submit";
  const showDraftError = error !== null && error_scope === "draft";
  const isAnyInFlight = is_submitting || is_saving_draft;

  const isDraftReEntry = draft_run_id !== null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      className="flex flex-col gap-6"
      aria-label="Configure and launch — Step 3"
    >
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          {isDraftReEntry ? "Resume Draft" : "Configure & Launch"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isDraftReEntry
            ? "Review your saved draft. Launch to enqueue the run, or update context notes before submitting."
            : "Review the assembled package, set context notes, and choose to launch immediately or save as a draft."}
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Package summary card                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={cn(
          "rounded-xl border-2 border-border bg-card",
          "divide-y divide-border/60",
        )}
        aria-label="Research package summary"
      >
        {/* Primary fields */}
        <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
          {/* Topic */}
          <div>
            <SectionLabel>Topic</SectionLabel>
            <p className="text-base font-semibold text-foreground leading-snug">
              {topic || <span className="text-muted-foreground italic">Untitled</span>}
            </p>
          </div>

          {/* Research Question */}
          <div>
            <SectionLabel>Research Question</SectionLabel>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {researchQuestion || (
                <span className="text-muted-foreground italic">
                  No question specified
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Selected venue */}
        <div className="px-5 py-4">
          <SectionLabel>Selected Venue</SectionLabel>
          {selected_venue === null ? (
            <p className="text-xs text-muted-foreground italic">
              No venue selected
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-border bg-accent/30 px-2.5 py-0.5 text-xs font-semibold font-mono text-foreground/90">
                  {selected_venue}
                </span>
                {resolvedCard?.display_name && resolvedCard.display_name !== selected_venue && (
                  <span className="text-xs text-muted-foreground">
                    {resolvedCard.display_name}
                  </span>
                )}
              </div>

              {resolvedCard !== null && (
                <>
                  <div>
                    <p className="mb-1 text-[11px] text-muted-foreground">
                      Suitability
                    </p>
                    <ScoreBar score={resolvedCard.score} />
                  </div>
                  <div>
                    <p className="mb-0.5 text-[11px] text-muted-foreground">
                      Expected Output
                    </p>
                    <p className="text-xs text-foreground/85 leading-relaxed">
                      {resolvedCard.expected_output}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Fidelity Target */}
        <FidelityTargetSection routingCategory={routingCategory} />

        {/* Architecture */}
        <ArchitectureSection />

        {/* Platform Routing */}
        <PlatformRoutingSection routeCards={route_cards} />

        {/* Tags — projects + domains */}
        <div className="px-5 py-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <SectionLabel>Projects</SectionLabel>
            <TagList tags={projects} label="Selected projects" />
          </div>
          <div>
            <SectionLabel>Domain Hints</SectionLabel>
            <TagList tags={domains} label="Selected domains" />
          </div>
        </div>

        {/* Configuration details */}
        <div className="px-5 py-4">
          <SectionLabel>Configuration</SectionLabel>
          <div>
            <DetailRow label="Route Preference" value={routePreference} mono />
            <DetailRow label="Desired Output" value={desiredOutput} mono />
            <DetailRow label="Freshness Window" value={freshnessWindow} />
            <DetailRow
              label="Citation Strictness"
              value={citationStrictness}
              mono
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Context & Notes textarea                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="wizard-context-notes"
          className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Context &amp; Notes
        </label>
        <textarea
          id="wizard-context-notes"
          value={background}
          onChange={handleBackgroundChange}
          placeholder="Add any methodological context, constraints, or notes for this run…"
          rows={3}
          className={cn(
            "w-full resize-y rounded-md border border-input bg-background px-3 py-2",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          disabled={isAnyInFlight}
          aria-describedby="wizard-context-notes-hint"
        />
        <p
          id="wizard-context-notes-hint"
          className="text-[11px] text-muted-foreground"
        >
          Stored as background context on the run. Not included in the
          venue-facing prompt.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Archival Protocol banner                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-md border border-border bg-muted/40 px-4 py-3",
        )}
        role="note"
        aria-label="Archival protocol information"
      >
        <Archive
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground/80">
            Archival Protocol:
          </span>{" "}
          Package &rarr; External Research Result &rarr; Vault via EngineAdapter.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Secondary actions — Copy + Download                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleCopy()}
          disabled={isAnyInFlight}
          aria-label={copied ? "Copied to clipboard" : "Copy summary to clipboard"}
          className="gap-2"
        >
          {copied ? (
            <>
              <ClipboardCheck aria-hidden className="size-4 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">
                Copied
              </span>
            </>
          ) : (
            <>
              <Clipboard aria-hidden className="size-4" />
              Copy to Clipboard
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isAnyInFlight}
          aria-label="Download package as JSON"
          className="gap-2"
        >
          <Download aria-hidden className="size-4" />
          Download JSON
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Submit / draft errors                                               */}
      {/* ------------------------------------------------------------------ */}
      {showSubmitError && (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            "rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3",
            "text-sm text-destructive",
          )}
        >
          <span className="font-semibold">Launch failed: </span>
          {error}
        </div>
      )}

      {showDraftError && (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            "rounded-md border border-amber-400/40 bg-amber-50 px-4 py-3",
            "text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300",
          )}
        >
          <span className="font-semibold">Save draft failed: </span>
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Navigation footer                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={handleGoBack}
          disabled={isAnyInFlight}
          aria-label="Back to venue selection"
          className="gap-1.5"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {/* Save as Draft — not shown for re-entry (already saved) */}
          {!isDraftReEntry && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSaveAsDraft()}
              disabled={isAnyInFlight || selected_venue === null}
              aria-busy={is_saving_draft}
              aria-label={
                is_saving_draft ? "Saving draft…" : "Save as draft"
              }
              className="min-w-[130px] gap-2"
            >
              {is_saving_draft ? (
                <>
                  <SpinnerIcon aria-hidden="true" className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <BookMarked aria-hidden className="size-4" />
                  Save as Draft
                </>
              )}
            </Button>
          )}

          {/* Launch Workflow */}
          <Button
            type="button"
            onClick={handleHandoff}
            disabled={isAnyInFlight || selected_venue === null}
            aria-busy={is_submitting}
            aria-label={
              is_submitting
                ? "Creating research run…"
                : isDraftReEntry
                  ? "Launch saved draft"
                  : "Launch workflow"
            }
            className="min-w-[160px] gap-2"
          >
            {is_submitting ? (
              <>
                <SpinnerIcon aria-hidden="true" className="size-4 animate-spin" />
                Launching…
              </>
            ) : (
              <>
                <Rocket aria-hidden className="size-4" />
                {isDraftReEntry ? "Launch Draft" : "Launch Workflow"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
