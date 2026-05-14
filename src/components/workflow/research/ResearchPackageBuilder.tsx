"use client";

/**
 * ResearchPackageBuilder — Step 1 of the 3-step external-research wizard.
 *
 * Collects the four required fields:
 *   - topic              (text input)
 *   - research_question  (textarea)
 *   - corpus             (checkbox-group → project: string[])
 *   - domain             (multi-select toggle pills → domain: string[])
 *
 * All four are required; the "Analyse Routes" submit button is disabled until
 * both topic and research_question are non-empty (corpus + domain may be empty
 * arrays per the backend contract).
 *
 * On submit, dispatches submitPackage() from useWizardStateContext(), which
 * fires FETCH_ROUTES_START → POST /api/workflows/external-research/routing-analysis
 * → FETCH_ROUTES_SUCCESS (advances to Step 2) | FETCH_ROUTES_ERROR.
 *
 * Errors with error_scope === "routing" are surfaced inline above the submit
 * button so the user sees them without losing their input.
 *
 * State convention:
 *   - All field edits dispatch SET_PACKAGE_FIELD via raw dispatch.
 *   - corpus maps to package_fields.project (string[]).
 *   - domain maps to package_fields.domain (string[]).
 *
 * Design contract: meatywiki/.claude/context/key-context/research-wizard-state-machine.md §1-5
 * P4-03 (audit-wave-2-phase-4).
 */

import { useId, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useWizardStateContext } from "@/hooks/useWorkflowWizardState";

// ---------------------------------------------------------------------------
// Static option data
// ---------------------------------------------------------------------------

/** Known project slugs — used for the corpus checkbox group. */
const CORPUS_OPTIONS: { slug: string; label: string; description: string }[] = [
  { slug: "default", label: "Default Vault", description: "All artifacts not assigned to a named project." },
  { slug: "blog", label: "Blog", description: "Published and draft blog post artifacts." },
  { slug: "research", label: "Research", description: "Evidence, syntheses, and reference notes." },
  { slug: "projects", label: "Projects", description: "Project-scoped work artifacts." },
];

