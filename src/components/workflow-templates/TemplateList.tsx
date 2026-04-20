"use client";

/**
 * TemplateList — table of workflow templates with create / edit / delete actions.
 *
 * Displays both system templates (read-only badge) and custom templates
 * (edit + delete buttons). Uses the useWorkflowTemplates hook for data and
 * lazy-mounts TemplateEditorDialog / DeleteTemplateDialog on demand.
 *
 * Layout: responsive table on md+; card stack on xs–sm.
 *
 * Accessibility:
 *   - Table has <caption> for screen readers
 *   - Action buttons have aria-label with template name
 *   - Loading state uses aria-busy + visually-hidden text
 *
 * Traces FR-1.5-09 / P1.5-2-05.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useWorkflowTemplates } from "@/hooks/useWorkflowTemplates";
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { DeleteTemplateDialog } from "./DeleteTemplateDialog";
import type { WorkflowTemplate } from "@/lib/api/workflow-templates";

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function SystemBadge() {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        "border-muted-foreground/20 bg-muted text-muted-foreground",
      )}
    >
      system
    </span>
  );
}

function CustomBadge() {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        "border-primary/20 bg-primary/10 text-primary",
      )}
    >
      custom
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty / loading / error states
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div aria-busy="true" className="flex flex-col gap-2 py-8">
      <span className="sr-only">Loading templates…</span>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-md bg-muted"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3",
        "flex items-start gap-2",
      )}
    >
      <svg
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-destructive"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-destructive">Failed to load templates</p>
        <p className="text-xs text-destructive/80">{message}</p>
      </div>
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
      <svg
        aria-hidden="true"
        className="size-10 text-muted-foreground/40"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
      <div>
        <p className="text-sm font-medium">No templates yet</p>
        <p className="text-xs text-muted-foreground">
          Create a custom template to extend the workflow library.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreateClick}
        className={cn(
          "inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground",
          "transition-colors hover:bg-primary/90",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Create first template
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

interface TemplateRowActionsProps {
  template: WorkflowTemplate;
  onEdit: (t: WorkflowTemplate) => void;
  onDelete: (t: WorkflowTemplate) => void;
}

function TemplateRowActions({ template, onEdit, onDelete }: TemplateRowActionsProps) {
  if (template.system) return null;
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        aria-label={`Edit ${template.label || template.slug}`}
        onClick={() => onEdit(template)}
        className={cn(
          "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium",
          "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Edit
      </button>
      <button
        type="button"
        aria-label={`Delete ${template.label || template.slug}`}
        onClick={() => onDelete(template)}
        className={cn(
          "inline-flex h-7 items-center rounded-md border border-destructive/30 px-2.5 text-xs font-medium",
          "text-destructive transition-colors hover:bg-destructive/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Delete
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TemplateList() {
  const { templates, isLoading, error } = useWorkflowTemplates();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkflowTemplate | null>(null);

  function handleCreate() {
    setSelectedTemplate(null);
    setEditorMode("create");
    setEditorOpen(true);
  }

  function handleEdit(template: WorkflowTemplate) {
    setSelectedTemplate(template);
    setEditorMode("edit");
    setEditorOpen(true);
  }

  function handleDelete(template: WorkflowTemplate) {
    setDeleteTarget(template);
    setDeleteOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Loading templates…"
            : `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
        </p>
        <button
          type="button"
          onClick={handleCreate}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground",
            "transition-colors hover:bg-primary/90",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New template
        </button>
      </div>

      {/* Content */}
      {isLoading && <LoadingState />}
      {!isLoading && error && <ErrorState message={error} />}
      {!isLoading && !error && templates.length === 0 && (
        <EmptyState onCreateClick={handleCreate} />
      )}

      {/* Table — hidden on mobile, shown md+ */}
      {!isLoading && !error && templates.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Workflow templates</caption>
              <thead>
                <tr className="border-b bg-muted/40">
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Slug
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t, idx) => (
                  <tr
                    key={t.id}
                    className={cn(
                      idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                      "transition-colors hover:bg-accent/30",
                    )}
                  >
                    <td className="px-4 py-3 font-medium">
                      {t.label || t.slug}
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-1 py-0.5 text-xs">{t.slug}</code>
                    </td>
                    <td className="px-4 py-3">
                      {t.system ? <SystemBadge /> : <CustomBadge />}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-muted-foreground">
                      {t.description ?? (
                        <span className="italic text-muted-foreground/60">No description</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TemplateRowActions
                        template={t}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="flex flex-col gap-3 md:hidden" aria-label="Workflow templates">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-2 rounded-md border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{t.label || t.slug}</span>
                    <code className="text-xs text-muted-foreground">{t.slug}</code>
                  </div>
                  {t.system ? <SystemBadge /> : <CustomBadge />}
                </div>
                {t.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                )}
                {!t.system && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      aria-label={`Edit ${t.label || t.slug}`}
                      onClick={() => handleEdit(t)}
                      className={cn(
                        "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium",
                        "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${t.label || t.slug}`}
                      onClick={() => handleDelete(t)}
                      className={cn(
                        "inline-flex h-8 items-center rounded-md border border-destructive/30 px-3 text-xs font-medium",
                        "text-destructive transition-colors hover:bg-destructive/10",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Editor dialog */}
      <TemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={selectedTemplate}
        mode={editorMode}
        onSuccess={() => {
          // Query invalidation handled by mutation hook
        }}
      />

      {/* Delete confirm dialog */}
      <DeleteTemplateDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        template={deleteTarget}
        onSuccess={() => setDeleteTarget(null)}
      />
    </div>
  );
}
