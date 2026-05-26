"use client";

/**
 * ResearchPackageBuilder — Step 1 of the 3-step external-research wizard.
 *
 * Collects the core required fields plus optional parameter expansions:
 *   - topic              (text input, required)
 *   - research_question  (textarea, required)
 *   - corpus             (checkbox-group → project: string[])
 *   - domain             (multi-select toggle pills → domain: string[])
 *
 * v2.4 additions (P3-01, P3-02, P3-03):
 *   - Quick-Start Package Upload zone (drag-and-drop / file picker for .json)
 *   - 7 manual parameter fields:
 *       sensitivity_profile, task_type, audience, desired_output,
 *       time_profile, cost_sensitivity, reuse_likelihood
 *   - Methodology Note textarea (→ background)
 *   - JSON Editor toggle (preview + live sync back)
 *
 * Design contract: meatywiki/.claude/context/key-context/research-wizard-state-machine.md §1-5
 */

import { useId, useCallback, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWizardStateContext } from "@/hooks/useWorkflowWizardState";
import { uploadResearchPackage } from "@/lib/api/research";
import type {
  SensitivityProfile,
  TimeProfile,
  CostSensitivity,
  ReuseLikelihood,
  DesiredOutput,
  PackageUploadFieldError,
} from "@/types/workflows/research";

// ---------------------------------------------------------------------------
// Static option data
// ---------------------------------------------------------------------------

const CORPUS_OPTIONS: { slug: string; label: string; description: string }[] = [
  { slug: "default", label: "Default Vault", description: "All artifacts not assigned to a named project." },
  { slug: "blog", label: "Blog", description: "Published and draft blog post artifacts." },
  { slug: "research", label: "Research", description: "Evidence, syntheses, and reference notes." },
  { slug: "projects", label: "Projects", description: "Project-scoped work artifacts." },
];

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

