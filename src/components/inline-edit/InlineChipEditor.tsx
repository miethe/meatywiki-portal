"use client";

/**
 * InlineChipEditor — multi-chip (tag list) inline edit component.
 *
 * Renders existing values as shadcn/ui Badge chips, each with an × remove
 * button. A small add-input at the end lets the user append new chips by
 * typing and pressing Enter.
 *
 * Save semantics:
 *   - Chip removal: calls onSave immediately with the new list.
 *   - Chip addition: adds to local state (does NOT call onSave yet). Committing
 *     happens on blur or Escape of the add-input if the list differs from the
 *     initial `values` prop snapshot taken at mount / prop change.
 *
 * Dedup: new chips that match an existing chip (case-insensitive) are silently
 * dropped.
 *
 * Touch targets: chips and × buttons are at least 44 px tall (WCAG 2.5.5 AAA
 * / Apple HIG).
 *
 * On onSave rejection the local chips state is reverted to the snapshot that
 * existed before the failed call. The caller is responsible for showing a toast.
 *
 * Props:
 *   values      — current persisted chip list (controlled)
 *   onSave      — async handler; receives the full updated array
 *   label       — human-readable field name used for aria-label on container
 *   disabled    — blocks all add / remove interactions
 *   placeholder — placeholder text for the add input
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type InlineChipEditorProps = {
  values: string[];
  onSave: (updated: string[]) => Promise<void>;
  label: string;
  disabled?: boolean;
  placeholder?: string;
};

export function InlineChipEditor({
  values,
  onSave,
  label,
  disabled = false,
  placeholder = "Add…",
}: InlineChipEditorProps) {
  // Local chip list. Synced from `values` whenever the prop changes externally
  // (e.g., after a successful save upstream updates the parent state).
  const [chips, setChips] = useState<string[]>(values);
  const [inputValue, setInputValue] = useState("");

  // Keep chips in sync when `values` changes from outside.
  useEffect(() => {
    setChips(values);
  }, [values]);

  const inputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Remove chip — immediate save
  // ---------------------------------------------------------------------------
  const handleRemove = useCallback(
    async (chip: string) => {
      if (disabled) return;

      const snapshot = chips;
      const newList = chips.filter((c) => c !== chip);
      setChips(newList);

      try {
        await onSave(newList);
      } catch {
        // Revert to snapshot before this removal attempt.
        setChips(snapshot);
      }
    },
    [chips, disabled, onSave],
  );

  // ---------------------------------------------------------------------------
  // Add chip on Enter
  // ---------------------------------------------------------------------------
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) return;

        // Case-insensitive dedup.
        const alreadyExists = chips.some(
          (c) => c.toLowerCase() === trimmed.toLowerCase(),
        );
        if (alreadyExists) {
          setInputValue("");
          return;
        }

        setChips((prev) => [...prev, trimmed]);
        setInputValue("");
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        // Commit current chip list (same path as blur).
        commitIfChanged(chips);
        setInputValue("");
        inputRef.current?.blur();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputValue, chips],
  );

  // ---------------------------------------------------------------------------
  // Commit on blur (or Escape) if chips differ from initial prop snapshot.
  // ---------------------------------------------------------------------------
  const commitIfChanged = useCallback(
    (currentChips: string[]) => {
      const valuesKey = [...values].sort().join("\0");
      const currentKey = [...currentChips].sort().join("\0");
      if (valuesKey === currentKey) return;

      const snapshot = values;
      // Fire-and-forget; on reject, revert.
      void (async () => {
        try {
          await onSave(currentChips);
        } catch {
          setChips(snapshot);
        }
      })();
    },
    [values, onSave],
  );

  const handleBlur = useCallback(() => {
    // Capture chips synchronously at blur time (state update from Enter key
    // runs in the same React flush, so `chips` here reflects any chip added
    // immediately before the blur).
    commitIfChanged(chips);
  }, [chips, commitIfChanged]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      aria-label={label}
      className={cn(
        "flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-sm px-2 py-1.5",
        "border border-transparent transition-colors",
        !disabled && "hover:border-input focus-within:border-input",
        disabled && "opacity-60",
      )}
    >
      {chips.map((chip) => (
        <span
          key={chip}
          className="inline-flex min-h-[44px] items-center"
        >
          <Badge
            variant="secondary"
            className="flex items-center gap-1 pr-0.5 text-xs"
          >
            <span>{chip}</span>

            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                onClick={() => void handleRemove(chip)}
                className={cn(
                  "ml-0.5 flex min-h-[44px] min-w-[44px] items-center justify-center",
                  "rounded-sm text-muted-foreground",
                  "hover:text-foreground",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "transition-colors",
                )}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </Badge>
        </span>
      ))}

      {!disabled && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-label={`Add ${label}`}
          className={cn(
            "min-w-[80px] flex-1 bg-transparent text-xs text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none",
            "disabled:cursor-not-allowed",
          )}
        />
      )}
    </div>
  );
}
