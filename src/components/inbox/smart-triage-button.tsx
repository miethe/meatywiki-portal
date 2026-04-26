"use client";

/**
 * SmartTriageButton — routing recommendation wiring (P3-04).
 *
 * Renders an outline button with a Wand2 icon in the sidebar footer, below
 * Quick Add. On click, opens a dialog that fetches and displays the rule-based
 * routing recommendation for the given artifact (when artifactId is provided).
 *
 * When artifactId is omitted the dialog falls back to the original static
 * explainer copy (backward-compatible with callers that have no artifact context).
 *
 * Fetch lifecycle per open:
 *   - On dialog open: calls fetchRoutingRecommendation(artifactId)
 *   - Loading state: spinner replaces the body text
 *   - Success with template: renders the template as a suggestion chip + rationale
 *   - Success with null template: renders "No recommendation available"
 *   - ApiError 404: renders "No recommendation available"
 *   - Other errors: renders "Unable to load recommendation" (no crash)
 *   - Close + reopen: re-fetches (no stale cache beyond dialog lifecycle)
 *
 * Design: ghost/outline button sized to match the sidebar footer, full-width
 * in expanded sidebar, square icon-only in compact mode.
 * Dark-mode: inherits Tailwind CSS variable tokens — no hard-coded colours.
 *
 * Accessibility:
 *   - aria-label="Smart Triage" on the button trigger.
 *   - Modal: role="dialog", aria-modal="true", aria-labelledby wired via the
 *     shared Dialog primitive from @/components/ui/dialog.
 *   - "Got it" button auto-focuses on open (Dialog primitive handles focus trap).
 *   - Loading state announces via aria-live="polite".
 */

import { useEffect, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchRoutingRecommendation } from "@/lib/api/artifacts";
import type { RoutingRecommendation } from "@/lib/api/artifacts";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmartTriageButtonProps {
  /**
   * Artifact ID to fetch a routing recommendation for.
   * When omitted, the dialog shows static explainer copy.
   */
  artifactId?: string;
  /** When true, renders as square icon-only button (compact sidebar). */
  compact?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Fetch state
// ---------------------------------------------------------------------------

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: RoutingRecommendation }
  | { status: "not_found" }
  | { status: "error" };

// ---------------------------------------------------------------------------
// Modal content
// ---------------------------------------------------------------------------

function SmartTriageModal({
  open,
  onClose,
  artifactId,
}: {
  open: boolean;
  onClose: () => void;
  artifactId?: string;
}) {
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });

  // Re-fetch every time the dialog opens.
  useEffect(() => {
    if (!open || !artifactId) {
      setFetchState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setFetchState({ status: "loading" });

    fetchRoutingRecommendation(artifactId)
      .then((data) => {
        if (!cancelled) setFetchState({ status: "success", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setFetchState({ status: "not_found" });
        } else {
          setFetchState({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, artifactId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-6">
        <DialogHeader className="mb-4">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Wand2
              aria-hidden="true"
              className="size-5 text-primary"
            />
          </div>
          <DialogTitle>Smart Triage</DialogTitle>
        </DialogHeader>

        {/* Body — varies by fetch state */}
        <div aria-live="polite" className="mb-6 min-h-[3rem]">
          {/* No artifactId: original static copy */}
          {!artifactId && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Automated classification of inbox items is not yet available. For
              now, categorize items manually using the rail actions above, or tag
              them for later bulk processing.
            </p>
          )}

          {/* Loading */}
          {artifactId && fetchState.status === "loading" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin shrink-0"
              />
              <span>Loading recommendation…</span>
            </div>
          )}

          {/* Success — has a template */}
          {artifactId &&
            fetchState.status === "success" &&
            fetchState.data.template !== null && (
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Suggested route
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1",
                      "text-sm font-medium",
                      "bg-primary/10 text-primary",
                    )}
                  >
                    {fetchState.data.template}
                  </span>
                </div>
                {fetchState.data.rationale && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {fetchState.data.rationale}
                  </p>
                )}
              </div>
            )}

          {/* Success — no rule matched (null template) */}
          {artifactId &&
            fetchState.status === "success" &&
            fetchState.data.template === null && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                No recommendation available for this artifact.
              </p>
            )}

          {/* Not found (404) */}
          {artifactId && fetchState.status === "not_found" && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              No recommendation available for this artifact.
            </p>
          )}

          {/* Other error */}
          {artifactId && fetchState.status === "error" && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Unable to load recommendation.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Secondary: stub roadmap link */}
          <button
            type="button"
            onClick={() => {
              console.debug("[smart-triage] roadmap click");
              onClose();
            }}
            className={cn(
              "text-sm text-muted-foreground underline-offset-4",
              "hover:text-foreground hover:underline",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            View roadmap
          </button>

          {/* Primary: dismiss */}
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={cn(
              "inline-flex items-center justify-center rounded-md",
              "bg-primary px-4 py-2 text-sm font-medium text-primary-foreground",
              "transition-colors hover:bg-primary/90 active:bg-primary/80",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SmartTriageButton
// ---------------------------------------------------------------------------

export function SmartTriageButton({
  artifactId,
  compact = false,
  className,
}: SmartTriageButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Smart Triage"
        className={cn(
          // Base
          "inline-flex items-center justify-center rounded-md",
          "border border-border bg-transparent text-muted-foreground",
          "text-sm font-medium",
          "transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-primary",
          "active:bg-primary/10",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Layout variants
          compact
            ? "size-9 shrink-0 p-0"
            : "h-9 w-full gap-2 px-3",
          className,
        )}
      >
        <Wand2
          aria-hidden="true"
          className="size-4 shrink-0"
        />
        {!compact && <span>Smart Triage</span>}
      </button>

      <SmartTriageModal
        open={open}
        onClose={() => setOpen(false)}
        artifactId={artifactId}
      />
    </>
  );
}
