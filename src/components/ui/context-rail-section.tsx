"use client";

/**
 * ContextRailSection — one titled section inside a ContextRail.
 *
 * Props are fully primitive; zero portal-domain imports (extraction-ready).
 *
 * Variants drive typography + spacing hints only — no semantic behavior
 * differences at this layer. Callers supply children as the body slot.
 *
 * Design spec §3, §4 (Context Rail sections).
 */

import React from "react";
import { cn } from "@/lib/utils";

export interface ContextRailSectionProps {
  title: string;
  variant: "properties" | "connections" | "actions" | "metrics" | "activity";
  dense?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const variantIconMap: Record<ContextRailSectionProps["variant"], string> = {
  properties: "Properties",
  connections: "Connections",
  actions: "Actions",
  metrics: "Metrics",
  activity: "Activity",
};

export function ContextRailSection({
  title,
  variant,
  dense = false,
  children,
  className,
}: ContextRailSectionProps) {
  // variant is surfaced as a data attribute so parent/CSS can target it
  // and for future icon mapping without coupling to an icon library here.
  return (
    <section
      data-variant={variant}
      aria-label={title ?? variantIconMap[variant]}
      className={cn("flex flex-col", dense ? "gap-1" : "gap-2", className)}
    >
      <h3
        className={cn(
          "text-[11px] font-medium uppercase tracking-wider",
          "text-muted-foreground select-none",
          dense ? "px-3 py-1" : "px-4 py-1.5"
        )}
      >
        {title}
      </h3>
      <div className={cn(dense ? "px-3 pb-2" : "px-4 pb-3")}>{children}</div>
    </section>
  );
}
