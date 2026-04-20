/**
 * Workflow Templates Settings Page — /settings/workflow-templates
 *
 * Full-page authoring UI for managing workflow templates.
 * Accessible from the Settings main page via the "Manage" button.
 *
 * Renders the TemplateList component which handles:
 *   - Listing system + custom templates
 *   - Creating new custom templates (POST /api/workflow-templates)
 *   - Editing custom templates (PATCH /api/workflow-templates/:id)
 *   - Deleting custom templates (DELETE /api/workflow-templates/:id)
 *
 * Stitch reference: none (fresh-draft — P1.5-2-05).
 * Shell: Standard Archival (Settings sub-page).
 * Traces FR-1.5-09 / P1.5-2-05.
 */

import Link from "next/link";
import { TemplateList } from "@/components/workflow-templates/TemplateList";

export default function WorkflowTemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link
          href="/settings"
          className="transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Settings
        </Link>
        <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span aria-current="page" className="text-foreground font-medium">
          Workflow Templates
        </span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflow Templates</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          View system templates and manage custom workflow templates. Custom templates
          define YAML-configured pipelines accessible from the Workflow initiation wizard.
        </p>
      </div>

      {/* Template list */}
      <TemplateList />
    </div>
  );
}
