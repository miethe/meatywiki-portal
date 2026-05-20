"use client";

/**
 * MultiSelectAutocomplete — typeahead multi-select pill input.
 * Used by: project, domain, tags.
 *
 * No cmdk / headlessui installed; built from scratch with native <input>
 * and a popover-style dropdown managed via focus/blur.
 */

import { useCallback, useId, useRef, useState } from "react";
import { X, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AutocompleteOption {
  value: string;
  label: string;
  count?: number;
}

export interface MultiSelectAutocompleteProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function MultiSelectAutocomplete({
  value,
  onChange,
  options,
  placeholder = "Search…",
  emptyMessage = "No options",
  disabled = false,
  className,
}: MultiSelectAutocompleteProps) {
  const inputId = useId();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = options.filter(
    (opt) =>
      !value.includes(opt.value) &&
      (query === "" || opt.label.toLowerCase().includes(query.toLowerCase())),
  );

  const select = useCallback(
    (v: string) => {
      onChange([...value, v]);
      setQuery("");
      inputRef.current?.focus();
    },
    [value, onChange],
  );

  const remove = useCallback(
    (v: string) => {
      onChange(value.filter((x) => x !== v));
    },
    [value, onChange],
  );

  const handleBlur = (e: React.FocusEvent) => {
    // Keep open if focus stays inside container
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  const selectedLabels = value.map(
    (v) => options.find((o) => o.value === v)?.label ?? v,
  );

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      onBlur={handleBlur}
    >
      {/* Selected pills */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {value.map((v, i) => (
            <span
              key={v}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-primary/30",
                "bg-primary/8 px-2 py-0.5 text-[11px] text-primary",
              )}
            >
              {selectedLabels[i]}
              <button
                type="button"
                aria-label={`Remove ${selectedLabels[i]}`}
                disabled={disabled}
                onClick={() => remove(v)}
                className="ml-0.5 rounded-full text-primary/60 hover:text-primary focus:outline-none"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative flex items-center">
        <Search aria-hidden="true" className="absolute left-2 size-3 text-muted-foreground/60 pointer-events-none" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={cn(
            "w-full rounded-md border border-input bg-background py-1 pl-7 pr-6 text-xs",
            "placeholder:text-muted-foreground/60",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "absolute right-2 size-3 text-muted-foreground/60 transition-transform pointer-events-none",
            open && "rotate-180",
          )}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className={cn(
            "absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md",
            "max-h-48 overflow-y-auto py-1",
          )}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground italic">
              {options.length === 0 ? "Loading…" : emptyMessage}
            </li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={false}
                onClick={() => select(opt.value)}
                onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span>{opt.label}</span>
                {opt.count !== undefined && (
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {opt.count}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
