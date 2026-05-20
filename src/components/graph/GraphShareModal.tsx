"use client";

/**
 * GraphShareModal — share/copy-link modal for the vault graph.
 *
 * Displays the current full graph URL and a "Copy URL" button.
 * When URL > 1800 chars (ceiling guard triggered), shows the
 * localStorage-handoff warning per interaction spec §8.
 *
 * Implements: interaction spec §8, §16.
 * Task: P4-07 (share modal companion).
 */

import { useState, useEffect, useRef } from "react";

export interface GraphShareModalProps {
  open: boolean;
  onCloseAction: () => void;
  /** The full URL to share */
  url: string;
  /** Whether the ceiling guard was triggered (url > 1800 chars) */
  isCeilingGuardActive: boolean;
  /** Human-readable description of the current view state */
  viewDescription?: string;
}

export function GraphShareModal({
  open,
  onCloseAction,
  url,
  isCeilingGuardActive,
  viewDescription,
}: GraphShareModalProps) {
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: focus close button when dialog opens
  useEffect(() => {
    if (open) {
      setCopied(false);
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [open]);

  // Escape closes dialog
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseAction();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCloseAction]);

  if (!open) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (non-secure context) — silent failure.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onCloseAction}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border bg-popover p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="share-modal-title" className="text-base font-semibold text-foreground">
              Share this graph view
            </h2>
            {viewDescription && (
              <p className="mt-0.5 text-sm text-muted-foreground">{viewDescription}</p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close share dialog"
            onClick={onCloseAction}
            className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isCeilingGuardActive ? (
          // Ceiling guard: URL too complex
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-medium">This view is too complex to share via URL.</p>
            <p className="mt-1 text-xs">
              The recipient must open this link on the same device, or save the view manually using
              the Views panel.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {/* URL display */}
            <div className="rounded-md border bg-muted/50 px-3 py-2">
              <p className="break-all text-xs font-mono text-foreground/80 select-all">
                {url}
              </p>
            </div>

            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? (
                <>
                  <svg aria-hidden="true" className="size-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy URL
                </>
              )}
            </button>
          </div>
        )}

        {/* Warning */}
        <p className="mt-4 text-[11px] text-muted-foreground/70">
          ⚠ Recipient must be logged in to view. View positions are approximate — layout may vary if
          the vault has changed since this link was saved.
        </p>
      </div>
    </div>
  );
}