/** Domain-hint slugs — multi-select toggle pills. */
const DOMAIN_OPTIONS: { slug: string; label: string }[] = [
  { slug: "technology", label: "Technology" },
  { slug: "science", label: "Science" },
  { slug: "medicine", label: "Medicine" },
  { slug: "business", label: "Business" },
  { slug: "law", label: "Law" },
  { slug: "history", label: "History" },
  { slug: "culture", label: "Culture" },
  { slug: "engineering", label: "Engineering" },
  { slug: "mathematics", label: "Mathematics" },
  { slug: "philosophy", label: "Philosophy" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldLabelProps {
  htmlFor: string;
  label: string;
  hint?: string;
  required?: boolean;
}

function FieldLabel({ htmlFor, label, hint, required = false }: FieldLabelProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-semibold text-foreground"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </label>
      {hint && (
        <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResearchPackageBuilder() {
  const { state, dispatch, actions } = useWizardStateContext();
  const { package_fields, is_fetching_routes, error, error_scope } = state;

  const topicId = useId();
  const questionId = useId();
  const corpusId = useId();
  const domainId = useId();

  // Validity: topic + research_question required; corpus + domain may be empty.
  const isValid =
    package_fields.topic.trim().length > 0 &&
    package_fields.research_question.trim().length > 0;

  // -------------------------------------------------------------------------
  // Field handlers
  // -------------------------------------------------------------------------

  const handleTopicChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: "SET_PACKAGE_FIELD",
        field: "topic",
        value: e.target.value,
      });
    },
    [dispatch],
  );

  const handleQuestionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      dispatch({
        type: "SET_PACKAGE_FIELD",
        field: "research_question",
        value: e.target.value,
      });
    },
    [dispatch],
  );

  const handleCorpusToggle = useCallback(
    (slug: string, checked: boolean) => {
      const current = package_fields.project as string[];
      const next = checked
        ? [...current, slug]
        : current.filter((s) => s !== slug);
      dispatch({ type: "SET_PACKAGE_FIELD", field: "project", value: next });
    },
    [dispatch, package_fields.project],
  );

  const handleDomainToggle = useCallback(
    (slug: string) => {
      const current = package_fields.domain as string[];
      const next = current.includes(slug)
        ? current.filter((d) => d !== slug)
        : [...current, slug];
      dispatch({ type: "SET_PACKAGE_FIELD", field: "domain", value: next });
    },
    [dispatch, package_fields.domain],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!isValid || is_fetching_routes) return;
      void actions.submitPackage();
    },
    [isValid, is_fetching_routes, actions],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const corpusValues = package_fields.project as string[];
  const domainValues = package_fields.domain as string[];
  const showRoutingError = error !== null && error_scope === "routing";

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Research package configuration"
      className="flex flex-col gap-8"
      noValidate
    >
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">
          Define Research Package
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe what you need to research. The routing analyser will suggest
          the best venue once you submit.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Field 1 — Topic                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <FieldLabel
          htmlFor={topicId}
          label="Topic"
          hint="A short, human-readable label for this research thread."
          required
        />
        <Input
          id={topicId}
          type="text"
          placeholder="e.g. pgvector vs Qdrant latency at 1M vectors"
          value={package_fields.topic as string}
          onChange={handleTopicChange}
          aria-required="true"
          aria-describedby={`${topicId}-hint`}
          disabled={is_fetching_routes}
          maxLength={200}
          autoFocus
        />
        <p id={`${topicId}-hint`} className="sr-only">
          Short, descriptive topic name. Required.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Field 2 — Research Question                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <FieldLabel
          htmlFor={questionId}
          label="Research Question"
          hint="The primary question this run should answer. Be specific — the routing analyser uses this to score venues."
          required
        />
        <textarea
          id={questionId}
          rows={4}
          placeholder="e.g. What are the latency and throughput trade-offs between pgvector IVFFlat and Qdrant HNSW at 1M 1536-dim vectors?"
          value={package_fields.research_question as string}
          onChange={handleQuestionChange}
          aria-required="true"
          aria-describedby={`${questionId}-hint`}
          disabled={is_fetching_routes}
          maxLength={2000}
          className={cn(
            "flex w-full resize-y rounded-md border border-input bg-background px-3 py-2",
            "text-sm ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[100px]",
          )}
        />
        <p id={`${questionId}-hint`} className="sr-only">
          Primary research question. Required.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Field 3 — Corpus (project checkbox-group)                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <FieldLabel
          htmlFor={corpusId}
          label="Corpus"
          hint="Select which project workspaces to include as source context. Leave empty to use the full vault."
        />
        <fieldset id={corpusId} aria-label="Corpus workspace selection">
          <legend className="sr-only">Corpus workspace selection</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CORPUS_OPTIONS.map((opt) => {
              const checkboxId = `corpus-${opt.slug}`;
              const isChecked = corpusValues.includes(opt.slug);
              return (
                <label
                  key={opt.slug}
                  htmlFor={checkboxId}
                  className={cn(
                    "relative flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition-all duration-150",
                    "hover:border-foreground/25 hover:bg-accent/30",
                    "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
                    isChecked
                      ? "border-foreground/50 bg-accent/40"
                      : "border-border bg-card",
                    is_fetching_routes && "pointer-events-none opacity-50",
                  )}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      handleCorpusToggle(opt.slug, checked === true)
                    }
                    disabled={is_fetching_routes}
                    aria-describedby={`${checkboxId}-desc`}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {opt.label}
                    </span>
                    <span
                      id={`${checkboxId}-desc`}
                      className="block text-xs text-muted-foreground leading-relaxed"
                    >
                      {opt.description}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Field 4 — Domain (multi-select toggle pills)                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-3">
        <FieldLabel
          htmlFor={domainId}
          label="Domain Hints"
          hint="Select one or more knowledge domains. The routing analyser uses these to score venue suitability."
        />
        <div
          id={domainId}
          role="group"
          aria-label="Domain hint selection"
          className="flex flex-wrap gap-2"
        >
          {DOMAIN_OPTIONS.map((opt) => {
            const isActive = domainValues.includes(opt.slug);
            return (
              <button
                key={opt.slug}
                type="button"
                role="checkbox"
                aria-checked={isActive}
                aria-label={`Domain: ${opt.label}`}
                onClick={() => handleDomainToggle(opt.slug)}
                disabled={is_fetching_routes}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold",
                  "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-ring focus-visible:ring-offset-2",
                  "disabled:pointer-events-none disabled:opacity-50",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:bg-accent/40 hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {domainValues.length > 0 && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {domainValues.length} domain hint
            {domainValues.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Error — routing scope only                                          */}
      {/* ------------------------------------------------------------------ */}
      {showRoutingError && (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            "rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3",
            "text-sm text-destructive",
          )}
        >
          <span className="font-semibold">Routing analysis failed: </span>
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Submit                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {!isValid && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Topic and research question are required.
          </p>
        )}
        <Button
          type="submit"
          disabled={!isValid || is_fetching_routes}
          aria-busy={is_fetching_routes}
          className="min-w-[160px]"
        >
          {is_fetching_routes ? (
            <span className="flex items-center gap-2">
              <SpinnerIcon aria-hidden="true" className="size-4 animate-spin" />
              Analysing…
            </span>
          ) : (
            "Analyse Routes"
          )}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Inline spinner — avoids adding a dependency for a single icon
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
