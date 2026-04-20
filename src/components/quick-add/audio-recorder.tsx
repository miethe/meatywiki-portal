"use client";

/**
 * AudioRecorder — MediaRecorder-based mic capture component for Quick Add.
 *
 * Renders a mic button (Mic / Square toggle). On click:
 *   1. Requests navigator.mediaDevices.getUserMedia({ audio: true })
 *   2. Starts a MediaRecorder with the best supported MIME type
 *   3. Shows a pulsing red indicator + elapsed mm:ss while recording
 *   4. On stop, validates size < 25 MB and calls onRecorded(blob, mimeType)
 *
 * MIME preference order:
 *   audio/webm;codecs=opus → audio/webm → audio/ogg → audio/mp4 → audio/wav
 *
 * Browser support guard: if MediaRecorder or getUserMedia is unavailable
 * (insecure context, old Safari), the mic button is rendered disabled with
 * an aria-description explaining the limitation.
 *
 * Props:
 *   onRecorded(blob, mimeType) — called when recording completes successfully
 *   onError(message)           — called on permission denial or size exceeded
 *   disabled                   — external disable (e.g. while submitting)
 *
 * Clean-up: all MediaStream tracks are stopped on unmount or component close.
 *
 * Traces FR-1.5-16 (P4-03).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum audio blob size in bytes (25 MB). */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** MIME types tried in order of preference. */
const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/wav",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick the first supported MIME type for MediaRecorder; falls back to "". */
function chooseMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

/** Detect whether audio capture is available at all in this context. */
function isAudioAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/** Format elapsed seconds as mm:ss. */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AudioRecorderProps {
  /** Called when a recording is successfully completed and validated. */
  onRecorded: (blob: Blob, mimeType: string) => void;
  /** Called when an unrecoverable error occurs (permission denied, size exceeded). */
  onError: (message: string) => void;
  /** External disable — prevents starting a new recording while e.g. submitting. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type RecordingState = "idle" | "recording" | "error";

export function AudioRecorder({ onRecorded, onError, disabled = false }: AudioRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const streamRef    = useRef<MediaStream | null>(null);
  const recorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef    = useRef<Blob[]>([]);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioSupported = isAudioAvailable();

  // ---------------------------------------------------------------------------
  // Clean-up on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Stream helpers
  // ---------------------------------------------------------------------------

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function stopTimer() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Start recording
  // ---------------------------------------------------------------------------

  const startRecording = useCallback(async () => {
    setInlineError(null);
    setElapsed(0);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      const msg = "Microphone access denied — please allow microphone permission in your browser settings.";
      setInlineError(msg);
      setRecordingState("error");
      onError(msg);
      return;
    }

    streamRef.current = stream;

    const mimeType = chooseMimeType();
    const recorderOptions = mimeType ? { mimeType } : {};
    const recorder = new MediaRecorder(stream, recorderOptions);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      stopStream();
      stopTimer();

      const effectiveMime = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: effectiveMime });

      if (blob.size > MAX_AUDIO_BYTES) {
        const msg = "Audio exceeds 25 MB limit — please record a shorter clip.";
        setInlineError(msg);
        setRecordingState("error");
        onError(msg);
        return;
      }

      setRecordingState("idle");
      onRecorded(blob, effectiveMime);
    };

    recorder.start(250); // collect chunks every 250 ms
    setRecordingState("recording");

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, [onRecorded, onError]);

  // ---------------------------------------------------------------------------
  // Stop recording
  // ---------------------------------------------------------------------------

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Toggle
  // ---------------------------------------------------------------------------

  function handleToggle() {
    if (recordingState === "recording") {
      stopRecording();
    } else {
      void startRecording();
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isRecording = recordingState === "recording";

  // Unsupported browser — render disabled mic with tooltip
  if (!audioSupported) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-describedby="audio-unsupported-desc"
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-full",
            "border border-input bg-muted text-muted-foreground",
            "opacity-50 cursor-not-allowed",
          )}
        >
          <MicIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">Record audio (unavailable)</span>
        </button>
        <span
          id="audio-unsupported-desc"
          className="text-xs text-muted-foreground"
        >
          Audio recording not supported in this browser.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {/* Mic / Stop toggle button */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled && !isRecording}
          aria-label={isRecording ? "Stop recording" : "Start audio recording"}
          aria-pressed={isRecording}
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-full",
            "border transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isRecording
              ? "border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20"
              : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
            (disabled && !isRecording) && "opacity-50 cursor-not-allowed pointer-events-none",
          )}
        >
          {isRecording ? (
            <SquareIcon className="size-4" aria-hidden="true" />
          ) : (
            <MicIcon className="size-4" aria-hidden="true" />
          )}
        </button>

        {/* Recording indicator */}
        {isRecording && (
          <div
            role="status"
            aria-live="polite"
            aria-label={`Recording — ${formatDuration(elapsed)} elapsed`}
            className="flex items-center gap-2"
          >
            {/* Pulsing red dot */}
            <span
              aria-hidden="true"
              className="relative inline-flex size-2.5 rounded-full bg-destructive"
            >
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
            </span>
            <span className="font-mono text-sm tabular-nums text-destructive">
              {formatDuration(elapsed)}
            </span>
            <span className="text-xs text-muted-foreground">Recording…</span>
          </div>
        )}

        {/* Idle label */}
        {!isRecording && recordingState !== "error" && (
          <span className="text-sm text-muted-foreground">
            Tap to record audio
          </span>
        )}
      </div>

      {/* Inline error */}
      {inlineError && (
        <div
          role="alert"
          className={cn(
            "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2",
            "flex items-start gap-2",
          )}
        >
          <AlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm text-destructive">{inlineError}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons (no new deps — reuse pattern from existing components)
// ---------------------------------------------------------------------------

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 10a7 7 0 01-14 0M12 19v3M8 22h8"
      />
    </svg>
  );
}

function SquareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}
