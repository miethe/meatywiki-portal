"use client";

/**
 * SegmentedControl — radio-style pill row for small enum sets.
 * Used by workspace, freshness_class, lifecycle_stage, status, verification_status.
 */

import { cn } from "@/lib/utils";

export interface SegmentOption {
  value: string;
  label: string;
  count?: number;
}

export interface SegmentedControlProps {
  /** Currently selected values (multi-select when allowMulti=true; single otherwise). */
  value: string[];
  onChange: (value: string[]) => void;
  options: SegmentOption[];
  /**
   * Allow multiple selections. Defaults to false (radio-style).
   * When false, selecting an already-selected value deselects it (→ empty = "all").
   */
  allowMulti?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl({
  value,
  onChange,
  options,
  allowMulti = false,
  disabled = false,
  className,
}: SegmentedControlProps) {
  const handleClick = (optValue: string) => {
    if (disabled) return;
    if (allowMulti) {
      if (value.includes(optValue)) {
        onChange(value.filter((v) => v !== optValue));
      } else {
        onChange([...value, optValue]);
      }
    } else {
      // Radio-style: toggle off if already selected
      onChange(value.includes(optValue) ? [] : [optValue]);
    }
  };

  return (
    <div
      role="group"
      className={cn("flex flex-wrap gap-1", className)}
    >
      {options.map((opt) => {
        const isActive = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => handleClick(opt.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
              "text-[11px] font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-40",
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={cn("text-[10px]", isActive ? "text-primary/70" : "text-muted-foreground/60")}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
