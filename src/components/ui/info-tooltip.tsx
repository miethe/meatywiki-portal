"use client";

import * as React from "react";
import { HelpCircle, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { usePointerType } from "@/hooks/use-pointer-type";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InfoTooltipProps {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  icon?: "help" | "info" | "question" | React.ReactNode;
  iconClassName?: string;
  label?: string;
  asChild?: boolean;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Icon resolver
// ---------------------------------------------------------------------------

function resolveIcon(
  icon: InfoTooltipProps["icon"],
  iconClassName?: string
): React.ReactNode {
  const cls = cn("h-3.5 w-3.5 text-muted-foreground", iconClassName);

  if (icon === undefined || icon === "help" || icon === "question") {
    return <HelpCircle className={cls} aria-hidden="true" />;
  }
  if (icon === "info") {
    return <Info className={cls} aria-hidden="true" />;
  }
  // ReactNode passthrough
  return icon;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InfoTooltip({
  content,
  side,
  align,
  delayDuration = 200,
  icon,
  iconClassName,
  label,
  asChild = false,
  children,
}: InfoTooltipProps) {
  const pointerType = usePointerType();
  const descId = React.useId();

  const iconNode = resolveIcon(icon, iconClassName);

  // Shared trigger: if asChild + children, render children as trigger.
  // Otherwise render a small focusable button holding the icon.
  const triggerContent =
    asChild && children ? (
      children
    ) : (
      <button
        type="button"
        aria-label={label ?? "More information"}
        className="inline-flex items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {iconNode}
      </button>
    );

  if (pointerType === "coarse") {
    // Touch devices: tap-to-open Popover
    return (
      <Popover>
        <PopoverTrigger asChild>{triggerContent}</PopoverTrigger>
        <PopoverContent
          id={descId}
          side={side}
          align={align}
          className="text-sm"
          aria-describedby={undefined}
        >
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  // Mouse/keyboard: hover/focus Tooltip
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{triggerContent}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