const DESIRED_OUTPUT_OPTIONS: { value: DesiredOutput | "comparison" | "evidence_summary" | "custom"; label: string }[] = [
  { value: "briefing", label: "Briefing" },
  { value: "comparison", label: "Comparison" },
  { value: "evidence_summary", label: "Evidence Summary" },
  { value: "topic_note", label: "Topic Note" },
  { value: "blog", label: "Blog" },
  { value: "custom", label: "Custom" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldLabelProps {
  htmlFor?: string;
  label: string;
  hint?: string;
  required?: boolean;
  id?: string;
}

function FieldLabel({ htmlFor, label, hint, required = false, id }: FieldLabelProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <label
        htmlFor={htmlFor}
        id={id}
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

// Three-option toggle (Low/Medium/High, Urgent/Standard/Deep, etc.)
interface TripleToggleProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  name: string;
}

function TripleToggle<T extends string>({
  value,
  options,
  onChange,
  disabled,
  name,
}: TripleToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className={cn(
            "inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium",
            "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:pointer-events-none disabled:opacity-50",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Radio group (Sensitivity Profile)
interface RadioGroupProps<T extends string> {
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  name: string;
  labelledby?: string;
}

function RadioGroup<T extends string>({
  value,
  options,
  onChange,
  disabled,
  name,
  labelledby,
}: RadioGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledby}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const id = `${name}-${opt.value}`;
        const isChecked = value === opt.value;
        return (
          <label
            key={opt.value}
            htmlFor={id}
            className={cn(
              "relative flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2",
              "text-sm transition-all duration-150",
              "hover:border-foreground/25 hover:bg-accent/30",
              "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1",
              isChecked
                ? "border-foreground/50 bg-accent/40 text-foreground font-medium"
                : "border-border bg-card text-muted-foreground",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <input
              type="radio"
              id={id}
              name={name}
              value={opt.value}
              checked={isChecked}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
              className="sr-only"
            />
            <span>{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResearchPackageBuilder() {
  const { state, dispatch, actions } = useWizardStateContext();
  const { package_fields, is_fetching_routes, error, error_scope } = state;

  // IDs for accessibility
  const topicId = useId();
  const questionId = useId();
  const corpusId = useId();
  const domainId = useId();
  const sensitivityLabelId = useId();
  const taskTypeId = useId();
  const audienceId = useId();
  const desiredOutputId = useId();
  const timeProfileLabelId = useId();
  const costSensLabelId = useId();
  const reuseLabelId = useId();
  const methodologyId = useId();

  // P3-01: package upload state
  const [uploadState, setUploadState] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [uploadFilename, setUploadFilename] = useState<string | null>(null);
  const [uploadFieldErrors, setUploadFieldErrors] = useState<PackageUploadFieldError[]>([]);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // P3-03: JSON editor state
  const [jsonEditorOpen, setJsonEditorOpen] = useState(false);
  const [jsonEditorValue, setJsonEditorValue] = useState("");
  const [jsonParseError, setJsonParseError] = useState(false);

  // Sync JSON editor content whenever form fields change (and editor is open)
  useEffect(() => {
    if (!jsonEditorOpen) return;
    const snapshot = buildJsonSnapshot(package_fields);
    setJsonEditorValue(JSON.stringify(snapshot, null, 2));
  }, [jsonEditorOpen, package_fields]);

  // -------------------------------------------------------------------------
  // Validity
  // -------------------------------------------------------------------------
  const isValid =
    (package_fields.topic as string).trim().length > 0 &&
    (package_fields.research_question as string).trim().length > 0;

  // -------------------------------------------------------------------------
  // Field handlers
  // -------------------------------------------------------------------------

  const setField = useCallback(
    <K extends keyof typeof package_fields>(field: K, value: typeof package_fields[K]) => {
      dispatch({ type: "SET_PACKAGE_FIELD", field, value });
    },
    [dispatch],
  );

  const handleTopicChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setField("topic", e.target.value);
    },
    [setField],
  );

  const handleQuestionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setField("research_question", e.target.value);
    },
    [setField],
  );

  const handleCorpusToggle = useCallback(
    (slug: string, checked: boolean) => {
      const current = package_fields.project as string[];
      const next = checked
        ? [...current, slug]
        : current.filter((s) => s !== slug);
      setField("project", next);
    },
    [setField, package_fields.project],
  );

  const handleDomainToggle = useCallback(
    (slug: string) => {
      const current = package_fields.domain as string[];
      const next = current.includes(slug)
        ? current.filter((d) => d !== slug)
        : [...current, slug];
      setField("domain", next);
    },
    [setField, package_fields.domain],
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
  // P3-01: package upload helpers
  // -------------------------------------------------------------------------

  const applyUploadedParams = useCallback(
    (params: Record<string, unknown>) => {
      const fields = [
        "topic", "research_question", "project", "domain",
        "selected_artifact_ids", "route_preference", "desired_output",
        "freshness_window", "citation_strictness", "save_prompt_package",
        "sensitivity_profile", "task_type", "audience",
        "time_profile", "cost_sensitivity", "reuse_likelihood", "background",
      ] as const;

      for (const f of fields) {
        if (f in params && params[f] !== undefined) {
          dispatch({ type: "SET_PACKAGE_FIELD", field: f, value: params[f] as never });
        }
      }
    },
    [dispatch],
  );

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".json")) {
        setUploadState("error");
        setUploadErrorMessage("Only .json files are supported");
        setUploadFieldErrors([]);
        return;
      }

      setUploadState("uploading");
      setUploadFilename(file.name);
      setUploadFieldErrors([]);
      setUploadErrorMessage(null);

      try {
        const result = await uploadResearchPackage(file);
        if (result.hasFieldErrors) {
          setUploadState("error");
          setUploadFieldErrors(result.fieldErrors);
          setUploadErrorMessage(null);
        } else {
          applyUploadedParams(result.data as unknown as Record<string, unknown>);
          setUploadState("success");
          setUploadFieldErrors([]);
        }
      } catch (err) {
        setUploadState("error");
        setUploadErrorMessage(
          err instanceof Error ? err.message : "Upload failed — please try again.",
        );
        setUploadFieldErrors([]);
      }
    },
    [applyUploadedParams],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  // -------------------------------------------------------------------------
  // P3-03: JSON editor helpers
  // -------------------------------------------------------------------------

  function buildJsonSnapshot(fields: typeof package_fields): Record<string, unknown> {
    return {
      topic: fields.topic,
      research_question: fields.research_question,
      project: fields.project,
      domain: fields.domain,
      selected_artifact_ids: fields.selected_artifact_ids,
      route_preference: fields.route_preference,
      desired_output: fields.desired_output,
      freshness_window: fields.freshness_window,
      citation_strictness: fields.citation_strictness,
      save_prompt_package: fields.save_prompt_package,
      sensitivity_profile: fields.sensitivity_profile,
      task_type: fields.task_type,
      audience: fields.audience,
      time_profile: fields.time_profile,
      cost_sensitivity: fields.cost_sensitivity,
      reuse_likelihood: fields.reuse_likelihood,
      background: fields.background,
    };
  }

  const handleJsonEditorBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      const raw = e.target.value;
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        setJsonParseError(false);
        // Sync any recognised string/array fields back to form state
        applyUploadedParams(parsed as Partial<typeof package_fields>);
      } catch {
        setJsonParseError(true);
      }
    },
    [applyUploadedParams],
  );

  const handleJsonEditorChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setJsonEditorValue(e.target.value);
      // Clear parse error while user is editing
      if (jsonParseError) setJsonParseError(false);
    },
    [jsonParseError],
  );

  const handleToggleJsonEditor = useCallback(() => {
    if (!jsonEditorOpen) {
      // Open: snapshot current form state
      setJsonEditorValue(
        JSON.stringify(buildJsonSnapshot(package_fields), null, 2),
      );
      setJsonParseError(false);
    }
    setJsonEditorOpen((prev) => !prev);
  }, [jsonEditorOpen, package_fields]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const corpusValues = package_fields.project as string[];
  const domainValues = package_fields.domain as string[];
  const showRoutingError = error !== null && error_scope === "routing";
  const disabled = is_fetching_routes;

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
      {/* P3-01: Quick-Start Package Upload Zone                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Quick-Start from Package File
            </p>
            <p className="text-xs text-muted-foreground">
              Upload a .json research package to auto-populate the fields below.
            </p>
          </div>
          {uploadState === "success" && uploadFilename && (
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckIcon className="size-3.5" aria-hidden="true" />
              {uploadFilename}
            </span>
          )}
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload research package JSON file"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed",
            "min-h-[80px] cursor-pointer p-4 text-center transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "select-none",
            isDragging
              ? "border-foreground/50 bg-accent/40"
              : "border-border bg-card hover:border-foreground/25 hover:bg-accent/20",
            uploadState === "error" && "border-destructive/50 bg-destructive/5",
            uploadState === "success" && "border-emerald-500/40 bg-emerald-500/5",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileInput}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />

          {uploadState === "uploading" ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" />
              Parsing package…
            </span>
          ) : uploadState === "success" ? (
            <span className="text-sm text-emerald-700 dark:text-emerald-400">
              Fields populated from package. You can still edit them below.
            </span>
          ) : (
            <>
              <UploadIcon className="size-5 text-muted-foreground/60" aria-hidden="true" />
              <span className="text-sm text-muted-foreground">
                Drop a <code className="rounded bg-muted px-1 py-0.5 text-xs">.json</code> file here or{" "}
                <span className="font-medium text-foreground underline-offset-2 hover:underline">
                  browse
                </span>
              </span>
            </>
          )}
        </div>

        {/* Upload errors */}
        {uploadState === "error" && uploadErrorMessage && (
          <p className="text-xs text-destructive" role="alert">
            {uploadErrorMessage}
          </p>
        )}
        {uploadState === "error" && uploadFieldErrors.length > 0 && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <p className="mb-1 font-semibold">Package validation errors:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {uploadFieldErrors.map((fe, i) => (
                <li key={i}>
                  {fe.field ? (
                    <><span className="font-medium">{fe.field}</span>: {fe.message}</>
                  ) : (
                    fe.message
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          or fill manually
        </span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Field 1 — Topic (existing, unchanged)                               */}
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
          disabled={disabled}
          maxLength={200}
          autoFocus
        />
        <p id={`${topicId}-hint`} className="sr-only">
          Short, descriptive topic name. Required.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Field 2 — Research Question (existing, unchanged)                   */}
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
          disabled={disabled}
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
      {/* P3-02: 7 manual parameter fields                                    */}
      {/* ------------------------------------------------------------------ */}

      {/* --- 1. Sensitivity Profile --- */}
      <div className="flex flex-col gap-3">
        <FieldLabel
          id={sensitivityLabelId}
          label="Sensitivity Profile"
          hint="Controls routing constraints and prompt caveats."
        />
        <RadioGroup<SensitivityProfile>
          name="sensitivity_profile"
          value={package_fields.sensitivity_profile as SensitivityProfile}
          onChange={(v) => setField("sensitivity_profile", v)}
          disabled={disabled}
          labelledby={sensitivityLabelId}
          options={[
            { value: "public", label: "Public" },
            { value: "internal", label: "Internal" },
            { value: "confidential", label: "Confidential" },
          ]}
        />
      </div>

      {/* --- 2. Task Type --- */}
      <div className="flex flex-col gap-2">
        <FieldLabel
          htmlFor={taskTypeId}
          label="Task Type"
          hint="Optional task-type hint for routing. The analyser uses this to produce task-specific prompt framing."
        />
        <Input
          id={taskTypeId}
          type="text"
          placeholder="e.g. comparative analysis"
          value={package_fields.task_type as string}
          onChange={(e) => setField("task_type", e.target.value)}
          disabled={disabled}
          maxLength={200}
        />
      </div>

      {/* --- 3. Audience --- */}
      <div className="flex flex-col gap-2">
        <FieldLabel
          htmlFor={audienceId}
          label="Audience"
          hint="Target audience for the generated output. Shapes the prompt style."
        />
        <Input
          id={audienceId}
          type="text"
          placeholder="e.g. engineering, executive, academic"
          value={package_fields.audience as string}
          onChange={(e) => setField("audience", e.target.value)}
          disabled={disabled}
          maxLength={200}
        />
      </div>

      {/* --- 4. Output Artifact Type --- */}
      <div className="flex flex-col gap-2">
        <FieldLabel
          htmlFor={desiredOutputId}
          label="Output Artifact Type"
          hint="Target artifact type produced after the run completes."
        />
        <Select
          value={package_fields.desired_output as string}
          onValueChange={(v) => setField("desired_output", v as typeof package_fields["desired_output"])}
          disabled={disabled}
        >
          <SelectTrigger id={desiredOutputId} className="w-full">
            <SelectValue placeholder="Select output type" />
          </SelectTrigger>
          <SelectContent>
            {DESIRED_OUTPUT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* --- 5. Time Profile --- */}
      <div className="flex flex-col gap-3">
        <FieldLabel
          id={timeProfileLabelId}
          label="Time Profile"
          hint="Influences freshness weighting in the routing analyser."
        />
        <TripleToggle<TimeProfile>
          name="Time Profile"
          value={package_fields.time_profile as TimeProfile}
          onChange={(v) => setField("time_profile", v)}
          disabled={disabled}
          options={[
            { value: "urgent", label: "Urgent" },
            { value: "standard", label: "Standard" },
            { value: "deep", label: "Deep" },
          ]}
        />
      </div>

      {/* --- 6. Cost Sensitivity --- */}
      <div className="flex flex-col gap-3">
        <FieldLabel
          id={costSensLabelId}
          label="Cost Sensitivity"
          hint="Operator tolerance for per-run token cost."
        />
        <TripleToggle<CostSensitivity>
          name="Cost Sensitivity"
          value={package_fields.cost_sensitivity as CostSensitivity}
          onChange={(v) => setField("cost_sensitivity", v)}
          disabled={disabled}
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
        />
      </div>

      {/* --- 7. Reuse Likelihood --- */}
      <div className="flex flex-col gap-3">
        <FieldLabel
          id={reuseLabelId}
          label="Reuse Likelihood"
          hint="Estimated likelihood this package will be reused or extended."
        />
        <TripleToggle<ReuseLikelihood>
          name="Reuse Likelihood"
          value={package_fields.reuse_likelihood as ReuseLikelihood}
          onChange={(v) => setField("reuse_likelihood", v)}
          disabled={disabled}
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ]}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Field 3 — Corpus (existing, unchanged)                              */}
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
                    disabled && "pointer-events-none opacity-50",
                  )}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      handleCorpusToggle(opt.slug, checked === true)
                    }
                    disabled={disabled}
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
      {/* Field 4 — Domain (existing, unchanged)                              */}
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
                disabled={disabled}
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
      {/* P3-03: Methodology Note                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <FieldLabel
          htmlFor={methodologyId}
          label="Methodology Note"
          hint="Optional background context or methodological constraints for this research run."
        />
        <textarea
          id={methodologyId}
          rows={3}
          placeholder="e.g. Focus on peer-reviewed sources only; exclude grey literature. Prioritise 2022–2024 publication dates."
          value={package_fields.background as string}
          onChange={(e) => setField("background", e.target.value)}
          disabled={disabled}
          maxLength={4000}
          className={cn(
            "flex w-full resize-y rounded-md border border-input bg-background px-3 py-2",
            "text-sm ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[80px]",
          )}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* P3-03: JSON Editor Toggle                                           */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleToggleJsonEditor}
          disabled={disabled}
          aria-expanded={jsonEditorOpen}
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-md border border-border",
            "bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground",
            "transition-all duration-150 hover:border-foreground/25 hover:bg-accent/30 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <CodeIcon className="size-3.5" aria-hidden="true" />
          {jsonEditorOpen ? "Close JSON Editor" : "Open JSON Editor"}
        </button>

        {jsonEditorOpen && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">
              Edit the package as JSON. Changes sync back to form fields on blur.
            </p>
            <textarea
              rows={14}
              value={jsonEditorValue}
              onChange={handleJsonEditorChange}
              onBlur={handleJsonEditorBlur}
              spellCheck={false}
              aria-label="JSON package editor"
              aria-describedby={jsonParseError ? "json-editor-error" : undefined}
              disabled={disabled}
              className={cn(
                "flex w-full resize-y rounded-md border bg-background px-3 py-2",
                "font-mono text-xs ring-offset-background",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "min-h-[200px]",
                jsonParseError
                  ? "border-destructive/60"
                  : "border-input",
              )}
            />
            {jsonParseError && (
              <p
                id="json-editor-error"
                className="text-xs text-destructive"
                role="alert"
              >
                Invalid JSON — fix syntax errors before leaving the editor to sync.
              </p>
            )}
          </div>
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
// Inline icons — avoids adding icon library dependencies
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

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
