"use client";

/**
 * QuickAddModal — three-tab intake modal (Note, URL, Audio).
 *
 * P3-04: Full submission wiring.
 *   - Note tab: textarea + optional comma-separated tags
 *   - URL tab: URL input + optional title + optional comma-separated tags
 *   - POST to /api/intake/note or /api/intake/url on submit
 *   - On 202: transitions to ingestion view with StageTracker full variant
 *     bound to /api/workflows/:run_id/stream via useSSE
 *   - SSE completion (workflow_completed): shows artifact link + "Add another"
 *   - SSE failure (workflow_failed): shows inline error with retry
 *   - POST error: inline error banner with retry
 *   - Close during ingestion: shows confirm dialog (workflow continues in background)
 *   - Form validates: note requires text; URL requires valid URL format
 *
 * P4-02 additions:
 *   - useOfflineQueue hook provides queuedCount + failedCount.
 *   - "Queued (N)" badge shown in modal header when queuedCount > 0.
 *   - "Retry failed (N)" inline action when failedCount > 0.
 *   - submitNote / submitUrl route through intakeFetch; offline path returns
 *     IntakeQueuedResponse → transitions to new "queued" phase.
 *
 * P4-03 additions:
 *   - Audio tab with AudioRecorder component.
 *   - On recording complete, calls submitUpload(blob, mimeType).
 *   - submitUpload routes through intakeFetch → offline queueing works for free.
 *   - On success (202): transitions to "audio_queued" phase with transcription note.
 *   - Client-side 25 MB guard in AudioRecorder; server also enforces HTTP 413.
 *
 * Design spec §5 (POST /api/intake/{note,url,upload}), §3.2 row 4.
 * SSE event types: SSEWorkflowEvent from @/lib/sse/types
 *   terminal completion event: WorkflowCompletedEvent { type: "workflow_completed", artifact_id? }
 *
 * Traces FR-1.5-16 (P4-03), FR-1.5-17, FR-1.5-18 (P4-02).
 */

import { useState, useCallback, useId } from "react";
import { cn } from "@/lib/utils";
import { StageTracker } from "@/components/workflow/stage-tracker";
import { useSSE } from "@/hooks/useSSE";
import { submitNote, submitUrl, submitUpload, parseTagString, isQueuedResponse } from "@/lib/api/intake";
import { useOfflineQueue } from "@/hooks/use-offline-queue";
import { AudioRecorder } from "@/components/quick-add/audio-recorder";
import type { WorkflowRunStatus } from "@/types/artifact";
import type { SSEWorkflowEvent, WorkflowCompletedEvent } from "@/lib/sse/types";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type Tab = "note" | "url" | "audio";

/** Modal display phase. */
type ModalPhase =
  | "form"          // initial form entry
  | "ingesting"     // POST accepted, SSE streaming
  | "complete"      // SSE workflow_completed received
  | "queued"        // offline: stored in IndexedDB
  | "audio_queued"  // audio upload accepted (transcription pending)
  | "error";        // POST error or SSE workflow_failed

