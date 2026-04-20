"use client";

/**
 * Step3Configure — Template parameter configuration for the Initiation Wizard.
 *
 * Stitch reference: workflow-initiation-step-3-configure.html
 *
 * Renders parameter inputs for the selected workflow template.
 * Supported param types: string | number | boolean | enum.
 *
 * Shows a "Final Summary" panel (Stitch-matched) alongside the param form,
 * including: selected template, source scope, and param count.
 *
 * On submit the parent wizard handles POSTing to /api/workflows.
 */

import { cn } from "@/lib/utils";
import type { WorkflowTemplate, TemplateParam, SourceSelection } from "@/lib/api/workflow-templates";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface Step3ConfigureProps {
  template: WorkflowTemplate;
  sourceSelection: SourceSelection;
  params: Record<string, string | number | boolean>;
  onChange: (name: string, value: string | number | boolean) => void;
  /** Submission error message to display inline. */
  submitError?: string | null;
}

// ---------------------------------------------------------------------------
// Param input components
// ---------------------------------------------------------------------------

function StringInput({
  param,
  value,
  onChange,
}: {
  param: TemplateParam;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      id={`param-${param.name}`}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={param.default !== undefined ? String(param.default) : `Enter ${param.label}`}
      required={param.required}
      aria-describedby={param.description ? `param-${param.name}-desc` : undefined}
      className={cn(
        "w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "placeholder:text-muted-foreground",
      )}
    />
  );
}

function NumberInput({
  param,
  value,
  onChange,
}: {
  param: TemplateParam;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      id={`param-${param.name}`}
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      placeholder={param.default !== undefined ? String(param.default) : undefined}
      required={param.required}
      aria-describedby={param.description ? `param-${param.name}-desc` : undefined}
      className={cn(
        "w-full rounded-md border border-input bg-background px-4 py-2.5 text-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
      )}
    />
  );
}

function BooleanInput({
  param,
  value,
  onChange,
}: {
  param: TemplateParam;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={`param-${param.name}`}
      className="flex cursor-pointer items-center gap-3"
    >
      <input
        id={`param-${param.name}`}
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={param.description ? `param-${param.name}-desc` : undefined}
        className="size-4 rounded border-input text-foreground focus:ring-ring"
      />
      <span className="text-sm text-muted-foreground">Enable {param.label}</span>
    </label>
  );
}

function EnumInput({
  param,
  value,
  onChange,
}: {
  param: TemplateParam;
  value: string;
  onChange: (v: string) => void;
}) {
  const options = param.options ?? [];
  return (
    <div className="relative">
      <select
        id={`param-${param.name}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={param.required}
        aria-describedby={param.description ? `param-${param.name}-desc` : undefined}
        className={cn(
          "w-full appearance-none rounded-md border border-input bg-background px-4 py-2.5 pr-8 text-sm",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        {!param.required && <option value="">— Select —</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg className="size-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

function ParamField({
  param,
  value,
  onChange,
}: {
  param: TemplateParam;
  value: string | number | boolean;
  onChange: (name: string, v: string | number | boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      {/* Label — skip for boolean (rendered inline with the checkbox) */}
      {param.type !== "boolean" && (
        <label
          htmlFor={`param-${param.name}`}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {param.label || param.name}
          {param.required && (
            <span aria-hidden="true" className="text-destructive">*</span>
          )}
          {param.required && <span className="sr-only">(required)</span>}
        </label>
      )}

      {/* Input */}
      {param.type === "string" && (
        <StringInput param={param} value={String(value ?? "")} onChange={(v) => onChange(param.name, v)} />
      )}
      {param.type === "number" && (
        <NumberInput param={param} value={Number(value ?? 0)} onChange={(v) => onChange(param.name, v)} />
      )}
      {param.type === "boolean" && (
        <BooleanInput param={param} value={Boolean(value)} onChange={(v) => onChange(param.name, v)} />
      )}
      {param.type === "enum" && (
        <EnumInput param={param} value={String(value ?? "")} onChange={(v) => onChange(param.name, v)} />
      )}

      {/* Description */}
      {param.description && (
        <p
          id={`param-${param.name}-desc`}
          className="text-xs text-muted-foreground leading-relaxed"
        >
          {param.description}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source scope label
// ---------------------------------------------------------------------------

function sourceScopeLabel(sel: SourceSelection): string {
  switch (sel.type) {
    case "all_library":
      return "All Library";
    case "recent_drafts":
      return "Recent Drafts (7 days)";
    case "selected_artifacts":
      return `Selected Artifacts${sel.artifact_ids?.length ? ` (${sel.artifact_ids.length})` : ""}`;
    default:
      return sel.type;
  }
}

// ---------------------------------------------------------------------------
// Summary sidebar
// ---------------------------------------------------------------------------

function ParameterSummary({
  template,
  sourceSelection,
  paramCount,
}: {
  template: WorkflowTemplate;
  sourceSelection: SourceSelection;
  paramCount: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-5 space-y-4">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Run Summary
      </h3>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Template</p>
          <p className="text-sm font-semibold">{template.label}</p>
          {template.description && (
            <p className="text-xs text-muted-foreground">{template.description}</p>
          )}
        </div>

        <div className="h-px bg-border" />

        <div>
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Source Scope</p>
          <p className="text-sm font-medium">{sourceScopeLabel(sourceSelection)}</p>
        </div>

        <div className="h-px bg-border" />

        <div>
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Parameters</p>
          <p className="text-sm font-medium">
            {paramCount} {paramCount === 1 ? "parameter" : "parameters"} configured
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step3Configure
// ---------------------------------------------------------------------------

export function Step3Configure({
  template,
  sourceSelection,
  params,
  onChange,
  submitError,
}: Step3ConfigureProps) {
  const hasParams = template.params.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Configure & Launch</h2>
        <p className="mt-1 text-sm text-muted-foreground italic">
          Review and set the parameters for your workflow run.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_220px]">
        {/* Parameter form */}
        <div className="space-y-5">
          {hasParams ? (
            template.params.map((param) => (
              <ParamField
                key={param.name}
                param={param}
                value={params[param.name] ?? (param.default ?? (param.type === "boolean" ? false : ""))}
                onChange={onChange}
              />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium text-muted-foreground">No parameters required</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                This template runs with default settings. Review the summary and launch.
              </p>
            </div>
          )}

          {/* Submission error */}
          {submitError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        <ParameterSummary
          template={template}
          sourceSelection={sourceSelection}
          paramCount={template.params.length}
        />
      </div>
    </div>
  );
}
