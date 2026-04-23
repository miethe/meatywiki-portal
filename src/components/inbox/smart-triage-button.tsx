"use client";

/**
 * SmartTriageButton — OQ-6 stub (P5-04).
 *
 * Renders an outline button with a Wand2 icon in the sidebar footer, below
 * Quick Add. On click, opens a lightweight "Coming in v1.6" explainer modal.
 *
 * No backend wiring. When v1.6 ships the real triage workflow, swap the
 * modal body for a route push or workflow-dispatch call.
 *
 * Design: ghost/outline button sized to match the sidebar footer, full-width
 * in expanded sidebar, square icon-only in compact mode.
 * Dark-mode: inherits Tailwind CSS variable tokens — no hard-coded colours.
 *
 * Accessibility:
 *   - aria-label="Smart Triage (coming in v1.6)" on the button trigger.
 *   - Modal: role="dialog", aria-modal="true", aria-labelledby wired via the
 *     shared Dialog primitive from @/components/ui/dialog.
 *   - "Got it" button auto-focuses on open (Dialog primitive handles focus trap).
 */

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmartTriageButtonProps {
  /** When true, renders as square icon-only button (compact sidebar). */
  compact?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Modal content
// ---------------------------------------------------------------------------

function SmartTriageModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
          <DialogTitle>Smart Triage — Coming in v1.6</DialogTitle>
        </DialogHeader>

        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          Automated classification of inbox items is on the v1.6 roadmap. For
          now, categorize items manually using the rail actions above, or tag
          them so v1.6 can re-process.
        </p>

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
            View v1.6 roadmap
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
  compact = false,
  className,
}: SmartTriageButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Smart Triage (coming in v1.6)"
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

      <SmartTriageModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
