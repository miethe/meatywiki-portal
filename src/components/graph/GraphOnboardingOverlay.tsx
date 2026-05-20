"use client";

/**
 * GraphOnboardingOverlay — first-visit hint overlay per interaction spec §15.
 *
 * Shown automatically when localStorage key "mw-graph-onboarded" is absent.
 * Dismissed via "Got it — start exploring" button which sets the key.
 * Re-openable via the [?] toolbar button (controlled mode).
 *
 * Uses the local Dialog component (src/components/ui/dialog.tsx):
 *   - Dialog requires onOpenChange: (open: boolean) => void (non-optional)
 *   - DialogTitle gets id from context; no id prop needed
 *   - No DialogDescription export; use aria-describedby on DialogContent
 *
 * P5-11: onboarding overlay + filter preset cards.
 */

import { useEffect, useId, useState } from "react";
import { Search, Crosshair, Filter, Move } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "mw-graph-onboarded";

// ---------------------------------------------------------------------------
// useOnboardingState — localStorage-gated open/close
// ---------------------------------------------------------------------------

export interface OnboardingState {
  open: boolean;
  openOverlay: () => void;
  dismissOverlay: () => void;
}

export function useOnboardingState(): OnboardingState {
  // Start closed to avoid SSR mismatch; check localStorage on mount.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable (SSR safety net)
    }
  }, []);

  const openOverlay = () => setOpen(true);

  const dismissOverlay = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore write failures (private browsing, quota, etc.)
    }
    setOpen(false);
  };

  return { open, openOverlay, dismissOverlay };
}

// ---------------------------------------------------------------------------
// Hint card data
// ---------------------------------------------------------------------------

interface HintCard {
  icon: React.ReactNode;
  label: string;
  body: string;
}

const HINT_CARDS: HintCard[] = [
  {
    icon: <Search aria-hidden="true" className="size-5 text-primary" />,
    label: "Search",
    body: "Press Cmd-K to search your entire vault by title",
  },
  {
    icon: <Crosshair aria-hidden="true" className="size-5 text-primary" />,
    label: "Focus",
    body: "Right-click any node to focus on its connections upstream or downstream",
  },
  {
    icon: <Filter aria-hidden="true" className="size-5 text-primary" />,
    label: "Filter",
    body: "Use the filter panel on the left to explore by workspace, type, or freshness",
  },
  {
    icon: <Move aria-hidden="true" className="size-5 text-primary" />,
    label: "Navigate",
    body: "Drag to pan, scroll to zoom, click a node to open it. Shift+drag to select multiple nodes.",
  },
];

// ---------------------------------------------------------------------------
// GraphOnboardingOverlay
// ---------------------------------------------------------------------------

export interface GraphOnboardingOverlayProps {
  /** Controlled open state. */
  open?: boolean;
  /** Called when the overlay requests an open/close state change. */
  onOpenChange?: (open: boolean) => void;
}

export function GraphOnboardingOverlay({
  open = false,
  onOpenChange,
}: GraphOnboardingOverlayProps) {
  const descId = useId();

  // Dialog.onOpenChange is required (non-optional), so provide a no-op fallback.
  const handleOpenChange = (next: boolean) => onOpenChange?.(next);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg p-0 overflow-hidden"
        aria-describedby={descId}
      >
        <div className="px-6 pt-6 pb-5">
          <DialogHeader className="mb-4">
            <DialogTitle>
              Welcome to your knowledge graph
            </DialogTitle>
            <p
              id={descId}
              className="text-sm text-muted-foreground mt-1"
            >
              Here are a few tips to get started exploring your vault.
            </p>
          </DialogHeader>

          {/* 2x2 hint card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {HINT_CARDS.map((card) => (
              <div
                key={card.label}
                className="flex items-start gap-3 rounded-lg border bg-muted/30 px-3 py-3"
              >
                <span className="shrink-0 mt-0.5">{card.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none mb-1">{card.label}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Dismiss button */}
          <Button
            onClick={() => handleOpenChange(false)}
            className="w-full"
          >
            Got it — start exploring
          </Button>

          {/* Footer note */}
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            You can always access these tips from the{" "}
            <span className="font-medium">[?]</span> button in the toolbar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
