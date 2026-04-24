"use client";

/**
 * FileDropZone — drag-and-drop / browse file selection zone for the Quick Add
 * modal's File upload tab (FE-01).
 *
 * Responsibilities:
 *   - HTML5 drag-and-drop target with highlighted drag-active state
 *   - Hidden <input type="file"> triggered by a visible "Browse files" button
 *   - File preview: name, human-readable size, MIME type, with a Remove button
 *   - Client-side validation: audio files ≤ 25 MB, all other files ≤ 10 MB
 *   - Inline error display on oversized file (does NOT call onFile)
 *   - Keyboard accessible; browse button is focusable
 *
 * Does NOT handle upload logic — that belongs to FE-02.
 */

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPT =
  "application/pdf,text/plain,text/markdown,text/csv,application/json," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "image/*";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_OTHER_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAudioMime(type: string): boolean {
  return type.startsWith("audio/");
}

function validateFile(file: File): string | null {
  const limit = isAudioMime(file.type) ? MAX_AUDIO_BYTES : MAX_OTHER_BYTES;
  if (file.size > limit) {
    const limitLabel = isAudioMime(file.type) ? "25 MB" : "10 MB";
    return `File is too large (${formatBytes(file.size)}). Maximum allowed size is ${limitLabel}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FileDropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileDropZone({ onFile, disabled = false, className }: FileDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Prevent default drag behaviour throughout
  const preventDefaults = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      preventDefaults(e);
      if (!disabled) setIsDragActive(true);
    },
    [disabled, preventDefaults],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      preventDefaults(e);
      if (!disabled) setIsDragActive(true);
    },
    [disabled, preventDefaults],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      preventDefaults(e);
      setIsDragActive(false);
    },
    [preventDefaults],
  );

  const processFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setSelectedFile(null);
        return;
      }
      setError(null);
      setSelectedFile(file);
      onFile(file);
    },
    [onFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      preventDefaults(e);
      setIsDragActive(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [disabled, preventDefaults, processFile],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so the same file can be re-selected after removing
      if (inputRef.current) inputRef.current.value = "";
    },
    [processFile],
  );

  const handleBrowseClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleRemove = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ---------------------------------------------------------------------------
  // Render: file preview state
  // ---------------------------------------------------------------------------

  if (selectedFile) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3",
          )}
        >
          {/* File icon */}
          <svg
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z"
            />
          </svg>

          {/* File details */}
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium text-foreground"
              title={selectedFile.name}
            >
              {selectedFile.name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatBytes(selectedFile.size)}
              {selectedFile.type ? (
                <span className="ml-2 font-mono">{selectedFile.type}</span>
              ) : null}
            </p>
          </div>

          {/* Remove button */}
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            aria-label={`Remove ${selectedFile.name}`}
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
              "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
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

        {/* Hidden input kept in DOM so user can re-select */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: drop zone state
  // ---------------------------------------------------------------------------

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
      />

      {/* Drop zone */}
      <div
        role="region"
        aria-label="File drop zone. Drag and drop a file here, or use the Browse button below."
        aria-disabled={disabled}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-8",
          "transition-colors",
          // Default state
          "border-border bg-background",
          // Drag-active state
          isDragActive && "border-primary bg-primary/5",
          // Disabled state
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {/* Upload icon */}
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-full",
            isDragActive ? "bg-primary/10" : "bg-muted",
            "transition-colors",
          )}
        >
          <svg
            aria-hidden="true"
            className={cn(
              "size-5 transition-colors",
              isDragActive ? "text-primary" : "text-muted-foreground",
            )}
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
        </div>

        {/* Copy */}
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? "Drop file here" : "Drag and drop a file"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            PDF, TXT, MD, CSV, JSON, DOCX, images &bull; max 10 MB (audio 25 MB)
          </p>
        </div>

        {/* Browse button */}
        <button
          type="button"
          onClick={handleBrowseClick}
          disabled={disabled}
          className={cn(
            "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium",
            "border border-input bg-background text-foreground",
            "transition-colors hover:bg-accent hover:text-accent-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          Browse files
        </button>
      </div>

      {/* Inline validation error */}
      {error && (
        <div
          role="alert"
          className={cn(
            "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2",
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
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}

export default FileDropZone;
