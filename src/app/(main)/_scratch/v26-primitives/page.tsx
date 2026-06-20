"use client";

/**
 * P2-04 scratch isolation route — v26-primitives
 *
 * Renders all three Portal v2.6 P2 primitives with sample data to satisfy
 * the P2 "render in isolation" exit criterion:
 *
 *   1. ArtifactPeekModal  — via useArtifactPeek().openPeek() for a sample ID
 *   2. ArtifactSearchDialog — both single and multi mode
 *   3. Field editors (inline-edit/fields):
 *        • TagEditorField
 *        • ProjectComboboxField
 *        • OptionSelectField (status, workspace, freshness_class)
 *
 * This route is NEVER linked from any production surface. It lives under
 * `_scratch/` (Next.js route-group prefix convention for dev-only routes)
 * and should be excluded from production sitemaps / navigation.
 *
 * All primitives are rendered with no-op save handlers so no backend
 * requests are made. TagEditorField and ProjectComboboxField do call their
 * respective useFieldOptions hooks; those will 401/fail gracefully when the
 * backend is down.
 *
 * TS strict, no `any`.
 */

import React, { useState, useCallback } from "react";
import {
  FlaskConical,
  Eye,
  Search,
  Tag,
  FolderOpen,
  ListFilter,
  ChevronRight,
} from "lucide-react";

import { useArtifactPeek } from "@/components/artifact/ArtifactPeekProvider";
import { ArtifactSearchDialog } from "@/components/search/ArtifactSearchDialog";
import {
  TagEditorField,
  ProjectComboboxField,
  OptionSelectField,
} from "@/components/inline-edit/fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ArtifactCard } from "@/types/artifact";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

/**
 * A representative artifact ID from the llm-wiki vault.
 * This is the intent root "AI Platform Strategy" — likely to exist on the
 * connected node. The peek modal gracefully shows "not found" if absent.
 */
const SAMPLE_ARTIFACT_ID = "intent--ai-platform-strategy";

/** Stable sample tags for the TagEditorField demo. */
const SAMPLE_TAGS_INITIAL = ["llm", "knowledge-management", "portal"];

/** Stable sample status for OptionSelectField. */
const SAMPLE_STATUS = "active";
const SAMPLE_WORKSPACE = "library";
const SAMPLE_FRESHNESS = "current";

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  badge?: string;
}

