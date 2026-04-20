/**
 * Workflow Templates API — typed wrappers for GET /api/workflow-templates.
 *
 * Stitch reference: workflow-initiation-step-2-routing + step-3-configure.
 * Traces FR-1.5-06 / P1.5-2-03.
 *
 * Backend: meatywiki/portal/api/workflow_templates.py (P1.5-2-04).
 * WorkflowTemplateDTO fields: id, slug, yaml_content, description, system,
 *   created_at, updated_at.
 *
 * Param schema is extracted from the YAML body at read time.
 */

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Template types
// ---------------------------------------------------------------------------

/**
 * Parameter descriptor extracted from a template's YAML params block.
 */
export interface TemplateParam {
  name: string;
  type: "string" | "number" | "boolean" | "enum";
  label: string;
  description?: string;
  default?: string | number | boolean;
  /** Only populated when type === "enum" */
  options?: string[];
  required?: boolean;
}

/**
 * Parsed representation of a workflow template returned by the API.
 * `params` is derived by parsing `yaml_content`.
 */
export interface WorkflowTemplate {
  id: string;
  slug: string;
  description: string | null;
  system: boolean;
  created_at: string;
  updated_at: string;
  /** Raw YAML string from backend. */
  yaml_content: string;
  /** Parsed parameter descriptors from the YAML `params:` block. */
  params: TemplateParam[];
  /** Human-readable label derived from slug when not in yaml metadata. */
  label: string;
}

/**
 * Raw DTO shape returned by the backend (mirrors WorkflowTemplateResponse).
 */
interface WorkflowTemplateDTO {
  id: string;
  slug: string;
  yaml_content: string;
  description: string | null;
  system: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// YAML parsing — minimal param extraction without a full YAML dependency
// ---------------------------------------------------------------------------

/**
 * Extract parameter descriptors from template YAML content.
 *
 * Looks for a top-level `params:` block. Each param entry supports:
 *   name, type, label, description, default, options, required.
 *
 * Falls back gracefully to [] if YAML is unparseable or no params block.
 *
 * NOTE: This uses a lightweight line-oriented parser, not a full YAML parser,
 * to avoid adding a heavy dependency to the client bundle.
 */
function extractParams(yaml: string): TemplateParam[] {
  try {
    const lines = yaml.split("\n");
    const inParams = false;
    const params: TemplateParam[] = [];

    // Find a simple key: value pattern under a `params:` block.
    // Real templates have a `params:` section with nested entries.
    // We do a conservative regex scan for common param-like keys.
    let currentParam: Partial<TemplateParam> | null = null;
    let inParamsSection = inParams;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === "params:") {
        inParamsSection = true;
        continue;
      }

      // A new top-level key ends the params section
      if (inParamsSection && /^[a-z_]+:\s*$/.test(trimmed) && trimmed !== "params:") {
        inParamsSection = false;
        if (currentParam?.name) params.push(currentParam as TemplateParam);
        currentParam = null;
      }

      if (!inParamsSection) continue;

      // New param entry (list item)
      if (trimmed.startsWith("- name:")) {
        if (currentParam?.name) params.push(currentParam as TemplateParam);
        currentParam = { name: trimmed.replace("- name:", "").trim(), type: "string", label: "", required: false };
        continue;
      }

      if (currentParam) {
        const match = trimmed.match(/^(\w+):\s*(.*)$/);
        if (match) {
          const [, key, value] = match;
          switch (key) {
            case "type":
              currentParam.type = (value as TemplateParam["type"]) || "string";
              break;
            case "label":
              currentParam.label = value;
              break;
            case "description":
              currentParam.description = value;
              break;
            case "default":
              currentParam.default = value === "true" ? true : value === "false" ? false : value;
              break;
            case "required":
              currentParam.required = value === "true";
              break;
          }
        }
        // Options list items
        if (trimmed.startsWith("- ") && currentParam.type === "enum") {
          currentParam.options = [...(currentParam.options ?? []), trimmed.slice(2)];
        }
      }
    }

    if (currentParam?.name) params.push(currentParam as TemplateParam);
    return params;
  } catch {
    return [];
  }
}

/**
 * Derive a human-readable label from a slug.
 * e.g. "research_synthesis_v1" → "Research Synthesis V1"
 */
function slugToLabel(slug: string): string {
  return slug
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function dtoToTemplate(dto: WorkflowTemplateDTO): WorkflowTemplate {
  const params = extractParams(dto.yaml_content);
  // Try to get label from YAML metadata, else derive from slug.
  const labelMatch = dto.yaml_content.match(/^label:\s*(.+)$/m);
  const label = labelMatch ? labelMatch[1].trim() : slugToLabel(dto.slug);
  return {
    ...dto,
    params,
    label,
  };
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export interface ListTemplatesParams {
  scope?: "all" | "custom" | "system";
}

export interface ListTemplatesResponse {
  data: WorkflowTemplateDTO[];
  cursor?: string | null;
}

/**
 * GET /api/workflow-templates
 *
 * Returns all workflow templates. Use `scope` to filter by system vs custom.
 */
export async function listWorkflowTemplates(
  params: ListTemplatesParams = {},
): Promise<WorkflowTemplate[]> {
  const qs = params.scope ? `?scope=${params.scope}` : "";
  const resp = await apiFetch<ListTemplatesResponse>(`/workflow-templates${qs}`);
  return (resp.data ?? []).map(dtoToTemplate);
}

/**
 * GET /api/workflow-templates/:id
 *
 * Returns a single template by ID.
 */
export async function getWorkflowTemplate(id: string): Promise<WorkflowTemplate> {
  const resp = await apiFetch<{ data: WorkflowTemplateDTO }>(`/workflow-templates/${id}`);
  return dtoToTemplate(resp.data);
}

// ---------------------------------------------------------------------------
// Workflow creation
// ---------------------------------------------------------------------------

export interface SourceSelection {
  type: "all_library" | "recent_drafts" | "selected_artifacts";
  artifact_ids?: string[];
  scope?: string;
}

export interface CreateWorkflowRequest {
  template_id: string;
  params: Record<string, string | number | boolean>;
  source_selection: SourceSelection;
}

export interface CreateWorkflowResponse {
  run_id: string;
  status: "queued";
  created_at: string;
}

/**
 * POST /api/workflows
 *
 * Creates a new workflow run from a template and source selection.
 * Returns 202 Accepted with the new run_id.
 */
export async function createWorkflow(
  req: CreateWorkflowRequest,
): Promise<CreateWorkflowResponse> {
  return apiFetch<CreateWorkflowResponse>("/workflows", {
    method: "POST",
    body: JSON.stringify(req),
  });
}