interface CompletedRun {
  runId: string;
  artifactId?: string | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuickAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

const URL_REGEX = /^https?:\/\/.+/i;

function isValidUrl(val: string): boolean {
  try {
    const u = new URL(val);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return URL_REGEX.test(val);
  }
}

// ---------------------------------------------------------------------------
// TagInput — comma-separated tag entry displayed as chips
// ---------------------------------------------------------------------------

interface TagInputProps {
  id: string;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

function TagInput({ id, value, onChange, disabled }: TagInputProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        Tags{" "}
        <span className="font-normal text-muted-foreground">(optional, comma-separated)</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="research, ai, notes"
        disabled={disabled}
        className={cn(
          "w-full rounded-md border bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:opacity-50",
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AbandonConfirmDialog — shown when user tries to close during active ingestion
// ---------------------------------------------------------------------------

interface AbandonConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function AbandonConfirmDialog({ onConfirm, onCancel }: AbandonConfirmProps) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="abandon-title"
      aria-describedby="abandon-desc"
      className={cn(
        "fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
        "rounded-xl border bg-card shadow-2xl p-6",
      )}
    >
      <h3 id="abandon-title" className="mb-2 text-base font-semibold">
        Close while ingesting?
      </h3>
      <p id="abandon-desc" className="mb-5 text-sm text-muted-foreground">
        The workflow will continue running in the background. You can track its
        progress in the Workflows panel.
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          autoFocus
          className={cn(
            "inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium sm:h-8 sm:min-h-0",
            "border border-input bg-background text-foreground",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Keep open
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            "inline-flex min-h-[44px] items-center rounded-md px-4 text-sm font-medium sm:h-8 sm:min-h-0",
            "bg-destructive text-destructive-foreground",
            "transition-colors hover:bg-destructive/90",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Close anyway
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QueueBadge — small pill shown in header when items are pending
// ---------------------------------------------------------------------------

interface QueueBadgeProps {
  queuedCount: number;
  failedCount: number;
  onRetryFailed: () => void;
}

function QueueBadge({ queuedCount, failedCount, onRetryFailed }: QueueBadgeProps) {
  if (queuedCount === 0 && failedCount === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {queuedCount > 0 && (
        <span
          aria-label={`${queuedCount} item${queuedCount === 1 ? "" : "s"} queued for sync`}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
            "ring-1 ring-inset ring-amber-400/30",
          )}
        >
          Queued ({queuedCount})
        </span>
      )}
      {failedCount > 0 && (
        <button
          type="button"
          onClick={onRetryFailed}
          aria-label={`${failedCount} item${failedCount === 1 ? "" : "s"} failed — click to retry`}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            "bg-destructive/10 text-destructive",
            "ring-1 ring-inset ring-destructive/30",
            "hover:bg-destructive/20 transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Retry failed ({failedCount})
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function QuickAddModal({ open, onOpenChange }: QuickAddModalProps) {
  // Stable IDs for ARIA wiring
  const baseId = useId();
  const noteTextId = `${baseId}-note-text`;
  const noteTagsId = `${baseId}-note-tags`;
  const urlValueId = `${baseId}-url-value`;
  const urlTitleId = `${baseId}-url-title`;
  const urlTagsId  = `${baseId}-url-tags`;

  // Form state
  const [activeTab, setActiveTab]   = useState<Tab>("note");
  const [noteText, setNoteText]     = useState("");
  const [noteTags, setNoteTags]     = useState("");
  const [urlValue, setUrlValue]     = useState("");
  const [urlTitle, setUrlTitle]     = useState("");
  const [urlTags, setUrlTags]       = useState("");

  // Audio state (P4-03)
  const [audioBlob, setAudioBlob]         = useState<Blob | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>("");
  const [audioError, setAudioError]       = useState<string | null>(null);

  // Flow state
  const [phase, setPhase]             = useState<ModalPhase>("form");
  const [runId, setRunId]             = useState<string | null>(null);
  const [completedRun, setCompletedRun] = useState<CompletedRun | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowRunStatus>("pending");
  const [currentStage, setCurrentStage]     = useState<number>(0);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Offline queue badge state (P4-02)
  const { queuedCount, failedCount, retryFailed } = useOfflineQueue();

  // SSE subscription — only active during ingestion phase
  const sseUrl = phase === "ingesting" && runId
    ? `/api/workflows/${runId}/stream`
    : undefined;

  const { events, status: sseStatus } = useSSE<SSEWorkflowEvent>({
    url: sseUrl,
    enabled: phase === "ingesting",
  });

  // Process SSE events — derive current stage + phase transitions
  // We process the full event list each render so we remain idempotent
  // against React StrictMode double-invocations.
  const lastEvent = events[events.length - 1];

  if (phase === "ingesting" && lastEvent) {
    if (lastEvent.type === "workflow_completed") {
      const completed = lastEvent as WorkflowCompletedEvent;
      if (completedRun?.runId !== runId) {
        setCompletedRun({
          runId: runId!,
          artifactId: completed.artifact_id,
        });
        setWorkflowStatus("complete");
        setPhase("complete");
      }
    } else if (lastEvent.type === "workflow_failed") {
      if (phase === "ingesting") {
        setSubmitError(
          "type" in lastEvent && "error" in lastEvent
            ? String((lastEvent as { error: string }).error)
            : "Workflow failed — please try again.",
        );
        setWorkflowStatus("failed");
        setPhase("error");
      }
    } else if (lastEvent.type === "stage_started" || lastEvent.type === "stage_progress") {
      // Advance stage index based on the sequence of stage_started events
      const stageStartedEvents = events.filter((e) => e.type === "stage_started");
      const stageIdx = stageStartedEvents.length > 0 ? stageStartedEvents.length - 1 : 0;
      if (stageIdx !== currentStage) {
        setCurrentStage(stageIdx);
        setWorkflowStatus("running");
      }
    }
  }

  // Also set running on SSE open
  if (phase === "ingesting" && sseStatus === "open" && workflowStatus === "pending") {
    setWorkflowStatus("running");
  }

  // ---------------------------------------------------------------------------
  // Reset helpers
  // ---------------------------------------------------------------------------

  function resetForm() {
    setNoteText("");
    setNoteTags("");
    setUrlValue("");
    setUrlTitle("");
    setUrlTags("");
    setAudioBlob(null);
    setAudioMimeType("");
    setAudioError(null);
    setActiveTab("note");
  }

  function resetAll() {
    resetForm();
    setPhase("form");
    setRunId(null);
    setCompletedRun(null);
    setSubmitError(null);
    setWorkflowStatus("pending");
    setCurrentStage(0);
    setIsSubmitting(false);
  }

  // ---------------------------------------------------------------------------
  // Close handling
  // ---------------------------------------------------------------------------

  const handleCloseAttempt = useCallback(() => {
    if (phase === "ingesting") {
      setShowAbandonConfirm(true);
      return;
    }
    // On complete/error or form phase: close and reset
    onOpenChange(false);
    setTimeout(resetAll, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, onOpenChange]);

  function handleAbandonConfirm() {
    setShowAbandonConfirm(false);
    onOpenChange(false);
    // Do NOT resetAll — workflow continues; Workflow Status Panel (P3-07) tracks it.
    setTimeout(resetAll, 200);
  }

  function handleAbandonCancel() {
    setShowAbandonConfirm(false);
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function isNoteValid(): boolean {
    return noteText.trim().length > 0;
  }

  function isUrlValid(): boolean {
    return urlValue.trim().length > 0 && isValidUrl(urlValue.trim());
  }

  function isSubmitDisabled(): boolean {
    if (isSubmitting) return true;
    if (activeTab === "note") return !isNoteValid();
    if (activeTab === "audio") return audioBlob === null;
    return !isUrlValid();
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let response: Awaited<ReturnType<typeof submitNote>>;

      if (activeTab === "note") {
        const tags = parseTagString(noteTags);
        response = await submitNote({
          text: noteText.trim(),
          tags: tags.length > 0 ? tags : undefined,
        });
      } else if (activeTab === "audio") {
        // P4-03: audio upload — routes through intakeFetch for offline support
        if (!audioBlob) return;
        response = await submitUpload(audioBlob, audioMimeType);

        // P4-02: offline queued
        if (isQueuedResponse(response)) {
          setPhase("queued");
          return;
        }

        // Audio accepted — transcription pending (backend stub returns [transcript pending])
        setPhase("audio_queued");
        return;
      } else {
        const tags = parseTagString(urlTags);
        response = await submitUrl({
          url: urlValue.trim(),
          title: urlTitle.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
        });
      }

      // P4-02: handle offline queued response
      if (isQueuedResponse(response)) {
        setPhase("queued");
        return;
      }

      setRunId(response.run_id);
      setWorkflowStatus("pending");
      setCurrentStage(0);
      setPhase("ingesting");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Submission failed — please try again.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // "Add another" handler
  // ---------------------------------------------------------------------------

  function handleAddAnother() {
    resetAll();
  }

  // ---------------------------------------------------------------------------
  // Render guard
  // ---------------------------------------------------------------------------

  if (!open) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={handleCloseAttempt}
      />

      {/* Abandon confirm overlay */}
      {showAbandonConfirm && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/20" />
          <AbandonConfirmDialog
            onConfirm={handleAbandonConfirm}
            onCancel={handleAbandonCancel}
          />
        </>
      )}

      {/* Main dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border bg-card shadow-xl",
          "focus:outline-none",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <h2
              id="quick-add-title"
              className="text-base font-semibold tracking-tight"
            >
              {phase === "ingesting"
                ? "Ingesting…"
                : phase === "complete"
                ? "Added"
                : phase === "queued"
                ? "Queued"
                : phase === "audio_queued"
                ? "Audio submitted"
                : "Quick Add"}
            </h2>
            {/* P4-02: offline queue badge */}
            <QueueBadge
              queuedCount={queuedCount}
              failedCount={failedCount}
              onRetryFailed={() => void retryFailed()}
            />
          </div>
          <button
            type="button"
            aria-label="Close Quick Add"
            onClick={handleCloseAttempt}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* --- FORM PHASE --- */}
        {phase === "form" && (
          <>
            {/* Tab bar */}
            <div role="tablist" aria-label="Intake type" className="flex border-b">
              {(["note", "url", "audio"] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`quick-add-${tab}-panel`}
                  id={`quick-add-${tab}-tab`}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors",
                    "border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    activeTab === tab
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab === "note" ? "Note" : tab === "url" ? "URL" : "Audio"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-4 p-5">
                {/* Note panel */}
                <div
                  role="tabpanel"
                  id="quick-add-note-panel"
                  aria-labelledby="quick-add-note-tab"
                  hidden={activeTab !== "note"}
                  className="flex flex-col gap-3"
                >
                  <div>
                    <label
                      htmlFor={noteTextId}
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Note text
                    </label>
                    <textarea
                      id={noteTextId}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Start typing your note…"
                      rows={5}
                      aria-required="true"
                      aria-invalid={activeTab === "note" && noteText.length > 0 && !isNoteValid()}
                      disabled={isSubmitting}
                      className={cn(
                        "w-full resize-none rounded-md border bg-background px-3 py-2 text-sm",
                        "placeholder:text-muted-foreground",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "disabled:opacity-50",
                      )}
                    />
                  </div>
                  <TagInput
                    id={noteTagsId}
                    value={noteTags}
                    onChange={setNoteTags}
                    disabled={isSubmitting}
                  />
                </div>

                {/* URL panel */}
                <div
                  role="tabpanel"
                  id="quick-add-url-panel"
                  aria-labelledby="quick-add-url-tab"
                  hidden={activeTab !== "url"}
                  className="flex flex-col gap-3"
                >
                  <div>
                    <label
                      htmlFor={urlValueId}
                      className="mb-1.5 block text-sm font-medium"
                    >
                      URL
                    </label>
                    <input
                      id={urlValueId}
                      type="url"
                      value={urlValue}
                      onChange={(e) => setUrlValue(e.target.value)}
                      placeholder="https://…"
                      aria-required="true"
                      aria-invalid={activeTab === "url" && urlValue.length > 0 && !isUrlValid()}
                      disabled={isSubmitting}
                      className={cn(
                        "w-full rounded-md border bg-background px-3 py-2 text-sm",
                        "placeholder:text-muted-foreground",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "disabled:opacity-50",
                      )}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={urlTitleId}
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Title{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      id={urlTitleId}
                      type="text"
                      value={urlTitle}
                      onChange={(e) => setUrlTitle(e.target.value)}
                      placeholder="Override extracted title"
                      disabled={isSubmitting}
                      className={cn(
                        "w-full rounded-md border bg-background px-3 py-2 text-sm",
                        "placeholder:text-muted-foreground",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        "disabled:opacity-50",
                      )}
                    />
                  </div>
                  <TagInput
                    id={urlTagsId}
                    value={urlTags}
                    onChange={setUrlTags}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Audio panel — P4-03 */}
                <div
                  role="tabpanel"
                  id="quick-add-audio-panel"
                  aria-labelledby="quick-add-audio-tab"
                  hidden={activeTab !== "audio"}
                  className="flex flex-col gap-3"
                >
                  <p className="text-sm text-muted-foreground">
                    Record a voice note. The audio will be transcribed automatically.
                  </p>
                  <AudioRecorder
                    disabled={isSubmitting}
                    onRecorded={(blob, mimeType) => {
                      setAudioBlob(blob);
                      setAudioMimeType(mimeType);
                      setAudioError(null);
                    }}
                    onError={(msg) => {
                      setAudioError(msg);
                      setAudioBlob(null);
                    }}
                  />
                  {/* Show recorded confirmation */}
                  {audioBlob && !audioError && (
                    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-3 py-2">
                      <svg
                        aria-hidden="true"
                        className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-sm text-emerald-800 dark:text-emerald-200">
                        Recording ready — {(audioBlob.size / 1024).toFixed(1)} KB. Click &quot;Submit&quot; to upload.
                      </p>
                    </div>
                  )}
                  {audioError && (
                    <div
                      role="alert"
                      className={cn(
                        "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2",
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
                      <p className="text-sm text-destructive">{audioError}</p>
                    </div>
                  )}
                </div>

                {/* POST error banner */}
                {submitError && (
                  <div
                    role="alert"
                    className={cn(
                      "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5",
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
                    <p className="text-sm text-destructive">{submitError}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t px-5 py-3">
                <button
                  type="button"
                  onClick={handleCloseAttempt}
                  className={cn(
                    "inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium sm:h-8 sm:min-h-0",
                    "border border-input bg-background text-foreground",
                    "transition-colors hover:bg-accent hover:text-accent-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitDisabled()}
                  aria-disabled={isSubmitDisabled()}
                  className={cn(
                    "inline-flex min-h-[44px] items-center rounded-md px-4 text-sm font-medium sm:h-8 sm:min-h-0",
                    "bg-primary text-primary-foreground",
                    "transition-colors hover:bg-primary/90",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <svg
                        aria-hidden="true"
                        className="size-3.5 animate-spin"
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
                      {activeTab === "audio" ? "Uploading…" : "Submitting…"}
                    </span>
                  ) : activeTab === "audio" ? (
                    "Submit"
                  ) : (
                    "Add"
                  )}
                </button>
              </div>
            </form>
          </>
        )}

        {/* --- INGESTING PHASE --- */}
        {phase === "ingesting" && runId && (
          <div className="p-5">
            <div
              aria-live="polite"
              aria-atomic="false"
              className="rounded-lg border bg-muted/30 p-4"
            >
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                Processing your submission…
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Run ID:{" "}
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  {runId}
                </code>
              </p>
              <StageTracker
                runId={runId}
                templateId="source_ingest_v1"
                status={workflowStatus}
                currentStage={currentStage}
                variant="full"
                mode="sse"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              You can close this window — processing will continue in the background.
            </p>
          </div>
        )}

        {/* --- QUEUED PHASE (offline) --- P4-02 */}
        {phase === "queued" && (
          <div className="p-5">
            <div
              aria-live="polite"
              className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  className="size-5 text-amber-600 dark:text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Saved for later — you&apos;re offline
                </p>
              </div>
              <p className="text-sm text-amber-800/80 dark:text-amber-200/80">
                Your submission has been saved locally. It will be sent automatically
                when your connection is restored.
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleAddAnother}
                className={cn(
                  "inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-4 text-sm font-medium sm:h-9 sm:min-h-0",
                  "border border-input bg-background text-foreground",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Add another
              </button>
            </div>
          </div>
        )}

        {/* --- AUDIO QUEUED PHASE (P4-03) --- */}
        {phase === "audio_queued" && (
          <div className="p-5">
            <div
              aria-live="polite"
              className="rounded-lg border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  className="size-5 text-sky-600 dark:text-sky-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="9" y="2" width="6" height="12" rx="3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <path strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" d="M19 10a7 7 0 01-14 0M12 19v3M8 22h8" />
                </svg>
                <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">
                  Audio uploaded successfully
                </p>
              </div>
              <p className="text-sm text-sky-800/80 dark:text-sky-200/80">
                Transcription pending — artifact will appear in Inbox once processing is complete.
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleAddAnother}
                className={cn(
                  "inline-flex min-h-[44px] w-full items-center justify-center rounded-md px-4 text-sm font-medium sm:h-9 sm:min-h-0",
                  "border border-input bg-background text-foreground",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Add another
              </button>
            </div>
          </div>
        )}

        {/* --- COMPLETE PHASE --- */}
        {phase === "complete" && completedRun && (
          <div className="p-5">
            <div
              aria-live="polite"
              className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  className="size-5 text-emerald-600 dark:text-emerald-400"
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
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Successfully ingested
                </p>
              </div>

              <p className="mb-3 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                Run ID:{" "}
                <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  {completedRun.runId}
                </code>
              </p>

              <StageTracker
                runId={completedRun.runId}
                templateId="source_ingest_v1"
                status="complete"
                currentStage={4}
                variant="full"
                mode="static"
              />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {completedRun.artifactId && (
                <a
                  href={`/artifact/${completedRun.artifactId}`}
                  className={cn(
                    "inline-flex h-9 w-full items-center justify-center rounded-md px-4 text-sm font-medium",
                    "bg-primary text-primary-foreground",
                    "transition-colors hover:bg-primary/90",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  Go to artifact
                </a>
              )}
              <button
                type="button"
                onClick={handleAddAnother}
                className={cn(
                  "inline-flex h-9 w-full items-center justify-center rounded-md px-4 text-sm font-medium",
                  "border border-input bg-background text-foreground",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Add another
              </button>
            </div>
          </div>
        )}

        {/* --- ERROR PHASE (SSE failure or POST error after ingestion started) --- */}
        {phase === "error" && (
          <div className="p-5">
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  className="size-5 shrink-0 text-destructive"
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
                <p className="text-sm font-semibold text-destructive">
                  Workflow failed
                </p>
              </div>
              {submitError && (
                <p className="text-sm text-destructive/80">{submitError}</p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseAttempt}
                className={cn(
                  "inline-flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium sm:h-8 sm:min-h-0",
                  "border border-input bg-background text-foreground",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Close
              </button>
              <button
                type="button"
                onClick={resetAll}
                className={cn(
                  "inline-flex min-h-[44px] items-center rounded-md px-4 text-sm font-medium sm:h-8 sm:min-h-0",
                  "bg-primary text-primary-foreground",
                  "transition-colors hover:bg-primary/90",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
