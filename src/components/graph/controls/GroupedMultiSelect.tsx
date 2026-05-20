"use client";

/**
 * GroupedMultiSelect — multi-select with inline search, grouped by category.
 * Used by: artifact_type (dim 2) — 27 types in 5 groups.
 *
 * Groups render as non-interactive headers; types inside are checkboxes.
 */

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface GroupedOption {
  value: string;
  label: string;
  count?: number;
}

export interface OptionGroup {
  groupLabel: string;
  options: GroupedOption[];
}

export interface GroupedMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  groups: OptionGroup[];
  disabled?: boolean;
  className?: string;
}

export function GroupedMultiSelect({
  value,
  onChange,
  groups,
  disabled = false,
  className,
}: GroupedMultiSelectProps) {
  const [query, setQuery] = useState("");

  const allValues = useMemo(
    () => groups.flatMap((g) => g.options.map((o) => o.value)),
    [groups],
  );

  const filteredGroups = useMemo(() => {
    if (!query) return groups;
    const q = query.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        options: g.options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.value.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  const allSelected = allValues.every((v) => value.includes(v));

  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  };

  const toggleGroup = (groupOptions: GroupedOption[]) => {
    const groupValues = groupOptions.map((o) => o.value);
    const allGroupSelected = groupValues.every((v) => value.includes(v));
    if (allGroupSelected) {
      onChange(value.filter((v) => !groupValues.includes(v)));
    } else {
      const next = new Set([...value, ...groupValues]);
      onChange([...next]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Search input */}
      <div className="relative">
        <Search aria-hidden="true" className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/60 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter types…"
          disabled={disabled}
          className={cn(
            "w-full rounded-md border border-input bg-background py-1 pl-7 pr-6 text-xs",
            "placeholder:text-muted-foreground/60",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Clear / select-all row */}
      <div className="flex items-center justify-between px-0.5">
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={clearAll}
          className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40 focus:outline-none"
        >
          Clear ({value.length})
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(allSelected ? [] : allValues)}
          className="text-[10px] text-muted-foreground hover:text-foreground focus:outline-none"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* Grouped list */}
      <div className="flex flex-col gap-0 max-h-52 overflow-y-auto rounded-md border bg-background">
        {filteredGroups.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground italic">No types match</p>
        ) : (
          filteredGroups.map((group) => {
            const groupValues = group.options.map((o) => o.value);
            const allGroupSelected = groupValues.every((v) => value.includes(v));
            return (
              <div key={group.groupLabel}>
                {/* Group header */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleGroup(group.options)}
                  className={cn(
                    "flex w-full items-center justify-between px-2 py-1.5",
                    "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
                    "hover:bg-accent hover:text-foreground transition-colors",
                    "sticky top-0 bg-background z-10 border-b border-border/50",
                  )}
                >
                  <span>{group.groupLabel}</span>
                  <span className={cn("text-[9px]", allGroupSelected ? "text-primary" : "text-muted-foreground/50")}>
                    {allGroupSelected ? "all" : `${groupValues.filter((v) => value.includes(v)).length}/${groupValues.length}`}
                  </span>
                </button>

                {/* Options */}
                {group.options.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-3 py-1 hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={value.includes(opt.value)}
                      disabled={disabled}
                      onCheckedChange={() => toggle(opt.value)}
                      aria-label={opt.label}
                    />
                    <span className="flex-1 text-[11px] text-foreground/80 truncate">{opt.label}</span>
                    {opt.count !== undefined && (
                      <span className="text-[10px] text-muted-foreground/60 tabular-nums">{opt.count}</span>
                    )}
                  </label>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
