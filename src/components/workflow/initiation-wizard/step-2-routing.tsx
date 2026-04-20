"use client";

/**
 * Step2Routing — Routing confirmation for the Initiation Wizard.
 *
 * Stitch reference: workflow-initiation-step-2-routing.html
 *
 * Displays:
 *   1. RoutingRecommendationCard — when an artifact is in context (optional).
 *      If no artifact context is available, the card section is skipped and
 *      the user goes directly to the template dropdown.
 *   2. Template dropdown — populated from GET /api/workflow-templates.
 *      When a routing recommendation fires onStart(), the dropdown is
 *      pre-selected to the recommended template.
 *   3. Selected template description + metadata summary.
 *
 * The user can accept the recommendation or override via the dropdown.
 */

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { RoutingRecommendationCard } from "@/components/artifact/routing-recommendation-card";
import type { WorkflowTemplate } from "@/lib/api/workflow-templates";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface Step2RoutingProps {
  /** Optional artifact ID — renders RoutingRecommendationCard when provided. */
  artifactId?: string;
  /** Available templates from GET /api/workflow-templates. */
  templates: WorkflowTemplate[];
  /** Currently selected template ID. */
  selectedTemplateId: string | null;
  /** Called when the user selects a template (via card or dropdown). */
  onSelectTemplate: (templateId: string) => void;
  /** Loading state for templates list. */
  isLoadingTemplates: boolean;
  /** Error fetching templates. */
  templatesError: string | null;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function TemplateDropdown({
  templates,
  selectedId,
  onChange,
  disabled,
}: {
  templates: WorkflowTemplate[];
  selectedId: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor="template-select"
        className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Workflow Template
      </label>
      <div className="relative">
        <select
          id="template-select"
          value={selectedId ?? ""}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          disabled={disabled}
          aria-label="Select workflow template"
          className={cn(
            "w-full appearance-none rounded-md border border-input bg-background px-4 py-2.5 pr-8 text-sm",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <option value="" disabled>
            {disabled ? "Loading templates…" : "Select a template"}
          </option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.label}
              {tpl.system ? " (system)" : ""}
            </option>
          ))}
        </select>
        {/* Chevron icon */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center"
        >
          <svg className="size-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function SelectedTemplateSummary({ template }: { template: WorkflowTemplate }) {
  const paramCount = template.params.length;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">{template.label}</h4>
          {template.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
          )}
        </div>
        {template.system && (
          <span className="shrink-0 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            system
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Slug: <code className="font-mono text-foreground/70">{template.slug}</code>
        </span>
        <span>
          Parameters: <strong className="text-foreground">{paramCount}</strong>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step2Routing
// ---------------------------------------------------------------------------

export function Step2Routing({
  artifactId,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  isLoadingTemplates,
  templatesError,
}: Step2RoutingProps) {
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // Auto-select first template if nothing is selected and templates loaded.
  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      onSelectTemplate(templates[0].id);
    }
  }, [selectedTemplateId, templates, onSelectTemplate]);

  return (
    <div className="flex flex-col gap-6">
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold tracking-tight">Routing Confirmation</h2>
        <p className="mt-1 text-sm text-muted-foreground italic">
          Review the recommended workflow template or select an alternative.
        </p>
      </div>

      {/* Routing Recommendation Card — only when artifact context exists */}
      {artifactId && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recommendation
          </p>
          <RoutingRecommendationCard
            artifactId={artifactId}
            onStart={(templateSlug) => {
              // Find the template by slug and select it.
              const tpl = templates.find((t) => t.slug === templateSlug);
              if (tpl) onSelectTemplate(tpl.id);
            }}
          />
        </div>
      )}

      {/* Divider when recommendation card shown */}
      {artifactId && (
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or choose manually</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* Template selector */}
      {templatesError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          Failed to load templates: {templatesError}
        </div>
      ) : (
        <TemplateDropdown
          templates={templates}
          selectedId={selectedTemplateId}
          onChange={onSelectTemplate}
          disabled={isLoadingTemplates}
        />
      )}

      {/* Selected template summary */}
      {selectedTemplate && <SelectedTemplateSummary template={selectedTemplate} />}
    </div>
  );
}
