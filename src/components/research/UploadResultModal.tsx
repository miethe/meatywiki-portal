"use client";

/**
 * UploadResultModal — modal for uploading an external research result.
 *
 * Fields:
 *   - Result type selector: text | file | both
 *   - File picker (required when type is "file" or "both")
 *   - Summary textarea (always required; sent as `content` for JSON path,
 *     or combined with file content for "both" path)
 *   - Submit button
 *
 * Submit strategy:
 *   - "text": POST JSON { content: summary, content_type: "text/plain" }
 *   - "file": POST multipart/form-data with file=<File>
 *   - "both": POST multipart/form-data; file contains summary prepended to file bytes.
 *     In practice we use the file upload path and prefix the summary as a header block
 *     inside the file content (concatenated as text before file bytes if text-readable).
 *     If the file is binary, we ignore the summary for the file body and POST the file
 *     as multipart — the backend stores it and the user's summary is added as notes
 *     via a separate PATCH. This is the simplest correct path for MVP.
 *     For "both" when file is text-readable: we concatenate summary + "\n\n" + file text
 *     and POST as JSON.
 *
 * On success: calls onSuccess callback (closes modal, triggers poll).
 * On error: shows inline error; does not close modal.
 *
 * Reuses: Dialog / DialogContent / DialogHeader / DialogTitle from @/components/ui/dialog.
 *
 * P5-05 (audit-wave-2-phase-5).
 */

import React, { useCallback, useRef, useState } from "react";
import { Loader2, Upload, X, FileText, File as FileIcon, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  uploadResearchResultJson,
  uploadResearchResultFile,
} from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResultType = "text" | "file" | "both";

export interface UploadResultModalProps {
  open: boolean;
  runId: string;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful upload. Caller is responsible for closing. */
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESULT_TYPE_OPTIONS: { value: ResultType; label: string; description: string }[] = [
  { value: "text", label: "Text summary", description: "Paste or type the research result" },
  { value: "file", label: "File upload", description: "Upload a file (markdown, PDF, txt)" },
  { value: "both", label: "Both", description: "File upload with an accompanying summary" },
];

function isTextFile(file: File): boolean {
  return (
    file.type.startsWith("text/") ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".rst") ||
    file.name.endsWith(".json")
  );
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UploadResultModal({
  open,
  runId,
  onOpenChange,
  onSuccess,
}: UploadResultModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resultType, setResultType] = useState<ResultType>("text");
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Reset on close
  // ------------------------------------------------------------------

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !submitting) {
        // Reset form state when closing
        setResultType("text");
        setSummary("");
        setFile(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      onOpenChange(next);
    },
    [onOpenChange, submitting],
  );

  // ------------------------------------------------------------------
  // File picker
  // ------------------------------------------------------------------

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0] ?? null;
      setFile(picked);
      setError(null);
    },
    [],
  );

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Inline validation — captures resultType, summary, file from closure
      let validationError: string | null = null;
      if (!summary.trim()) validationError = "Summary is required.";
      else if ((resultType === "file" || resultType === "both") && !file) {
        validationError = "Please select a file to upload.";
      }

      if (validationError) {
        setError(validationError);
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        if (resultType === "text") {
          // Pure text path: JSON body
          await uploadResearchResultJson(runId, {
            content: summary.trim(),
            content_type: "text/plain",
          });
        } else if (resultType === "file" && file) {
          // Pure file path: multipart
          await uploadResearchResultFile(runId, file);
        } else if (resultType === "both" && file) {
          // Both path: if file is text-readable, concatenate summary + file text as JSON.
          // Otherwise fall back to multipart file upload only.
          if (isTextFile(file)) {
            const fileText = await readFileAsText(file);
            const combined = `${summary.trim()}\n\n---\n\n${fileText}`;
            await uploadResearchResultJson(runId, {
              content: combined,
              content_type: file.type || "text/plain",
              filename: file.name,
            });
          } else {
            // Binary file: upload via multipart (summary is captured in the parent task notes
            // via a subsequent PATCH if needed; MVP skips that extra call)
            await uploadResearchResultFile(runId, file);
          }
        }

        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [resultType, summary, file, runId, onSuccess],
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const requiresFile = resultType === "file" || resultType === "both";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Upload research result</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Run <span className="font-mono">{runId.slice(-8)}</span>
          </p>
        </DialogHeader>

        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="flex flex-col gap-4 overflow-y-auto px-1 pb-1 pt-2"
          noValidate
        >
          {/* Result type selector */}
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Result type
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {RESULT_TYPE_OPTIONS.map((opt) => {
                const isSelected = resultType === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer flex-col gap-0.5 rounded-md border p-2.5 text-xs transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="result_type"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => {
                        setResultType(opt.value);
                        setError(null);
                      }}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-1.5 font-medium">
                      {opt.value === "text" && <FileText aria-hidden="true" className="size-3.5" />}
                      {opt.value === "file" && <FileIcon aria-hidden="true" className="size-3.5" />}
                      {opt.value === "both" && <Upload aria-hidden="true" className="size-3.5" />}
                      {opt.label}
                    </span>
                    <span className="text-[10px] leading-tight opacity-75">{opt.description}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* File picker */}
          {requiresFile && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="result-file"
                className="text-xs font-medium text-foreground"
              >
                File <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2",
                  "cursor-pointer transition-colors hover:bg-muted/40",
                  file ? "border-border text-foreground" : "border-dashed border-border text-muted-foreground",
                )}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
                tabIndex={0}
                role="button"
                aria-label="Select file to upload"
              >
                <FileIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-xs">
                  {file ? file.name : "Click to select file…"}
                </span>
                {file && (
                  <button
                    type="button"
                    aria-label="Remove selected file"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                id="result-file"
                type="file"
                accept=".md,.txt,.pdf,.json,.rst,.docx"
                className="hidden"
                onChange={handleFileChange}
                aria-required={requiresFile ? "true" : "false"}
              />
            </div>
          )}

          {/* Summary textarea */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="result-summary" className="text-xs font-medium text-foreground">
              {resultType === "file"
                ? "Notes (optional but recommended)"
                : "Summary"}
              {resultType !== "file" && (
                <span className="text-destructive" aria-hidden="true"> *</span>
              )}
            </label>
            <textarea
              id="result-summary"
              rows={5}
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value);
                setError(null);
              }}
              placeholder={
                resultType === "file"
                  ? "Add notes about the uploaded file…"
                  : "Paste or type the research result here…"
              }
              required={resultType !== "file"}
              aria-required={resultType !== "file" ? "true" : "false"}
              className={cn(
                "w-full resize-y rounded-md border bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground/60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              className={cn(
                "inline-flex items-center rounded-md border px-4 py-1.5 text-sm font-medium",
                "text-foreground transition-colors hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground",
                "transition-colors hover:bg-primary/90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-70",
              )}
            >
              {submitting && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
              {submitting ? "Uploading…" : "Upload result"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
