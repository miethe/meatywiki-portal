"use client";

/**
 * EdgeTypeCheckboxList — checkbox list with a color swatch per edge type.
 * Used by: edge_type (dim 3).
 *
 * Reuses the existing Checkbox primitive from @/components/ui/checkbox.
 */

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface EdgeTypeOption {
  value: string;
  label: string;
  color: string;
  count?: number;
}

export interface EdgeTypeCheckboxListProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: EdgeTypeOption[];
  disabled?: boolean;
  className?: string;
}

export function EdgeTypeCheckboxList({
  value,
  onChange,
  options,
  disabled = false,
  className,
}: EdgeTypeCheckboxListProps) {
  const allSelected = options.every((o) => value.includes(o.value));

  const toggleAll = () => {
    onChange(allSelected ? [] : options.map((o) => o.value));
  };

  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  };

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {/* Select All row */}
      <label className="flex items-center gap-2 rounded px-1 py-1 hover:bg-accent cursor-pointer">
        <Checkbox
          checked={allSelected}
          disabled={disabled}
          onCheckedChange={toggleAll}
          aria-label="Select all edge types"
        />
        <span className="text-[11px] text-muted-foreground font-medium">All</span>
      </label>

      <div className="h-px bg-border mx-1 my-0.5" aria-hidden="true" />

      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-2 rounded px-1 py-1 hover:bg-accent cursor-pointer"
        >
          <Checkbox
            checked={value.includes(opt.value)}
            disabled={disabled}
            onCheckedChange={() => toggle(opt.value)}
            aria-label={`${opt.label} edges`}
          />

          {/* Color swatch */}
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: opt.color }}
          />

          <span className="flex-1 text-[11px] text-foreground/80 truncate">
            {opt.label}
          </span>

          {opt.count !== undefined && (
            <span className="text-[10px] text-muted-foreground/60 tabular-nums ml-auto">
              {opt.count}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
