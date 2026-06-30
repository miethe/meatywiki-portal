"use client";

/**
 * GraphFilters — 16-dimension filter controls for the vault graph sidebar.
 *
 * P3-02: All 16 filter dimensions from filter-contract §1 rendered inside
 * three accordion sections (Primary / Secondary / Advanced) per §10 section order.
 *
 * Design principles:
 *   - Fully controlled: accepts `values` + `onChange` props; no URL or graphology state.
 *   - Facet counts: each option accepts an optional `count` field from upstream (P3-03/04).
 *   - Section grouping: Primary (open), Secondary (collapsed), Advanced (collapsed).
 *   - Semantic neighbor (dim 15): placeholder UI — disabled with tooltip per spec.
 *
 * Filter contract refs:
 *   - §1 master table (16 dims, control types, defaults, priorities)
 *   - §2 per-dimension specs
 *   - §10 sidebar section order
 *
 * v2.2 — graph explorer filter panel (P3-02).
 * P2-05 — InfoTooltip added to section headers + semantic neighbor row.
 */

import { useState, type ReactNode } from "react";
import { ChevronRight, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl, type SegmentOption } from "./controls/SegmentedControl";
import { GroupedMultiSelect, type OptionGroup } from "./controls/GroupedMultiSelect";
import { EdgeTypeCheckboxList, type EdgeTypeOption } from "./controls/EdgeTypeCheckboxList";
import { MultiSelectAutocomplete, type AutocompleteOption } from "./controls/MultiSelectAutocomplete";
import { DateRangePicker } from "./controls/DateRangePicker";
import { RangeSlider, SingleRangeSlider } from "./controls/RangeSlider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  EDGE_TYPE_COLORS,
  EDGE_TYPE_COLOR_DEFAULT,
} from "@/types/graph";
import InfoTooltip from "@/components/ui/info-tooltip";
import { TOOLTIP_COPY } from "@/lib/copy/tooltips";

// ---------------------------------------------------------------------------
// FilterState — all 16 dimensions (source of truth for P3-02 controls)
// ---------------------------------------------------------------------------

/**
 * Complete filter state for all 16 dimensions.
 * URL serialization happens in P3-03/04; this type is the component-local shape.
 *
 * Defaults are the "no filter active" states per filter contract §1.
 */
export interface GraphFiltersValues {
  // ── Primary (server) ──────────────────────────────────────────────────────
  /** Dim 1: workspace — empty = all */
  ws: string[];
  /** Dim 2: artifact_type — empty = all */
  types: string[];
  /** Dim 3: edge_type — empty = all */
  edges: string[];
  // ── Secondary (server) ───────────────────────────────────────────────────
  /** Dim 4: freshness_class — empty = all */
  freshness: string[];
  /** Dim 5: project — empty = all */
  project: string[];
  /** Dim 6: domain — empty = all */
  domain: string[];
  /** Dim 7: date_range created */
  date_from: string;
  date_to: string;
  /** Dim 7: date_range updated */
  updated_from: string;
  updated_to: string;
  // ── Advanced (client) ─────────────────────────────────────────────────────
  /** Dim 8: fidelity_level — min fidelity (0.0 = F0+, default = no filter) */
  fidelity_min: number;
  /** Dim 9: freshness_score range */
  fscore_min: number;
  fscore_max: number;
  /** Dim 10: classification_confidence range */
  conf_min: number;
  conf_max: number;
  /** Dim 11: lifecycle_stage — empty = all */
  lifecycle: string[];
  /** Dim 12: status — empty = all */
  status: string[];
  /** Dim 13: verification_status — empty = all */
  verif: string[];
  /** Dim 14: tags — empty = all */
  tags: string[];
  /** Dim 15: semantic_neighbor — placeholder (not wired until P4 + SPIKE 2) */
  sem_node: string;
  sem_k: number;
  // ── Always visible (hybrid) ───────────────────────────────────────────────
  /** Dim 16: free-text — managed in FilterSidebar header, not in accordion */
  q: string;
}

/** Default (no-filter) state per filter contract §1. */
export const GRAPH_FILTERS_DEFAULT: GraphFiltersValues = {
  ws: [],
  types: [],
  edges: [],
  freshness: [],
  project: [],
  domain: [],
  date_from: "",
  date_to: "",
  updated_from: "",
  updated_to: "",
  fidelity_min: 0,
  fscore_min: 0,
  fscore_max: 1,
  conf_min: 0,
  conf_max: 1,
  lifecycle: [],
  status: [],
  verif: [],
  tags: [],
  sem_node: "",
  sem_k: 10,
  q: "",
};

