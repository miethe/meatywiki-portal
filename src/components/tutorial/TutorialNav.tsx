"use client";

/**
 * TutorialNav — sticky side navigation for the /tutorial page.
 *
 * Renders an anchor list that scrolls to each FlowCard by id.
 * Active anchor is tracked via IntersectionObserver.
 *
 * Visibility:
 *   - Hidden on mobile (< lg breakpoint) — the card list is linear enough
 *     that a jump-nav would add clutter. A future enhancement could add a
 *     floating "back to top" on mobile instead.
 *   - Shown as a sticky left-column on lg+.
 *
 * WCAG 2.1 AA:
 *   - nav landmark with aria-label
 *   - active link marked with aria-current="location"
 *   - keyboard-navigable (standard anchor links)
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TutorialNavItem {
  id: string;
  title: string;
}

interface TutorialNavProps {
  cards: TutorialNavItem[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TutorialNav({ cards, className }: TutorialNavProps) {
  const [activeId, setActiveId] = useState<string | null>(cards[0]?.id ?? null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (cards.length === 0) return;

    // Track which section is most prominently visible.
    // threshold: element must be at least 20% in view before becoming active.
    const entries = new Map<string, number>();

    observerRef.current = new IntersectionObserver(
      (intersectionEntries) => {
        for (const entry of intersectionEntries) {
          entries.set(entry.target.id, entry.intersectionRatio);
        }
        // Pick the id with the highest ratio (most in view).
        let topId: string | null = null;
        let topRatio = 0;
        for (const [id, ratio] of entries.entries()) {
          if (ratio > topRatio) {
            topRatio = ratio;
            topId = id;
          }
        }
        if (topId) setActiveId(topId);
      },
      {
        rootMargin: "-10% 0px -60% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
      },
    );

    const targets = cards.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    for (const el of targets) {
      observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [cards]);

  if (cards.length === 0) return null;

  return (
    <nav
      aria-label="Tutorial sections"
      className={cn(
        // Hidden on mobile/tablet, sticky sidebar on desktop
        "hidden lg:block",
        "sticky top-6 self-start",
        "w-52 shrink-0",
        className,
      )}
    >
      <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ol className="flex flex-col gap-0.5" role="list">
        {cards.map(({ id, title }) => {
          const isActive = activeId === id;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
                onClick={(e) => {
                  // Smooth-scroll polyfill for browsers without native support.
                  e.preventDefault();
                  const target = document.getElementById(id);
                  if (target) {
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                    // Update active immediately so the user sees feedback.
                    setActiveId(id);
                  }
                }}
              >
                {title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
