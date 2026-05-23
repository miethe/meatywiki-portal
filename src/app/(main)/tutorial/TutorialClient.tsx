"use client";

/**
 * TutorialClient — interactive layer for the /tutorial page.
 *
 * Layout:
 *   - Desktop (lg+): two-column flex — TutorialNav sticky aside (~208px) on the
 *     left, scrollable FlowCard grid on the right.
 *   - Mobile / tablet (<lg): single-column; TutorialNav hides itself via
 *     `hidden lg:block` on the component.
 *
 * Footer:
 *   - "Reset tutorial state" button clears all tour localStorage keys and shows
 *     a confirmation toast. A resetKey state bump forces FlowCards to re-mount
 *     so their CompletionBadge indicators reflect the cleared state immediately.
 *
 * WCAG 2.1 AA:
 *   - <main> landmark wraps the content area.
 *   - Page heading uses <h1>; flow cards use <h3> via FlowCard's article/h3.
 *   - Footer button has descriptive label and visible focus ring.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FlowCard } from "@/components/tutorial/FlowCard";
import { TutorialNav } from "@/components/tutorial/TutorialNav";
import { FLOW_CARDS } from "@/lib/copy/tutorial";
import InfoTooltip from "@/components/ui/info-tooltip";
import { TOOLTIP_COPY } from "@/lib/copy/tooltips";
import { resetAllTourState } from "@/lib/storage/tour-state";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Nav items derived from FLOW_CARDS — stable reference (module-level)
// ---------------------------------------------------------------------------

const NAV_ITEMS = FLOW_CARDS.map(({ id, title }) => ({ id, title }));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TutorialClient() {
  const { add: addToast } = useToast();
  const [resetKey, setResetKey] = useState(0);

  function handleReset() {
    resetAllTourState();
    setResetKey((k) => k + 1);
    addToast({ message: "Tutorial progress reset", type: "success" });
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* ------------------------------------------------------------------ */}
      {/* Page header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Tutorial</h1>
          <InfoTooltip
            content={TOOLTIP_COPY.tutorial.pageHeader}
            side="right"
            label="About this page"
            icon="info"
          />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Learn the key workflows in MeatyWiki
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Two-column body: sticky nav aside (lg+) | scrollable card grid      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-8 items-start">
        {/* Left sticky nav — hidden on mobile, visible lg+ */}
        <TutorialNav cards={NAV_ITEMS} />

        {/* Main content */}
        <main
          id="main-content"
          aria-label="Tutorial flows"
          className="flex-1 min-w-0"
        >
          <section
            aria-label="Flow cards"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {FLOW_CARDS.map((card) => (
              <FlowCard key={`${resetKey}-${card.id}`} {...card} />
            ))}
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Footer                                                           */}
          {/* ---------------------------------------------------------------- */}
          <footer className="mt-8 flex items-center gap-2 border-t pt-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              aria-label="Reset tutorial progress"
              className="text-muted-foreground"
            >
              Reset tutorial state
            </Button>
            <InfoTooltip
              content={TOOLTIP_COPY.tutorial.resetButton}
              side="top"
              label="About resetting tutorial state"
            />
          </footer>
        </main>
      </div>
    </div>
  );
}