// ---------------------------------------------------------------------------
// Options provided to <GraphFilters> from upstream (P3-03/04 will hydrate)
// ---------------------------------------------------------------------------

export interface GraphFiltersOptions {
  project: AutocompleteOption[];
  domain: AutocompleteOption[];
  tags: AutocompleteOption[];
  /** Optional facet counts per edge type (key = edge_type value). */
  edgeCounts?: Record<string, number>;
  /** Optional facet counts per artifact type. */
  typeCounts?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Artifact type taxonomy — 27 types in 5 groups (filter contract §2.2a)
// ---------------------------------------------------------------------------

const ARTIFACT_TYPE_GROUPS: OptionGroup[] = [
  {
    groupLabel: "Knowledge",
    options: [
      { value: "concept",             label: "Concept" },
      { value: "entity",              label: "Entity" },
      { value: "topic_note",          label: "Topic Note" },
      { value: "synthesis",           label: "Synthesis" },
      { value: "evidence_matrix",     label: "Evidence Matrix" },
      { value: "contradiction_matrix",label: "Contradiction Matrix" },
      { value: "glossary_term",       label: "Glossary Term" },
    ],
  },
  {
    groupLabel: "Source",
    options: [
      { value: "raw_note",      label: "Raw Note" },
      { value: "raw_url",       label: "URL Source" },
      { value: "raw_upload",    label: "Upload" },
      { value: "raw_transcript",label: "Transcript" },
      { value: "raw_import",    label: "AI Export" },
      { value: "source_summary",label: "Source Summary" },
    ],
  },
  {
    groupLabel: "Projects",
    options: [
      { value: "prd",                  label: "PRD" },
      { value: "adr",                  label: "ADR" },
      { value: "implementation_plan",  label: "Implementation Plan" },
      { value: "decision",             label: "Decision" },
      { value: "risk",                 label: "Risk" },
      { value: "brief",                label: "Brief" },
      { value: "context_pack",         label: "Context Pack" },
    ],
  },
  {
    groupLabel: "Content",
    options: [
      { value: "blog_idea",    label: "Blog Idea" },
      { value: "blog_outline", label: "Blog Outline" },
      { value: "blog_draft",   label: "Blog Draft" },
      { value: "series",       label: "Series" },
    ],
  },
  {
    groupLabel: "Operational",
    options: [
      { value: "workflow_run",         label: "Workflow Run" },
      { value: "session_log",          label: "Session Log" },
      { value: "memory_item",          label: "Memory Item" },
      { value: "review_comment_set",   label: "Review Comment Set" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Edge type options — 9 portal-projected types (filter contract §2.3)
// ---------------------------------------------------------------------------

const EDGE_TYPE_OPTIONS: EdgeTypeOption[] = [
  { value: "derived_from",  label: "Derived from",   color: EDGE_TYPE_COLORS.derived_from   ?? EDGE_TYPE_COLOR_DEFAULT },
  { value: "supports",      label: "Supports",        color: EDGE_TYPE_COLORS.supports       ?? EDGE_TYPE_COLOR_DEFAULT },
  { value: "relates_to",    label: "Relates to",      color: EDGE_TYPE_COLORS.relates_to     ?? EDGE_TYPE_COLOR_DEFAULT },
  { value: "references",    label: "References",      color: EDGE_TYPE_COLORS.references     ?? EDGE_TYPE_COLOR_DEFAULT },
  { value: "supersedes",    label: "Supersedes",      color: EDGE_TYPE_COLORS.supersedes     ?? EDGE_TYPE_COLOR_DEFAULT },
  { value: "contradicts",   label: "Contradicts",     color: EDGE_TYPE_COLORS.contradicts    ?? EDGE_TYPE_COLOR_DEFAULT },
  { value: "contains",      label: "Contains",        color: EDGE_TYPE_COLORS.contains       ?? EDGE_TYPE_COLOR_DEFAULT },
  { value: "generated_by",  label: "Generated by",    color: EDGE_TYPE_COLORS.generated_by   ?? EDGE_TYPE_COLOR_DEFAULT },
  { value: "handoff_to",    label: "Hands off to",    color: EDGE_TYPE_COLORS.handoff_to   ?? EDGE_TYPE_COLOR_DEFAULT },
  { value: "handoff_from",  label: "Handed off from", color: EDGE_TYPE_COLORS.handoff_from  ?? EDGE_TYPE_COLOR_DEFAULT },
];

// ---------------------------------------------------------------------------
// Static option arrays (values are enum constants; labels from schema)
// ---------------------------------------------------------------------------

const WORKSPACE_OPTIONS: SegmentOption[] = [
  { value: "inbox",    label: "Inbox" },
  { value: "wiki",     label: "Library" },
  { value: "research", label: "Research" },
  { value: "blog",     label: "Blog" },
  { value: "projects", label: "Projects" },
];

const FRESHNESS_CLASS_OPTIONS: SegmentOption[] = [
  { value: "current", label: "Current" },
  { value: "aging",   label: "Aging" },
  { value: "stale",   label: "Stale" },
];

const LIFECYCLE_OPTIONS: SegmentOption[] = [
  { value: "draft",      label: "Draft" },
  { value: "active",     label: "Active" },
  { value: "archived",   label: "Archived" },
  { value: "deprecated", label: "Deprecated" },
];

const STATUS_OPTIONS: SegmentOption[] = [
  { value: "in-progress", label: "In Progress" },
  { value: "complete",    label: "Complete" },
  { value: "pending",     label: "Pending" },
  { value: "blocked",     label: "Blocked" },
];

const VERIF_OPTIONS: SegmentOption[] = [
  { value: "verified",   label: "Verified" },
  { value: "unverified", label: "Unverified" },
  { value: "disputed",   label: "Disputed" },
];

const FIDELITY_TRACK_LABELS = [
  { position: 0,   label: "F0" },
  { position: 0.25,label: "F1" },
  { position: 0.5, label: "F2" },
  { position: 0.75,label: "F3" },
  { position: 1,   label: "F4" },
];

// ---------------------------------------------------------------------------
// Accordion section — internal
// ---------------------------------------------------------------------------

interface FilterAccordionSectionProps {
  label: string;
  defaultOpen?: boolean;
  /** Optional InfoTooltip content for this section header. */
  tooltip?: string;
  children: ReactNode;
}

function FilterAccordionSection({
  label,
  defaultOpen = false,
  tooltip,
  children,
}: FilterAccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/60 last:border-b-0">
      {/*
       * The header is a flex row: [toggle button] [tooltip icon].
       * The InfoTooltip sits outside the toggle button to avoid nesting
       * interactive elements (which is invalid HTML).
       */}
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex flex-1 items-center justify-between px-3 py-2",
            "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
            "hover:text-foreground transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          )}
        >
          {label}
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-3 shrink-0 transition-transform duration-150",
              open && "rotate-90",
            )}
          />
        </button>
        {tooltip && (
          <div className="pr-2 shrink-0">
            <InfoTooltip
              content={tooltip}
              side="right"
              align="start"
              icon="info"
              label={`About ${label}`}
            />
          </div>
        )}
      </div>

      {open && (
        <div className="pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-dimension labeled row — internal
// ---------------------------------------------------------------------------

interface FilterDimRowProps {
  label: string;
  /** True when this dim has a non-default value (shows × reset chip). */
  active?: boolean;
  onReset?: () => void;
  children: ReactNode;
  /**
   * P3-07: data-filter-dim anchor so GraphFilterChips can scroll to this dim.
   * Value should match the primary FilterState key for this dimension.
   */
  dataDim?: string;
  /** Optional InfoTooltip content shown next to the dim label. */
  tooltip?: string;
}

function FilterDimRow({ label, active = false, onReset, children, dataDim, tooltip }: FilterDimRowProps) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-1.5" data-filter-dim={dataDim}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-foreground/70">{label}</span>
          {tooltip && (
            <InfoTooltip
              content={tooltip}
              side="right"
              align="start"
              icon="info"
              label={`About ${label} filter`}
            />
          )}
        </div>
        {active && onReset && (
          <button
            type="button"
            aria-label={`Reset ${label} filter`}
            onClick={onReset}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1 py-0.5",
              "text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent",
              "transition-colors focus:outline-none",
            )}
          >
            <X className="size-2.5" />
            <span>reset</span>
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GraphFilters — main component
// ---------------------------------------------------------------------------

export interface GraphFiltersProps {
  values: GraphFiltersValues;
  onChange: (values: GraphFiltersValues) => void;
  /** Options for autocomplete dims (project, domain, tags). Empty until P3-03 hydrates. */
  options?: GraphFiltersOptions;
}

/**
 * Renders all 16 filter dimensions inside three accordion sections:
 *   1. Primary — workspace, artifact_type, edge_type (open by default)
 *   2. Secondary — freshness_class, project, domain, date_range (collapsed)
 *   3. Advanced — dims 8-15 (collapsed)
 *
 * Note: free-text (dim 16) is rendered by FilterSidebar in its header slot,
 * not here — it is "always visible" per filter contract §10.
 */
export function GraphFilters({
  values,
  onChange,
  options = { project: [], domain: [], tags: [] },
}: GraphFiltersProps) {
  // Convenience patch helper
  const patch = <K extends keyof GraphFiltersValues>(key: K, val: GraphFiltersValues[K]) =>
    onChange({ ...values, [key]: val });

  // ── Derived "is active" flags ────────────────────────────────────────────
  const wsActive        = values.ws.length > 0;
  const typesActive     = values.types.length > 0;
  const edgesActive     = values.edges.length > 0;
  const freshnessActive = values.freshness.length > 0;
  const projectActive   = values.project.length > 0;
  const domainActive    = values.domain.length > 0;
  const dateActive      = !!(values.date_from || values.date_to || values.updated_from || values.updated_to);
  const fidelityActive  = values.fidelity_min > 0;
  const fscoreActive    = values.fscore_min > 0 || values.fscore_max < 1;
  const confActive      = values.conf_min > 0 || values.conf_max < 1;
  const lifecycleActive = values.lifecycle.length > 0;
  const statusActive    = values.status.length > 0;
  const verifActive     = values.verif.length > 0;
  const tagsActive      = values.tags.length > 0;

  // ── Enrich artifact_type options with facet counts ───────────────────────
  const enrichedArtifactGroups: OptionGroup[] = ARTIFACT_TYPE_GROUPS.map((g) => ({
    ...g,
    options: g.options.map((o) => ({
      ...o,
      count: options.edgeCounts?.[o.value] !== undefined
        ? options.typeCounts?.[o.value]
        : undefined,
    })),
  }));

  // ── Enrich edge type options with facet counts ───────────────────────────
  const enrichedEdgeOptions: EdgeTypeOption[] = EDGE_TYPE_OPTIONS.map((o) => ({
    ...o,
    count: options.edgeCounts?.[o.value],
  }));

  return (
    <div className="flex flex-col">

      {/* ================================================================== */}
      {/* PRIMARY — workspace, artifact_type, edge_type                       */}
      {/* ================================================================== */}
      <FilterAccordionSection
        label="Primary filters"
        defaultOpen
        tooltip={TOOLTIP_COPY.graph.filterWorkspace}
      >

        {/* Dim 1: workspace */}
        <FilterDimRow
          label="Workspace"
          active={wsActive}
          onReset={() => patch("ws", [])}
          dataDim="ws"
          tooltip={TOOLTIP_COPY.graph.filterWorkspace}
        >
          <SegmentedControl
            value={values.ws}
            onChange={(v) => patch("ws", v)}
            options={WORKSPACE_OPTIONS}
            allowMulti
          />
        </FilterDimRow>

        {/* Dim 2: artifact_type */}
        <FilterDimRow
          label="Artifact type"
          active={typesActive}
          onReset={() => patch("types", [])}
          dataDim="types"
          tooltip={TOOLTIP_COPY.graph.filterArtifactType}
        >
          <GroupedMultiSelect
            value={values.types}
            onChange={(v) => patch("types", v)}
            groups={enrichedArtifactGroups}
          />
        </FilterDimRow>

        {/* Dim 3: edge_type */}
        <FilterDimRow
          label="Edge type"
          active={edgesActive}
          onReset={() => patch("edges", [])}
          dataDim="edges"
          tooltip={TOOLTIP_COPY.graph.filterEdgeType}
        >
          {/* Contract §2.3 note: 3 engine-only types not available in web graph */}
          <p className="text-[10px] text-muted-foreground/60 italic mb-1.5">
            Shows 9 portal-projected edge types.
          </p>
          <EdgeTypeCheckboxList
            value={values.edges.length === 0
              ? EDGE_TYPE_OPTIONS.map((o) => o.value) // default: all checked
              : values.edges}
            onChange={(v) => {
              // "all selected" = no filter (empty array)
              const allValues = EDGE_TYPE_OPTIONS.map((o) => o.value);
              const isAll = allValues.every((e) => v.includes(e));
              patch("edges", isAll ? [] : v);
            }}
            options={enrichedEdgeOptions}
          />
        </FilterDimRow>

      </FilterAccordionSection>

      {/* ================================================================== */}
      {/* SECONDARY — freshness_class, project, domain, date_range            */}
      {/* ================================================================== */}
      <FilterAccordionSection
        label="Secondary filters"
        tooltip={TOOLTIP_COPY.graph.filterFreshnessClass}
      >

        {/* Dim 4: freshness_class */}
        <FilterDimRow
          label="Freshness class"
          active={freshnessActive}
          onReset={() => patch("freshness", [])}
          dataDim="freshness"
          tooltip={TOOLTIP_COPY.graph.filterFreshnessClass}
        >
          <SegmentedControl
            value={values.freshness}
            onChange={(v) => patch("freshness", v)}
            options={FRESHNESS_CLASS_OPTIONS}
            allowMulti
          />
        </FilterDimRow>

        {/* Dim 5: project */}
        <FilterDimRow
          label="Project"
          active={projectActive}
          onReset={() => patch("project", [])}
          dataDim="project"
          tooltip={TOOLTIP_COPY.graph.filterProject}
        >
          <MultiSelectAutocomplete
            value={values.project}
            onChange={(v) => patch("project", v)}
            options={options.project}
            placeholder="Search projects…"
            emptyMessage="No projects found"
          />
        </FilterDimRow>

        {/* Dim 6: domain */}
        <FilterDimRow
          label="Domain"
          active={domainActive}
          onReset={() => patch("domain", [])}
          dataDim="domain"
          tooltip={TOOLTIP_COPY.graph.filterDomain}
        >
          <MultiSelectAutocomplete
            value={values.domain}
            onChange={(v) => patch("domain", v)}
            options={options.domain}
            placeholder="Search domains…"
            emptyMessage="No domains found"
          />
        </FilterDimRow>

        {/* Dim 7: date_range (created) */}
        <FilterDimRow
          label="Date range"
          active={dateActive}
          dataDim="date_from"
          tooltip={TOOLTIP_COPY.graph.filterDateRange}
          onReset={() =>
            onChange({
              ...values,
              date_from: "",
              date_to: "",
              updated_from: "",
              updated_to: "",
            })
          }
        >
          <div className="flex flex-col gap-2">
            <DateRangePicker
              label="Created"
              value={{ from: values.date_from, to: values.date_to }}
              onChange={({ from, to }) =>
                onChange({ ...values, date_from: from, date_to: to })
              }
            />
            <DateRangePicker
              label="Updated"
              value={{ from: values.updated_from, to: values.updated_to }}
              onChange={({ from, to }) =>
                onChange({ ...values, updated_from: from, updated_to: to })
              }
            />
          </div>
        </FilterDimRow>

      </FilterAccordionSection>

      {/* ================================================================== */}
      {/* ADVANCED — dims 8-15 (collapsed by default)                         */}
      {/* ================================================================== */}
      <FilterAccordionSection
        label="Advanced filters"
        tooltip={TOOLTIP_COPY.graph.filterFidelityLevel}
      >

        {/* Dim 8: fidelity_level */}
        <FilterDimRow
          label="Fidelity level"
          active={fidelityActive}
          onReset={() => patch("fidelity_min", 0)}
          dataDim="fidelity_min"
          tooltip={TOOLTIP_COPY.graph.filterFidelityLevel}
        >
          <SingleRangeSlider
            min={0}
            max={1}
            step={0.25}
            value={values.fidelity_min}
            onChange={(v) => patch("fidelity_min", v)}
            formatLabel={(v) => {
              const band = Math.round(v * 4);
              return `F${band}+`;
            }}
            trackLabels={FIDELITY_TRACK_LABELS}
          />
          {/* F3+ shortcut toggle */}
          <button
            type="button"
            onClick={() => patch("fidelity_min", 0.75)}
            className={cn(
              "mt-1.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]",
              "transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              values.fidelity_min >= 0.75
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            High quality only (F3+)
          </button>
        </FilterDimRow>

        {/* Dim 9: freshness_score */}
        <FilterDimRow
          label="Freshness score"
          active={fscoreActive}
          onReset={() => onChange({ ...values, fscore_min: 0, fscore_max: 1 })}
          dataDim="fscore_min"
          tooltip={TOOLTIP_COPY.graph.filterFreshnessScore}
        >
          <RangeSlider
            min={0}
            max={1}
            step={0.05}
            value={[values.fscore_min, values.fscore_max]}
            onChange={([min, max]) =>
              onChange({ ...values, fscore_min: min, fscore_max: max })
            }
            formatLabel={(v) => v.toFixed(2)}
          />
        </FilterDimRow>

        {/* Dim 10: classification_confidence */}
        <FilterDimRow
          label="Classification confidence"
          active={confActive}
          onReset={() => onChange({ ...values, conf_min: 0, conf_max: 1 })}
          dataDim="conf_min"
          tooltip={TOOLTIP_COPY.graph.filterConfidence}
        >
          <RangeSlider
            min={0}
            max={1}
            step={0.05}
            value={[values.conf_min, values.conf_max]}
            onChange={([min, max]) =>
              onChange({ ...values, conf_min: min, conf_max: max })
            }
            formatLabel={(v) => v.toFixed(2)}
          />
          {/* "Low confidence only" shortcut toggle */}
          <label className="mt-1.5 flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={values.conf_min === 0 && values.conf_max <= 0.5}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange({ ...values, conf_min: 0, conf_max: 0.5 });
                } else {
                  onChange({ ...values, conf_min: 0, conf_max: 1 });
                }
              }}
              aria-label="Show low-confidence only"
            />
            <span className="text-[11px] text-foreground/70">Low confidence only (&lt;0.5)</span>
          </label>
        </FilterDimRow>

        {/* Dim 11: lifecycle_stage */}
        <FilterDimRow
          label="Lifecycle stage"
          active={lifecycleActive}
          onReset={() => patch("lifecycle", [])}
          dataDim="lifecycle"
        >
          <SegmentedControl
            value={values.lifecycle}
            onChange={(v) => patch("lifecycle", v)}
            options={LIFECYCLE_OPTIONS}
            allowMulti
          />
        </FilterDimRow>

        {/* Dim 12: status */}
        <FilterDimRow
          label="Status"
          active={statusActive}
          onReset={() => patch("status", [])}
          dataDim="status"
        >
          <SegmentedControl
            value={values.status}
            onChange={(v) => patch("status", v)}
            options={STATUS_OPTIONS}
            allowMulti
          />
        </FilterDimRow>

        {/* Dim 13: verification_status */}
        <FilterDimRow
          label="Verification"
          active={verifActive}
          onReset={() => patch("verif", [])}
          dataDim="verif"
        >
          <SegmentedControl
            value={values.verif}
            onChange={(v) => patch("verif", v)}
            options={VERIF_OPTIONS}
            allowMulti
          />
        </FilterDimRow>

        {/* Dim 14: tags */}
        <FilterDimRow
          label="Tags"
          active={tagsActive}
          onReset={() => patch("tags", [])}
          dataDim="tags"
          tooltip={TOOLTIP_COPY.graph.filterTags}
        >
          <MultiSelectAutocomplete
            value={values.tags}
            onChange={(v) => patch("tags", v)}
            options={options.tags}
            placeholder="Search tags…"
            emptyMessage="No tags found"
          />
        </FilterDimRow>

        {/* Dim 15: semantic_neighbor — disabled placeholder */}
        <FilterDimRow
          label="Semantic neighbor"
          dataDim="sem_node"
          tooltip={TOOLTIP_COPY.graph.filterSemanticNeighbor}
        >
          <div
            className={cn(
              "flex flex-col gap-1.5 rounded-md border border-dashed border-border/60",
              "bg-muted/30 px-3 py-2.5",
            )}
          >
            <div className="flex items-start gap-2">
              <Info aria-hidden="true" className="mt-0.5 size-3 shrink-0 text-muted-foreground/60" />
              <p className="text-[11px] text-muted-foreground/80 leading-snug">
                Available when a node is selected via the right-click context menu.
                Requires semantic indexing (SPIKE 2).
              </p>
            </div>
            {/* Pill placeholder */}
            <div className="rounded-full border border-dashed border-border/60 bg-background px-3 py-1.5 text-[11px] text-muted-foreground/50 italic">
              No node selected
            </div>
            {/* k-slider placeholder */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50">k =</span>
              <input
                type="range"
                min={5}
                max={20}
                step={1}
                value={values.sem_k}
                disabled
                aria-label="Semantic neighbor count (disabled)"
                className="flex-1 h-1.5 appearance-none bg-muted rounded-full opacity-40 cursor-not-allowed"
              />
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">{values.sem_k}</span>
            </div>
          </div>
        </FilterDimRow>

      </FilterAccordionSection>
    </div>
  );
}