function Section({ icon, title, subtitle, children, badge }: SectionProps) {
  return (
    <section className="rounded-xl border border-border/60 bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {badge && (
              <Badge variant="outline" className="text-[10px] font-normal">
                {badge}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {/* Body */}
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Field row helper
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
}

function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-x-4 gap-y-1">
      <span className="pt-2.5 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — ArtifactPeekModal
// ---------------------------------------------------------------------------

function PeekModalSection() {
  const { openPeek } = useArtifactPeek();

  return (
    <Section
      icon={<Eye className="h-4 w-4" />}
      title="ArtifactPeekModal"
      subtitle="Lightweight peek overlay. Opens via useArtifactPeek().openPeek(id) and deep-links via ?peek=<id>."
      badge="P2-01"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          onClick={() => openPeek(SAMPLE_ARTIFACT_ID)}
          className="gap-2"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Open peek for sample artifact
        </Button>

        <span className="text-xs text-muted-foreground">
          ID:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            {SAMPLE_ARTIFACT_ID}
          </code>
        </span>

        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          Or navigate to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
            ?peek={SAMPLE_ARTIFACT_ID}
          </code>{" "}
          to test deep-link
        </span>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — ArtifactSearchDialog (single + multi)
// ---------------------------------------------------------------------------

function SearchDialogSection() {
  const [singleOpen, setSingleOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [singleResult, setSingleResult] = useState<ArtifactCard | null>(null);
  const [multiResults, setMultiResults] = useState<ArtifactCard[]>([]);

  const handleSingleSelect = useCallback((artifacts: ArtifactCard[]) => {
    setSingleResult(artifacts[0] ?? null);
  }, []);

  const handleMultiSelect = useCallback((artifacts: ArtifactCard[]) => {
    setMultiResults(artifacts);
  }, []);

  return (
    <Section
      icon={<Search className="h-4 w-4" />}
      title="ArtifactSearchDialog"
      subtitle="Full-text + semantic search dialog. Single mode auto-closes on select; multi mode accumulates selections."
      badge="P2-02"
    >
      <div className="flex flex-col gap-6">
        {/* Single mode */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-foreground">Single mode</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSingleOpen(true)}
              className="gap-2"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Open single picker
            </Button>
            {singleResult && (
              <span className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/50 px-3 py-1.5 text-xs">
                Selected:{" "}
                <span className="font-medium text-foreground">
                  {singleResult.title}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px]"
                >
                  {singleResult.type}
                </Badge>
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/40" />

        {/* Multi mode */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-foreground">Multi mode</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMultiOpen(true)}
              className="gap-2"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Open multi picker
            </Button>
            {multiResults.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {multiResults.length} selected:
                </span>
                {multiResults.map((a) => (
                  <Badge key={a.id} variant="secondary" className="text-[10px]">
                    {a.title}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs (rendered outside the visual flow) */}
      <ArtifactSearchDialog
        open={singleOpen}
        onOpenChange={setSingleOpen}
        onSelect={handleSingleSelect}
        mode="single"
        title="Select artifact (single)"
      />
      <ArtifactSearchDialog
        open={multiOpen}
        onOpenChange={setMultiOpen}
        onSelect={handleMultiSelect}
        mode="multi"
        title="Select artifacts (multi)"
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Field editors (inline-edit/fields)
// ---------------------------------------------------------------------------

function FieldEditorsSection() {
  const [tags, setTags] = useState<string[]>(SAMPLE_TAGS_INITIAL);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState(SAMPLE_STATUS);
  const [workspace, setWorkspace] = useState(SAMPLE_WORKSPACE);
  const [freshness, setFreshness] = useState(SAMPLE_FRESHNESS);

  // No-op save handlers — log to console for observability in isolation.
  const handleTagSave = useCallback(
    async (add: string[], remove: string[]): Promise<void> => {
      console.log("[scratch] TagEditorField save:", { add, remove });
      // Optimistic state already applied by the field; simulate success.
      await Promise.resolve();
      // Sync local state to reflect the diff (mirrors what ArtifactDetailClient would do).
      setTags((prev) => {
        const next = [...prev.filter((t) => !remove.includes(t)), ...add];
        return [...new Set(next)];
      });
    },
    [],
  );

  const handleProjectSave = useCallback(
    async (id: string): Promise<void> => {
      console.log("[scratch] ProjectComboboxField save:", id);
      await Promise.resolve();
      setProjectId(id || null);
    },
    [],
  );

  const makeScalarSave = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string>>, field: string) =>
      async (value: string): Promise<void> => {
        console.log(`[scratch] OptionSelectField(${field}) save:`, value);
        await Promise.resolve();
        setter(value);
      },
    [],
  );

  return (
    <Section
      icon={<ListFilter className="h-4 w-4" />}
      title="Inline-edit field editors"
      subtitle="P2-03 field editors with optimistic state, save callbacks, and rollback on rejection."
      badge="P2-03"
    >
      <div className="flex flex-col gap-5">
        {/* TagEditorField */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground">
              TagEditorField
            </span>
            <span className="text-[10px] text-muted-foreground">
              — type to filter existing tags or create new
            </span>
          </div>
          <TagEditorField
            currentTags={tags}
            onSave={handleTagSave}
            label="Tags"
            placeholder="Add tag…"
          />
        </div>

        <div className="border-t border-border/40" />

        {/* ProjectComboboxField */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground">
              ProjectComboboxField
            </span>
            <span className="text-[10px] text-muted-foreground">
              — searchable combobox bound to /api/field-options/projects
            </span>
          </div>
          <div className="max-w-sm">
            <ProjectComboboxField
              currentProjectId={projectId}
              onSave={handleProjectSave}
              label="Project"
            />
          </div>
          {projectId && (
            <p className="text-[10px] text-muted-foreground">
              Selected project ID:{" "}
              <code className="font-mono">{projectId}</code>
            </p>
          )}
        </div>

        <div className="border-t border-border/40" />

        {/* OptionSelectField — three variants */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1.5">
            <ListFilter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium text-foreground">
              OptionSelectField
            </span>
            <span className="text-[10px] text-muted-foreground">
              — GroupedSelect for enum-valued fields
            </span>
          </div>

          <div className={cn("grid gap-4", "sm:grid-cols-3")}>
            <FieldRow label="status">
              <OptionSelectField
                field="status"
                value={status}
                onSave={makeScalarSave(setStatus, "status")}
              />
            </FieldRow>

            <FieldRow label="workspace">
              <OptionSelectField
                field="workspace"
                value={workspace}
                onSave={makeScalarSave(setWorkspace, "workspace")}
              />
            </FieldRow>

            <FieldRow label="freshness_class">
              <OptionSelectField
                field="freshness_class"
                value={freshness}
                onSave={makeScalarSave(setFreshness, "freshness_class")}
              />
            </FieldRow>
          </div>

          {/* Live value readout */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className="gap-1 text-[10px]">
              <span className="text-muted-foreground">status:</span> {status}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <span className="text-muted-foreground">workspace:</span>{" "}
              {workspace}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px]">
              <span className="text-muted-foreground">freshness:</span>{" "}
              {freshness}
            </Badge>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function V26PrimitivesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      {/* Page header */}
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
          <FlaskConical
            className="h-4.5 w-4.5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <div>
          <h1 className="text-base font-semibold text-foreground">
            v2.6 Primitive Isolation
          </h1>
          <p className="text-xs text-muted-foreground">
            P2-04 scratch route — render-in-isolation exit criterion for ArtifactPeekModal,
            ArtifactSearchDialog, and inline-edit field editors.
          </p>
        </div>
        <Badge
          variant="outline"
          className="ml-auto shrink-0 text-[10px] text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30"
        >
          dev-only
        </Badge>
      </div>

      {/* Sections */}
      <PeekModalSection />
      <SearchDialogSection />
      <FieldEditorsSection />
    </div>
  );
}
