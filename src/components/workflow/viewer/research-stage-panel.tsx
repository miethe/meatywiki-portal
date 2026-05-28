"use client";

/**
 * ResearchStagePanel — research-specific stage body panels for
 * `external_research_v1` workflow runs (portal-v2.1 P4-01–P4-03).
 *
 * Renders context-sensitive panel bodies for all stage groups:
 *   intake/assemble      → package summary card (topic, question, corpus list)
 *   analyze_routes       → route cards (venue name, score, rationale)
 *   generate_prompt_package → prompt bundle preview, copy/download
 *   export/await/upload/validate → task status, action buttons, upload form
 *   synthesis*           → synthesis status, plan artifact link, synthesized artifacts (P4-01)
 *   draft*               → format picker, Generate Drafts CTA, draft artifact links (P4-02)
 *   review* / file_back* → citation checklist, source-coverage, file-back CTA (P4-03)
 *
 * Unknown stage names return null so the parent StageContextPanel shows generic content.
 *
 * FR-V3 (portal-v2.1 research workflow realignment).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  fetchPromptPackage,
  patchExternalTask,
  uploadExternalResult,
  uploadExternalResultFile,
  enqueueSynthesis,
  enqueueDraft,
  runReviewGates,
  fileBackResearch,
  type ExternalResearchTaskRow,
  type PromptPackageResponse,
  type UploadResultResponse,
  type SynthesisEnqueueResponse,
  type DraftEnqueueResponse,
  type DraftFormat,
  type ReviewGatesResponse,
  type FileBackResponse,
} from "@/lib/api/workflow-viewer";
import type { TimelineStage } from "@/types/workflow-viewer";
import type { WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

export interface ResearchStagePanelProps {
  stage: TimelineStage;
  workflowRun: WorkflowRun;
  /** External task row — may be absent if not yet loaded by parent */
  externalTask?: ExternalResearchTaskRow | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </h4>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-x-3 text-sm">
      <dt className="font-medium text-foreground/70 shrink-0">{label}</dt>
      <dd className="font-mono text-xs text-foreground/80 break-all">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    routing_ready: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    prompt_generated: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    exported: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    waiting_external: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    result_uploaded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    validating: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    validation_passed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    validation_failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    abandoned: "bg-muted text-muted-foreground",
  };
  const cls = colours[status] ?? "bg-muted text-muted-foreground";
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function ActionButton({
  onClick,
  disabled,
  loading,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const base = cn(
    "inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-xs font-semibold",
    "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "disabled:opacity-40 disabled:cursor-not-allowed",
  );
  const variantCls =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "border border-border bg-card text-foreground hover:bg-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(base, variantCls)}
    >
      {loading && (
        <svg
          aria-hidden="true"
          className="size-3 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Panel A — collect_intent / assemble_package
// ---------------------------------------------------------------------------

function IntakePanel({ workflowRun }: { workflowRun: WorkflowRun }) {
  const meta = workflowRun.metadata ?? {};
  const topic = (meta.topic as string | undefined) ?? "(not recorded)";
  const question = (meta.research_question as string | undefined) ?? "(not recorded)";
  const domain = (meta.domain as string | undefined) ?? null;
  const corpus = (meta.corpus_artifact_ids as string[] | undefined) ?? [];
  const venue = (meta.selected_venue as string | undefined) ?? null;
  const venueScore = (meta.venue_score as number | undefined) ?? null;
  const venueRationale = (meta.venue_rationale as string | undefined) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionHeading>Package Summary</SectionHeading>
        <dl className="flex flex-col gap-1.5">
          <InfoRow label="Topic" value={topic} />
          <InfoRow label="Research Question" value={question} />
          {domain && <InfoRow label="Domain" value={domain} />}
          <InfoRow
            label="Corpus artifacts"
            value={
              corpus.length === 0 ? (
                <span className="text-muted-foreground">None attached</span>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {corpus.map((id) => (
                    <li key={id} className="font-mono text-[11px]">
                      {id}
                    </li>
                  ))}
                </ul>
              )
            }
          />
        </dl>
      </div>

      {venue && (
        <div>
          <SectionHeading>Route Decision</SectionHeading>
          <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground capitalize">{venue}</span>
              {venueScore !== null && (
                <span className="font-mono text-xs text-muted-foreground">
                  score: {venueScore.toFixed(2)}
                </span>
              )}
            </div>
            {venueRationale && (
              <p className="text-xs text-muted-foreground mt-1">{venueRationale}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel B — analyze_routes
// ---------------------------------------------------------------------------

interface RouteCard {
  route: string;
  score: number;
  rationale: string;
  prompt_preview?: string;
  expected_output?: string;
}

function RouteCardsPanel({ workflowRun }: { workflowRun: WorkflowRun }) {
  const meta = workflowRun.metadata ?? {};
  const routeCards = (meta.route_cards as RouteCard[] | undefined) ?? [];

  if (routeCards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Route analysis not yet completed or results not cached.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionHeading>Route Analysis</SectionHeading>
      <ul className="flex flex-col gap-3" aria-label="Venue route cards">
        {routeCards.map((card) => (
          <li
            key={card.route}
            className="rounded-md border border-border bg-muted/30 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold text-sm text-foreground capitalize">
                {card.route.replace(/_/g, " ")}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                  card.score >= 0.7
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : card.score >= 0.4
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {(card.score * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{card.rationale}</p>
            {card.prompt_preview && (
              <p className="mt-2 text-[11px] text-muted-foreground/70 italic line-clamp-2">
                &ldquo;{card.prompt_preview}&rdquo;
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel C — generate_prompt_package
// ---------------------------------------------------------------------------

function PromptPackagePanel({ runId }: { runId: string }) {
  const [pkg, setPkg] = useState<PromptPackageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPromptPackage(runId, "json")
      .then((data) => {
        if (!cancelled) setPkg(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load prompt package");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [runId]);

  const handleCopyJson = useCallback(() => {
    if (!pkg) return;
    void navigator.clipboard.writeText(pkg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [pkg]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!pkg) return;
    // Fetch markdown variant for download
    fetchPromptPackage(runId, "markdown")
      .then((mdPkg) => {
        const blob = new Blob([mdPkg.content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prompt-package-${runId.slice(-8)}.md`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {/* silently ignore download failure */});
  }, [runId, pkg]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <SectionHeading>Prompt Package</SectionHeading>
        <div className="h-40 animate-pulse rounded-md border border-border bg-muted/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeading>Prompt Package</SectionHeading>
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionHeading>Prompt Package</SectionHeading>
        {pkg && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyJson}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 h-7 text-xs font-medium",
                "border border-border bg-card text-foreground hover:bg-muted transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Copy prompt bundle as JSON"
            >
              {copied ? "Copied!" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 h-7 text-xs font-medium",
                "border border-border bg-card text-foreground hover:bg-muted transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Download prompt bundle as Markdown"
            >
              Download .md
            </button>
          </div>
        )}
      </div>

      {pkg ? (
        <>
          <pre
            className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] text-foreground/80 whitespace-pre-wrap break-words"
            aria-label="Prompt bundle preview"
          >
            {pkg.content.slice(0, 2000)}
            {pkg.content.length > 2000 && "\n… (truncated for display)"}
          </pre>
          {pkg.package_artifact_id && (
            <p className="text-xs text-muted-foreground">
              Package artifact:{" "}
              <span className="font-mono">{pkg.package_artifact_id}</span>
            </p>
          )}
          {pkg.exported_at && (
            <p className="text-xs text-muted-foreground">
              First exported: {new Date(pkg.exported_at).toLocaleString()}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Prompt package not yet generated.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel D — export_or_launch_task / await_result
// ---------------------------------------------------------------------------

function ExternalTaskPanel({
  runId,
  externalTask,
}: {
  runId: string;
  externalTask?: ExternalResearchTaskRow | null;
}) {
  const [task, setTask] = useState<ExternalResearchTaskRow | null>(
    externalTask ?? null,
  );
  const [notes, setNotes] = useState(externalTask?.notes ?? "");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (externalTask) {
      setTask(externalTask);
      setNotes(externalTask.notes ?? "");
    }
  }, [externalTask]);

  const handleTransition = useCallback(
    async (newStatus: string) => {
      setLoadingAction(newStatus);
      setActionError(null);
      try {
        const updated = await patchExternalTask(runId, {
          status: newStatus,
          notes: notes || null,
        });
        setTask(updated);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setLoadingAction(null);
      }
    },
    [runId, notes],
  );

  const currentStatus = task?.status ?? "exported";
  const canMarkStarted = currentStatus === "exported" || currentStatus === "routing_ready";
  const canMarkComplete = currentStatus === "waiting_external";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHeading>External Task</SectionHeading>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <StatusBadge status={currentStatus} />
            {task?.exported_at && (
              <span className="text-xs text-muted-foreground">
                Exported: {new Date(task.exported_at).toLocaleString()}
              </span>
            )}
          </div>
          {task?.started_at && (
            <p className="text-xs text-muted-foreground">
              Started: {new Date(task.started_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <div>
        <SectionHeading>Operator Notes</SectionHeading>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about the external task…"
          rows={3}
          className={cn(
            "w-full resize-none rounded-md border border-border bg-muted/30 px-3 py-2 text-sm",
            "placeholder:text-muted-foreground/60",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label="Operator notes for external task"
        />
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400"
        >
          {actionError}
        </div>
      )}

      <div className="flex items-center gap-2">
        {canMarkStarted && (
          <ActionButton
            onClick={() => void handleTransition("waiting_external")}
            loading={loadingAction === "waiting_external"}
            disabled={loadingAction !== null}
            variant="primary"
          >
            Mark Started
          </ActionButton>
        )}
        {canMarkComplete && (
          <ActionButton
            onClick={() => void handleTransition("result_uploaded")}
            loading={loadingAction === "result_uploaded"}
            disabled={loadingAction !== null}
            variant="secondary"
          >
            Mark Complete
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel E — upload_or_import_result
// ---------------------------------------------------------------------------

function UploadResultPanel({ runId }: { runId: string }) {
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [pasteContent, setPasteContent] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResultResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }

  async function handleUpload() {
    setUploading(true);
    setUploadError(null);
    try {
      let result: UploadResultResponse;
      if (mode === "file" && selectedFile) {
        result = await uploadExternalResultFile(runId, selectedFile);
      } else if (mode === "paste" && pasteContent.trim()) {
        const isJson = pasteContent.trim().startsWith("{") || pasteContent.trim().startsWith("[");
        result = await uploadExternalResult(runId, {
          content: pasteContent,
          content_type: isJson ? "application/json" : "text/plain",
        });
      } else {
        setUploadError("Please select a file or paste content before uploading.");
        setUploading(false);
        return;
      }
      setUploadResult(result);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (uploadResult) {
    const hasDupWarning = Boolean(uploadResult.warning);
    const hasValidationWarnings = (uploadResult.validation.warnings ?? []).length > 0;
    const passed = uploadResult.validation.status !== "strict_fail";

    return (
      <div className="flex flex-col gap-3">
        <SectionHeading>Upload Result</SectionHeading>
        <div
          role="status"
          className={cn(
            "rounded-md border p-3 text-sm",
            passed
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
              : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 text-red-700 dark:text-red-400",
          )}
        >
          <p className="font-semibold">{passed ? "Upload succeeded" : "Upload failed validation"}</p>
          <p className="mt-0.5 font-mono text-xs">
            Artifact: {uploadResult.result_artifact_id}
          </p>
        </div>

        {hasDupWarning && (
          <div
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400"
          >
            <p className="font-semibold">Duplicate upload detected</p>
            <p className="mt-0.5">{uploadResult.warning}</p>
            {uploadResult.existing_artifact_id && (
              <p className="mt-0.5 font-mono text-xs">
                Existing: {uploadResult.existing_artifact_id}
              </p>
            )}
          </div>
        )}

        {hasValidationWarnings && (
          <div>
            <SectionHeading>Validation Warnings</SectionHeading>
            <ul className="flex flex-col gap-1">
              {uploadResult.validation.warnings.map((w, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400"
                >
                  <span aria-hidden="true">⚠</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Next: <span className="font-medium capitalize">{uploadResult.next_stage.replace(/_/g, " ")}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeading>Upload Result</SectionHeading>

      {/* Mode toggle */}
      <div
        role="tablist"
        aria-label="Upload method"
        className="flex items-center gap-0 rounded-md border border-border overflow-hidden w-fit"
      >
        {(["file", "paste"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "px-3 h-7 text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === m
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "file" ? "File Upload" : "Paste Text"}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <div className="flex flex-col gap-3">
          {/* Drag-and-drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop file here or click to browse"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/20 hover:bg-muted/40",
            )}
          >
            <svg
              aria-hidden="true"
              className="size-8 text-muted-foreground/50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {selectedFile ? (
              <div>
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || "unknown type"}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  Drop a file here or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Markdown, plain text, or JSON
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,.json,text/plain,text/markdown,application/json"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="File input"
          />
        </div>
      ) : (
        <textarea
          value={pasteContent}
          onChange={(e) => setPasteContent(e.target.value)}
          placeholder="Paste research result content here (text, markdown, or JSON)…"
          rows={8}
          className={cn(
            "w-full resize-y rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-mono",
            "placeholder:text-muted-foreground/60",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label="Paste research result content"
        />
      )}

      {uploadError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400"
        >
          {uploadError}
        </div>
      )}

      <ActionButton
        onClick={() => void handleUpload()}
        loading={uploading}
        disabled={mode === "file" ? !selectedFile : !pasteContent.trim()}
        variant="primary"
      >
        {uploading ? "Uploading…" : "Upload Result"}
      </ActionButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel F — validate_result
// ---------------------------------------------------------------------------

function ValidateResultPanel({ workflowRun }: { workflowRun: WorkflowRun }) {
  const meta = workflowRun.metadata ?? {};
  const validationStatus = (meta.validation_status as string | undefined) ?? null;
  const citationWarnings = (meta.citation_warnings as string[] | undefined) ?? [];
  const sourceValidity = (meta.source_validity as Array<{ source: string; valid: boolean; reason?: string }> | undefined) ?? [];

  const passed = validationStatus === "advisory_pass" || validationStatus === "passed";
  const failed = validationStatus === "strict_fail" || validationStatus === "failed";

  return (
    <div className="flex flex-col gap-4">
      {/* Pass/fail banner */}
      {validationStatus ? (
        <div
          role="status"
          className={cn(
            "rounded-md border p-3 text-sm font-semibold",
            passed
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
              : failed
                ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
          )}
        >
          {passed ? "Validation Passed" : failed ? "Validation Failed" : "Validation In Progress"}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Validation results not yet available.
        </p>
      )}

      {/* Citation warnings */}
      {citationWarnings.length > 0 && (
        <div>
          <SectionHeading>Citation Warnings</SectionHeading>
          <ul className="flex flex-col gap-1.5" role="list" aria-label="Citation warnings">
            {citationWarnings.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
              >
                <span aria-hidden="true" className="shrink-0">⚠</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Source validity table */}
      {sourceValidity.length > 0 && (
        <div>
          <SectionHeading>Source Validity</SectionHeading>
          <ul className="flex flex-col gap-1.5" role="list" aria-label="Source validity">
            {sourceValidity.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs"
              >
                <span
                  aria-label={s.valid ? "Valid" : "Invalid"}
                  className={s.valid ? "text-emerald-500" : "text-red-500"}
                >
                  {s.valid ? "✓" : "✗"}
                </span>
                <span className="font-mono text-foreground/80 break-all">{s.source}</span>
                {s.reason && (
                  <span className="text-muted-foreground">— {s.reason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel G — synthesize_results / synthesis (P4-01)
// ---------------------------------------------------------------------------

function SynthesisPanel({
  runId,
  workflowRun,
}: {
  runId: string;
  workflowRun: WorkflowRun;
}) {
  const meta = workflowRun.metadata ?? {};
  // Plan artifact from metadata (set at run-creation time)
  const planArtifactId = (meta.plan_artifact_id as string | undefined) ?? null;
  // Synthesis artifact id — may be populated from metadata after SSE update
  const synthArtifactIdFromMeta = (meta.synthesis_artifact_id as string | undefined) ?? null;

  const [enqueueResult, setEnqueueResult] = useState<SynthesisEnqueueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine current synthesis status
  const runStatus = workflowRun.status;
  const isSynthesizing = runStatus === "running";
  const isSynthesisComplete =
    !!synthArtifactIdFromMeta ||
    enqueueResult?.synthesis_artifact_id != null ||
    runStatus === "complete";

  // Created artifacts from the run — synthesized artifacts are listed here
  const createdArtifacts = workflowRun.created_artifacts ?? [];

  const handleEnqueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await enqueueSynthesis(runId);
      setEnqueueResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enqueue synthesis");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  const synthArtifactId =
    enqueueResult?.synthesis_artifact_id ?? synthArtifactIdFromMeta;

  const synthStatusLabel = (() => {
    if (enqueueResult?.status === "already_synthesized") return "Already Synthesized";
    if (enqueueResult?.status === "enqueued") return "Enqueued";
    if (isSynthesisComplete) return "Complete";
    if (isSynthesizing) return "In Progress";
    return "Pending";
  })();

  const synthStatusCls = (() => {
    if (isSynthesisComplete || enqueueResult?.status === "already_synthesized")
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    if (isSynthesizing || enqueueResult?.status === "enqueued")
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
    return "bg-muted text-muted-foreground";
  })();

  return (
    <div className="flex flex-col gap-5">
      {/* Status banner */}
      <div>
        <SectionHeading>Synthesis Status</SectionHeading>
        <div className="flex items-center gap-3">
          <span
            role="status"
            aria-label={`Synthesis status: ${synthStatusLabel}`}
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
              synthStatusCls,
            )}
          >
            {isSynthesizing && !enqueueResult && (
              <svg
                aria-hidden="true"
                className="mr-1 size-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            {synthStatusLabel}
          </span>
          {enqueueResult?.enqueued_at && (
            <span className="text-xs text-muted-foreground">
              {new Date(enqueueResult.enqueued_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Plan artifact link */}
      {planArtifactId && (
        <div>
          <SectionHeading>Synthesis Plan</SectionHeading>
          <p className="text-sm text-foreground/80">
            Plan artifact:{" "}
            <a
              href={`/artifacts/${encodeURIComponent(planArtifactId)}`}
              className="font-mono text-xs text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring outline-none rounded"
              aria-label={`View plan artifact ${planArtifactId}`}
            >
              {planArtifactId}
            </a>
          </p>
        </div>
      )}

      {/* Synthesis artifact link */}
      {synthArtifactId && (
        <div>
          <SectionHeading>Synthesis Artifact</SectionHeading>
          <a
            href={`/artifacts/${encodeURIComponent(synthArtifactId)}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm",
              "font-mono text-foreground/80 hover:bg-muted transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label={`View synthesis artifact ${synthArtifactId}`}
          >
            <svg
              aria-hidden="true"
              className="size-3.5 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {synthArtifactId}
          </a>
        </div>
      )}

      {/* Created artifacts list */}
      {createdArtifacts.length > 0 && (
        <div>
          <SectionHeading>Synthesized Artifacts</SectionHeading>
          <ul
            className="flex flex-col gap-1.5"
            role="list"
            aria-label="Synthesized artifacts"
          >
            {createdArtifacts.map((art) => (
              <li key={art.artifact_id} className="flex items-center gap-2">
                <a
                  href={`/artifacts/${encodeURIComponent(art.artifact_id)}`}
                  className={cn(
                    "flex-1 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-sm",
                    "hover:bg-muted transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                  aria-label={`View artifact ${art.title ?? art.artifact_id}`}
                >
                  <span className="font-medium text-foreground">
                    {art.title ?? art.artifact_id}
                  </span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                    {art.artifact_id}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400"
        >
          <p className="font-semibold">Synthesis failed</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* Enqueue CTA — only shown when not yet started */}
      {!isSynthesizing && !isSynthesisComplete && !enqueueResult && (
        <div className="flex items-center gap-2">
          <ActionButton
            onClick={() => void handleEnqueue()}
            loading={loading}
            disabled={loading}
            variant="primary"
          >
            Start Synthesis
          </ActionButton>
        </div>
      )}

      {/* Retry CTA — shown when enqueue errored */}
      {error && !loading && (
        <div className="flex items-center gap-2">
          <ActionButton
            onClick={() => void handleEnqueue()}
            loading={loading}
            variant="secondary"
          >
            Retry
          </ActionButton>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel H — draft (P4-02)
// ---------------------------------------------------------------------------

const DRAFT_FORMAT_OPTIONS: { value: DraftFormat; label: string; description: string }[] = [
  { value: "brief", label: "Brief", description: "Short executive summary" },
  { value: "topic_note", label: "Topic Note", description: "Structured wiki-style note" },
  { value: "blog", label: "Blog Post", description: "Editorial narrative post" },
  { value: "prd", label: "PRD", description: "Product requirements document" },
];

function DraftPanel({ runId, workflowRun }: { runId: string; workflowRun: WorkflowRun }) {
  const meta = workflowRun.metadata ?? {};
  // Existing draft artifact IDs from metadata (populated after backend draft)
  const existingDraftIds = (meta.draft_artifact_ids as string[] | undefined) ?? [];

  const [selectedFormats, setSelectedFormats] = useState<Set<DraftFormat>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [draftResult, setDraftResult] = useState<DraftEnqueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasDrafts = existingDraftIds.length > 0 || (draftResult?.draft_artifact_ids.length ?? 0) > 0;
  const displayDraftIds =
    draftResult?.draft_artifact_ids.length
      ? draftResult.draft_artifact_ids
      : existingDraftIds;

  function toggleFormat(fmt: DraftFormat) {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(fmt)) {
        next.delete(fmt);
      } else {
        next.add(fmt);
      }
      return next;
    });
  }

  async function handleGenerate() {
    if (selectedFormats.size === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await enqueueDraft(runId, [...selectedFormats]);
      setDraftResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function handleRegenerate() {
    setDraftResult(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeading>Draft Formats</SectionHeading>

      {/* Format picker */}
      <fieldset
        disabled={generating}
        aria-label="Select draft formats"
        className="flex flex-col gap-2"
      >
        <legend className="sr-only">Select one or more draft formats to generate</legend>
        {DRAFT_FORMAT_OPTIONS.map((opt) => {
          const checked = selectedFormats.has(opt.value);
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
                "focus-within:ring-2 focus-within:ring-ring",
                checked
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-muted/20 hover:bg-muted/40",
                generating && "opacity-50 cursor-not-allowed",
              )}
            >
              <input
                type="checkbox"
                value={opt.value}
                checked={checked}
                onChange={() => toggleFormat(opt.value)}
                disabled={generating}
                className="mt-0.5 rounded border-border accent-primary"
                aria-describedby={`format-desc-${opt.value}`}
              />
              <div>
                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                <p
                  id={`format-desc-${opt.value}`}
                  className="text-xs text-muted-foreground"
                >
                  {opt.description}
                </p>
              </div>
            </label>
          );
        })}
      </fieldset>

      {/* Latency estimate */}
      {selectedFormats.size > 0 && !generating && !hasDrafts && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Generating {selectedFormats.size} draft{selectedFormats.size > 1 ? "s" : ""} —
          usually takes &lt;15s per format.
        </p>
      )}

      {/* Loading state */}
      {generating && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
          aria-busy="true"
        >
          <svg
            aria-hidden="true"
            className="size-4 animate-spin text-primary"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          Generating drafts… Usually &lt;15s per format.
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400"
        >
          <p className="font-semibold">Draft generation failed</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* CTA row */}
      {!hasDrafts && (
        <div className="flex items-center gap-2">
          <ActionButton
            onClick={() => void handleGenerate()}
            loading={generating}
            disabled={generating || selectedFormats.size === 0}
            variant="primary"
          >
            Generate Drafts
          </ActionButton>
          {selectedFormats.size === 0 && !generating && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Select at least one format above
            </span>
          )}
        </div>
      )}

      {/* Draft artifacts list */}
      {displayDraftIds.length > 0 && (
        <div>
          <SectionHeading>Generated Drafts</SectionHeading>
          <ul
            className="flex flex-col gap-2"
            role="list"
            aria-label="Generated draft artifacts"
          >
            {displayDraftIds.map((id, idx) => {
              const fmt = draftResult?.formats[idx] ?? existingDraftIds[idx] ? undefined : undefined;
              return (
                <li key={id}>
                  <a
                    href={`/artifacts/${encodeURIComponent(id)}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2",
                      "hover:bg-muted transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    aria-label={`View draft artifact ${id}`}
                  >
                    <svg
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-violet-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {fmt && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        {fmt}
                      </span>
                    )}
                    <span className="font-mono text-xs text-foreground/80 truncate">{id}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          {/* Regenerate */}
          <div className="mt-3">
            <ActionButton
              onClick={handleRegenerate}
              disabled={generating}
              variant="secondary"
            >
              Regenerate with Different Formats
            </ActionButton>
          </div>
        </div>
      )}

      {/* Success status */}
      {draftResult && draftResult.status === "already_drafted" && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400"
        >
          Drafts already existed for the selected formats. Existing artifacts shown above.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel I — review / file_back (P4-03)
// ---------------------------------------------------------------------------

function ReviewPanel({ runId }: { runId: string }) {
  const [mode, setMode] = useState<"advisory" | "strict">("advisory");
  const [reviewing, setReviewing] = useState(false);
  const [filingBack, setFilingBack] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewGatesResponse | null>(null);
  const [fileBackResult, setFileBackResult] = useState<FileBackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canFileBack = reviewResult
    ? mode === "advisory" || reviewResult.passed
    : false;

  async function handleRunReview() {
    setReviewing(true);
    setError(null);
    try {
      const res = await runReviewGates(runId, mode);
      setReviewResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review evaluation failed");
    } finally {
      setReviewing(false);
    }
  }

  async function handleFileBack() {
    if (!canFileBack) return;
    setFilingBack(true);
    setError(null);
    try {
      const res = await fileBackResearch(runId);
      setFileBackResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "File-back failed");
    } finally {
      setFilingBack(false);
    }
  }

  const totalWarnings = reviewResult?.warnings.length ?? 0;
  const reviewPassed = reviewResult?.passed ?? false;

  return (
    <div className="flex flex-col gap-5">
      {/* Strict mode toggle */}
      <div className="flex items-center justify-between">
        <SectionHeading>Citation Review</SectionHeading>
        <label className="flex cursor-pointer items-center gap-2 text-xs" aria-label="Enable strict mode">
          <span className="text-muted-foreground select-none">Strict mode</span>
          <button
            type="button"
            role="switch"
            aria-checked={mode === "strict"}
            onClick={() => {
              setMode((m) => (m === "advisory" ? "strict" : "advisory"));
              // Reset results when toggling mode
              setReviewResult(null);
              setError(null);
            }}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === "strict" ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "inline-block size-3.5 rounded-full bg-white shadow transition-transform",
                mode === "strict" ? "translate-x-4" : "translate-x-0.5",
              )}
              aria-hidden="true"
            />
          </button>
        </label>
      </div>

      {mode === "strict" && (
        <p className="text-xs text-amber-700 dark:text-amber-400 -mt-2">
          Strict mode: file-back is blocked if any citation warning is found.
        </p>
      )}

      {/* Run review CTA */}
      {!reviewResult && (
        <ActionButton
          onClick={() => void handleRunReview()}
          loading={reviewing}
          disabled={reviewing}
          variant="primary"
        >
          Run Citation Review
        </ActionButton>
      )}

      {/* Pass / fail banner */}
      {reviewResult && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-md border p-3 text-sm font-semibold",
            reviewPassed
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
              : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 text-red-700 dark:text-red-400",
          )}
        >
          <div className="flex items-center gap-2">
            {reviewPassed ? (
              <svg
                aria-hidden="true"
                className="size-4 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                className="size-4 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            {reviewPassed
              ? `Review ${reviewResult.mode === "strict" ? "Passed (strict)" : "Passed (advisory)"}`
              : "Review Failed — citation warnings detected"}
          </div>
          {totalWarnings > 0 && (
            <p className="mt-1 text-xs font-normal opacity-80">
              {totalWarnings} citation warning{totalWarnings !== 1 ? "s" : ""} found
            </p>
          )}
        </div>
      )}

      {/* Source coverage indicator */}
      {reviewResult && (
        <div>
          <SectionHeading>Source Coverage</SectionHeading>
          <div className="flex items-center gap-3">
            <div
              className="flex-1 h-2 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={reviewPassed ? 100 : Math.max(0, 100 - totalWarnings * 15)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Source coverage"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  reviewPassed ? "bg-emerald-500" : totalWarnings > 2 ? "bg-red-500" : "bg-amber-400",
                )}
                style={{
                  width: `${reviewPassed ? 100 : Math.max(10, 100 - totalWarnings * 15)}%`,
                }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {reviewPassed ? "100%" : `${Math.max(0, 100 - totalWarnings * 15)}%`}
            </span>
          </div>
        </div>
      )}

      {/* Citation checklist */}
      {reviewResult && reviewResult.warnings.length > 0 && (
        <div>
          <SectionHeading>Citation Warnings</SectionHeading>
          <ul
            className="flex flex-col gap-1.5"
            role="list"
            aria-label="Citation warnings"
          >
            {reviewResult.warnings.map((w, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                  "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
                )}
              >
                <span
                  aria-label="Warning"
                  className="mt-0.5 shrink-0 text-amber-500"
                  aria-hidden="true"
                >
                  ⚠
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-amber-700 dark:text-amber-400">{w.message}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    Artifact: {w.draft_artifact_id}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Re-run review */}
      {reviewResult && !fileBackResult && (
        <ActionButton
          onClick={() => {
            setReviewResult(null);
            setError(null);
          }}
          disabled={reviewing || filingBack}
          variant="secondary"
        >
          Re-run Review
        </ActionButton>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400"
        >
          <p className="font-semibold">Action failed</p>
          <p className="mt-0.5">{error}</p>
        </div>
      )}

      {/* File-back CTA */}
      {reviewResult && !fileBackResult && (
        <div className="flex items-center gap-2">
          <ActionButton
            onClick={() => void handleFileBack()}
            loading={filingBack}
            disabled={!canFileBack || filingBack || reviewing}
            variant="primary"
          >
            Pass Review &amp; File Back
          </ActionButton>
          {!canFileBack && mode === "strict" && (
            <p
              className="text-xs text-muted-foreground"
              role="note"
              aria-label="File-back is disabled due to strict mode citation failures"
            >
              Blocked: strict mode requires all checks to pass
            </p>
          )}
        </div>
      )}

      {/* File-back success */}
      {fileBackResult && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 p-4"
        >
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {fileBackResult.status === "already_filed_back"
              ? "Already Filed Back"
              : "Filed Back Successfully"}
          </p>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">Final artifact:</p>
            <a
              href={`/artifacts/${encodeURIComponent(fileBackResult.final_artifact_id)}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm",
                "font-mono text-foreground/80 hover:bg-muted transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "w-fit",
              )}
              aria-label={`View filed-back artifact ${fileBackResult.final_artifact_id}`}
            >
              <svg
                aria-hidden="true"
                className="size-3.5 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {fileBackResult.final_artifact_id}
            </a>
          </div>
          {fileBackResult.lineage.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Lineage ({fileBackResult.lineage.length} ancestors)
              </summary>
              <ul className="mt-1.5 flex flex-col gap-0.5 pl-3">
                {fileBackResult.lineage.map((id) => (
                  <li key={id} className="font-mono text-[10px]">
                    {id}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage group routing
// ---------------------------------------------------------------------------

const INTAKE_STAGES = new Set(["collect_intent", "assemble_package"]);
const ROUTE_STAGES = new Set(["analyze_routes"]);
const PROMPT_STAGES = new Set(["generate_prompt_package"]);
const TASK_STAGES = new Set(["export_or_launch_task", "await_result"]);
const UPLOAD_STAGES = new Set(["upload_or_import_result"]);
const VALIDATE_STAGES = new Set(["validate_result"]);

/** Returns true when the stage name contains "synthesis" (e.g. "synthesize_results", "synthesis"). */
export function isSynthesisStage(name: string): boolean {
  return name.includes("synthesis") || name.includes("synthesize");
}

/** Returns true when the stage name contains "draft". */
export function isDraftStage(name: string): boolean {
  return name.includes("draft");
}

/** Returns true when the stage name contains "review" or "file_back". */
export function isReviewStage(name: string): boolean {
  return name.includes("review") || name.includes("file_back");
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function ResearchStagePanel({
  stage,
  workflowRun,
  externalTask,
  className,
}: ResearchStagePanelProps) {
  const stageName = stage.name;

  let body: React.ReactNode = null;

  if (INTAKE_STAGES.has(stageName)) {
    body = <IntakePanel workflowRun={workflowRun} />;
  } else if (ROUTE_STAGES.has(stageName)) {
    body = <RouteCardsPanel workflowRun={workflowRun} />;
  } else if (PROMPT_STAGES.has(stageName)) {
    body = <PromptPackagePanel runId={workflowRun.id} />;
  } else if (TASK_STAGES.has(stageName)) {
    body = <ExternalTaskPanel runId={workflowRun.id} externalTask={externalTask} />;
  } else if (UPLOAD_STAGES.has(stageName)) {
    body = <UploadResultPanel runId={workflowRun.id} />;
  } else if (VALIDATE_STAGES.has(stageName)) {
    body = <ValidateResultPanel workflowRun={workflowRun} />;
  } else if (isSynthesisStage(stageName)) {
    // P4-01 — synthesis stage body
    body = <SynthesisPanel runId={workflowRun.id} workflowRun={workflowRun} />;
  } else if (isDraftStage(stageName)) {
    // P4-02 — draft stage body
    body = <DraftPanel runId={workflowRun.id} workflowRun={workflowRun} />;
  } else if (isReviewStage(stageName)) {
    // P4-03 — review / file-back stage body
    body = <ReviewPanel runId={workflowRun.id} />;
  } else {
    // Unknown stages — return null to let parent show generic content.
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6",
        className,
      )}
      data-testid="research-stage-panel"
    >
      {body}
    </div>
  );
}
