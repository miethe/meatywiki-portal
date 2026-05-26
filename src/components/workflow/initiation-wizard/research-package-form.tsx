"use client";

/**
 * ResearchPackageForm — Step 1 for external_research_v1 wizard flow.
 *
 * Renders when selectedTemplateId === "external_research_v1" in step-1-source.tsx.
 * The generic Step1Source component is left completely unchanged.
 *
 * Fields per FR-W2 and spec § 10.1:
 *   - topic (required text input)
 *   - research_question (required textarea)
 *   - background_context (optional markdown textarea)
 *   - project (optional multi-select from user's projects)
 *   - domain (optional multi-select tags)
 *   - corpus picker (filterable by workspace/type/status/tag;
 *     shows title/type/freshness/evidence_strength)
 *   - desired_output (enum select)
 *   - save_package (boolean toggle, default true)
 *
 * Phase: P3-02 (portal-v2.1-research-workflow-realignment)
 */

import { useState, useCallback, useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { listArtifacts } from "@/lib/api/artifacts";
import type { ResearchPackage } from "./initiation-wizard";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResearchPackageFormProps {
  value: ResearchPackage;
  onChange: (patch: Partial<ResearchPackage>) => void;
}

// ---------------------------------------------------------------------------
// Desired output options
// ---------------------------------------------------------------------------

const DESIRED_OUTPUT_OPTIONS: { value: ResearchPackage["desired_output"]; label: string }[] = [
  { value: "briefing", label: "Briefing" },
  { value: "topic_note", label: "Topic Note" },
  { value: "blog", label: "Blog Post" },
  { value: "prd", label: "PRD" },
];

// ---------------------------------------------------------------------------
// Freshness helper
// ---------------------------------------------------------------------------

function formatFreshness(updated: string | null | undefined): string {
  if (!updated) return "Unknown";
  const ms = Date.now() - new Date(updated).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ---------------------------------------------------------------------------
// Shared field label component
// ---------------------------------------------------------------------------

function FieldLabel({
  htmlFor,
  children,
  required,
  optional,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {children}
      {required && (
        <>
          <span aria-hidden="true" className="text-destructive">*</span>
          <span className="sr-only">(required)</span>
        </>
      )}
      {optional && (
        <span className="text-[10px] normal-case font-normal tracking-normal text-muted-foreground/60">
          optional
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Corpus picker
// ---------------------------------------------------------------------------

interface CorpusFilters {
  workspace: string;
  type: string;
  status: string;
  tag: string;
  search: string;
}

interface CorpusPickerProps {
  selectedIds: string[];
  onToggle: (id: string) => void;
}

function CorpusPicker({ selectedIds, onToggle }: CorpusPickerProps) {
  const [filters, setFilters] = useState<CorpusFilters>({
    workspace: "",
    type: "",
    status: "",
    tag: "",
    search: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["corpus-picker", filters],
    queryFn: () =>
      listArtifacts({
        workspace: filters.workspace || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        tags: filters.tag ? [filters.tag] : undefined,
        limit: 40,
        sort: "updated",
        order: "desc",
      }),
    staleTime: 30_000,
  });

  const artifacts: ArtifactCard[] = data?.data ?? [];

  const filteredArtifacts = filters.search.trim()
    ? artifacts.filter((a) =>
        (a.title ?? "").toLowerCase().includes(filters.search.toLowerCase())
      )
    : artifacts;

  return (
    <div className="flex flex-col gap-3">
      {/* Filter row */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search artifacts…"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          aria-label="Search corpus artifacts"
          className={cn(
            "flex-1 min-w-[140px] rounded-md border border-input bg-background px-3 py-1.5 text-xs",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "placeholder:text-muted-foreground",
          )}
        />
        <select
          value={filters.workspace}
          onChange={(e) => setFilters((f) => ({ ...f, workspace: e.target.value }))}
          aria-label="Filter by workspace"
          className={cn(
            "rounded-md border border-input bg-background px-2.5 py-1.5 text-xs",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          <option value="">All workspaces</option>
          <option value="library">Library</option>
          <option value="research">Research</option>
          <option value="projects">Projects</option>
        </select>
        <select
          value={filters.type}
          onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          aria-label="Filter by artifact type"
          className={cn(
            "rounded-md border border-input bg-background px-2.5 py-1.5 text-xs",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          <option value="">All types</option>
          <option value="synthesis">Synthesis</option>
          <option value="raw_import">Raw Import</option>
          <option value="topic">Topic</option>
          <option value="concept">Concept</option>
          <option value="evidence">Evidence</option>
          <option value="summary">Summary</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          aria-label="Filter by artifact status"
          className={cn(
            "rounded-md border border-input bg-background px-2.5 py-1.5 text-xs",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          )}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="reviewed">Reviewed</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Artifact list */}
      <div
        role="listbox"
        aria-label="Corpus artifact picker"
        aria-multiselectable="true"
        className="max-h-[220px] overflow-y-auto rounded-md border border-input bg-background"
      >
        {isLoading && (
          <div className="flex flex-col gap-1.5 p-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="h-10 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="px-3 py-3 text-xs text-destructive">
            Failed to load artifacts. Check backend connectivity.
          </div>
        )}

        {!isLoading && !error && filteredArtifacts.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            No artifacts found matching your filters.
          </div>
        )}

        {!isLoading &&
          filteredArtifacts.map((artifact) => {
            const isSelected = selectedIds.includes(artifact.id);
            const freshnessLabel = formatFreshness(artifact.updated);
            // evidence_strength is not in ArtifactCard v1; may be present in enriched responses.
            const evidenceStrength = (artifact as ArtifactCard & { evidence_strength?: number })
              .evidence_strength;

            return (
              <div
                key={artifact.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => onToggle(artifact.id)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onToggle(artifact.id);
                  }
                }}
                tabIndex={0}
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2.5 last:border-0",
                  "transition-colors hover:bg-accent/40",
                  "focus:outline-none focus-visible:bg-accent/60",
                  isSelected && "bg-accent/50",
                )}
              >
                {/* Checkbox indicator */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                    isSelected
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted-foreground/40",
                  )}
                >
                  {isSelected && (
                    <svg className="size-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                {/* Artifact info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {artifact.title ?? artifact.id}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground/70">
                      {artifact.type ?? "unknown"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] text-muted-foreground/70">{freshnessLabel}</span>
                    {evidenceStrength != null && (
                      <>
                        <span className="text-[10px] text-muted-foreground/50">·</span>
                        <span className="text-[10px] text-muted-foreground/70">
                          Evidence: {Math.round(evidenceStrength * 100)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} artifact{selectedIds.length === 1 ? "" : "s"} selected
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tag input (domain / project)
// ---------------------------------------------------------------------------

interface TagInputProps {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  "aria-label": string;
}

function TagInput({ id, values, onChange, placeholder, "aria-label": ariaLabel }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim();
      if (tag && !values.includes(tag)) {
        onChange([...values, tag]);
      }
      setInputValue("");
    },
    [values, onChange],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(values.filter((v) => v !== tag));
    },
    [values, onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
        )}
      >
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(inputValue);
            } else if (e.key === "Backspace" && !inputValue && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (inputValue.trim()) addTag(inputValue);
          }}
          placeholder={values.length === 0 ? placeholder : "Add more…"}
          aria-label={ariaLabel}
          className={cn(
            "flex-1 min-w-[80px] bg-transparent text-xs outline-none",
            "placeholder:text-muted-foreground",
          )}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Press Enter or comma to add. Backspace removes the last tag.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResearchPackageForm
// ---------------------------------------------------------------------------

export function ResearchPackageForm({ value, onChange }: ResearchPackageFormProps) {
  const topicId = useId();
  const questionId = useId();
  const contextId = useId();
  const domainId = useId();
  const projectId = useId();
  const outputId = useId();
  const saveId = useId();

  return (
    <div className="flex flex-col gap-6">
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Research Package</h2>
        <p className="mt-1 text-sm text-muted-foreground italic">
          Define your research question, corpus, and output preferences.
        </p>
      </div>

      {/* Topic */}
      <div className="space-y-1.5">
        <FieldLabel htmlFor={topicId} required>
          Topic
        </FieldLabel>
        <input
          id={topicId}
          type="text"
          value={value.topic}
          onChange={(e) => onChange({ topic: e.target.value })}
          placeholder="e.g. LLM evaluation methods"
          required
          aria-required="true"
          className={cn(
            "w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "placeholder:text-muted-foreground",
            !value.topic.trim() && "border-muted-foreground/40",
          )}
        />
        <p className="text-xs text-muted-foreground">Short label for this research topic.</p>
      </div>

      {/* Research Question */}
      <div className="space-y-1.5">
        <FieldLabel htmlFor={questionId} required>
          Research Question
        </FieldLabel>
        <textarea
          id={questionId}
          value={value.research_question}
          onChange={(e) => onChange({ research_question: e.target.value })}
          placeholder="What is the primary question this research should answer?"
          required
          aria-required="true"
          rows={3}
          className={cn(
            "w-full resize-y rounded-md border border-input bg-background px-4 py-2.5 text-sm",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "placeholder:text-muted-foreground",
          )}
        />
      </div>

      {/* Background Context */}
      <div className="space-y-1.5">
        <FieldLabel htmlFor={contextId} optional>
          Background Context
        </FieldLabel>
        <textarea
          id={contextId}
          value={value.background_context}
          onChange={(e) => onChange({ background_context: e.target.value })}
          placeholder="Provide any relevant background that will help frame the research…"
          rows={3}
          className={cn(
            "w-full resize-y rounded-md border border-input bg-background px-4 py-2.5 text-sm",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "placeholder:text-muted-foreground",
          )}
        />
        <p className="text-xs text-muted-foreground">
          Markdown supported. Included in the generated prompt package.
        </p>
      </div>

      {/* Domain Tags */}
      <div className="space-y-1.5">
        <FieldLabel htmlFor={domainId} optional>
          Domain Hints
        </FieldLabel>
        <TagInput
          id={domainId}
          values={value.domain}
          onChange={(domain) => onChange({ domain })}
          placeholder="machine learning, systems…"
          aria-label="Domain hints — used to score venue suitability"
        />
      </div>

      {/* Project Tags */}
      <div className="space-y-1.5">
        <FieldLabel htmlFor={projectId} optional>
          Projects
        </FieldLabel>
        <TagInput
          id={projectId}
          values={value.project}
          onChange={(project) => onChange({ project })}
          placeholder="project-slug…"
          aria-label="Associated project slugs"
        />
      </div>

      {/* Artifact Corpus Picker */}
      <div className="space-y-1.5">
        <FieldLabel htmlFor="corpus-search-input" optional>
          Corpus Artifacts
        </FieldLabel>
        <p className="text-xs text-muted-foreground">
          Select artifacts to include in the research package. An empty corpus is valid —
          the router will recommend an appropriate venue.
        </p>
        <CorpusPicker
          selectedIds={value.selected_artifact_ids}
          onToggle={(id) => {
            const next = value.selected_artifact_ids.includes(id)
              ? value.selected_artifact_ids.filter((x) => x !== id)
              : [...value.selected_artifact_ids, id];
            onChange({ selected_artifact_ids: next });
          }}
        />
      </div>

      {/* Desired Output */}
      <div className="space-y-1.5">
        <FieldLabel htmlFor={outputId}>
          Desired Output
        </FieldLabel>
        <div className="relative">
          <select
            id={outputId}
            value={value.desired_output}
            onChange={(e) =>
              onChange({ desired_output: e.target.value as ResearchPackage["desired_output"] })
            }
            className={cn(
              "w-full appearance-none rounded-md border border-input bg-background px-4 py-2.5 pr-8 text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            {DESIRED_OUTPUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center"
          >
            <svg
              className="size-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Target artifact type to be produced after the research run completes.
        </p>
      </div>

      {/* Save Package Toggle */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4">
        <input
          id={saveId}
          type="checkbox"
          checked={value.save_package}
          onChange={(e) => onChange({ save_package: e.target.checked })}
          className="mt-0.5 size-4 rounded border-input text-foreground focus:ring-ring"
        />
        <div className="flex-1">
          <label
            htmlFor={saveId}
            className="cursor-pointer text-sm font-medium text-foreground"
          >
            Save prompt package to vault
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Creates a prompt package artifact linked to this research run and corpus
            artifacts via graph edges.
          </p>
        </div>
      </div>
    </div>
  );
}
