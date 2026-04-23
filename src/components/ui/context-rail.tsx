"use client";

/**
 * ContextRail — fixed-width right-column rail for contextual content.
 *
 * Responsive behavior (OQ-4 resolution):
 *   - ≥1280px: always visible, width = `width` prop (280 | 320px).
 *   - <1280px:  hidden by default; shown when `isOpen` from
 *               `useContextRailToggle()` is true. Top bar wires the toggle
 *               button in later phases — this component does NOT modify the
 *               top bar.
 *
 * Collapse is handled via CSS classes so no JS is needed on desktop:
 *   hidden xl:block  — base hidden, visible at xl breakpoint
 *   combined with isOpen to allow manual override on mobile.
 *
 * ARIA: <aside role="complementary"> per WCAG landmark guidance.
 *
 * Extraction-ready: zero portal-domain imports; all props are primitives.
 *
 * Design spec §3, §4, §6.1 — Context Rail tokens.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useContextRailToggle } from "@/components/ui/context-rail-context";
import type { ContextRailSectionProps } from "@/components/ui/context-rail-section";
import { ContextRailSection } from "@/components/ui/context-rail-section";

export type { ContextRailSectionProps };

export interface RailSection {
  id: string;
  title: string;
  variant: ContextRailSectionProps["variant"];
  content: React.ReactNode;
  dense?: boolean;
}

export interface ContextRailProps {
  title?: string;
  sections: RailSection[];
  /** Allow collapsing on <1280px. Default true. */
  collapsible?: boolean;
  /** Rail width in px. Default 320. */
  width?: 280 | 320;
  className?: string;
}

export function ContextRail({
  title,
  sections,
  collapsible = true,
  width = 320,
  className,
}: ContextRailProps) {
  const { isOpen } = useContextRailToggle();

  // Width utility: 320 → w-rail (var(--portal-rail-width) = 20rem)
  //                280 → w-rail-compact (var(--portal-rail-width-compact) = 17.5rem)
  const widthClass = width === 280 ? "w-rail-compact" : "w-rail";

  // Visibility logic:
  //   - Always visible at xl (≥1280px) — xl:block
  //   - Below xl: hidden unless collapsible=false OR isOpen=true
  const visibilityClass = collapsible
    ? cn("hidden xl:block", isOpen && "block")
    : "block";

  return (
    <aside
      role="complementary"
      aria-label={title ?? "Context rail"}
      className={cn(
        // Layout
        "flex flex-col shrink-0 h-full",
        widthClass,
        // Surface — uses portal-bg-rail token (slightly elevated)
        "bg-[hsl(var(--portal-bg-rail))]",
        // Border separation from main content
        "border-l border-border",
        // Responsive visibility
        visibilityClass,
        className
      )}
    >
      {/* Optional eyebrow title */}
      {title && (
        <>
          <div className="flex items-center px-4 h-11 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground select-none">
              {title}
            </span>
          </div>
          <Separator />
        </>
      )}

      {/* Scrollable section body */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-2">
          {sections.map((section, index) => (
            <React.Fragment key={section.id}>
              <ContextRailSection
                title={section.title}
                variant={section.variant}
                dense={section.dense}
              >
                {section.content}
              </ContextRailSection>
              {index < sections.length - 1 && (
                <Separator className="my-1 mx-4 w-auto" />
              )}
            </React.Fragment>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
