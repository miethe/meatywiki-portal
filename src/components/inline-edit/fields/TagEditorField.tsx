"use client";

/**
 * TagEditorField — rich tag-chip inline editor bound to the site-wide tag list.
 *
 * Extends the existing InlineChipEditor pattern with:
 *   - Type-to-filter against useTagOptions() to surface matching existing tags.
 *   - A dropdown of existing tag suggestions shown as the user types.
 *   - A "create new" path: when the typed value does not match any existing tag,
 *     Enter still adds it (same as InlineChipEditor). This is the documented
 *     @miethe/ui gap — no creation UI exists in the primitive, so we inline a
 *     small local input with suggestion dropdown.
 *   - Tags are sent as a diff (tags_add / tags_remove) via the saveTags helper
 *     from useFieldEditSave so the ETag is preserved end-to-end.
 *   - Optimistic UI: chips appear/disappear immediately; the diff is computed
 *     against the *persisted* `currentTags` snapshot, then reversed on error.
 *   - Toast notifications are the caller's responsibility (via the `onSave`
 *     promise rejection).
 *
 * @miethe/ui gap note (documented):
 *   SearchableCombobox is designed for single-selection; it does not support
 *   multi-chip accumulation or create-new.  We therefore compose a local
 *   input + suggestion listbox rather than importing SearchableCombobox.
 *   This is the ONLY case where a local primitive is used instead of
 *   @miethe/ui per the P2-03 task spec.
 *
 * Props
 * -----
 *   currentTags  — current persisted tag array (controlled)
 *   onSave       — async (tagsAdd: string[], tagsRemove: string[]) => void
 *                  called with the full diff vs. the currentTags snapshot.
 *                  Caller assembles the saveTags(...) call.
 *   disabled     — disable all interactions
 *   label        — aria-label on the chip container
 *   placeholder  — placeholder for the add-tag input
 *
 * Option source: useTagOptions() → TagOption[] (name, count)
 * Save field:    "tags_add" / "tags_remove" via useFieldEditSave.saveTags
 *
 * Portal v2.6 Phase 2 (P2-03).
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTagOptions } from "@/hooks/useFieldOptions";
import type { TagOption } from "@/lib/api/field-options";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TagEditorFieldProps {
  /** Current persisted tags (controlled). */
  currentTags: string[];
  /**
   * Called with the full diff against the currentTags snapshot when the user
   * finalises a change (chip remove is immediate; chip add commits on blur /
   * Escape / dropdown selection).
   *
   * Re-throws on rejection — the component rolls back optimistic state.
   */
  onSave: (tagsAdd: string[], tagsRemove: string[]) => Promise<void>;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}

// ---------------------------------------------------------------------------
// Diff helper
// ---------------------------------------------------------------------------

function computeDiff(
  original: string[],
  current: string[],
): { add: string[]; remove: string[] } {
  const origSet = new Set(original.map((t) => t.toLowerCase()));
  const currSet = new Set(current.map((t) => t.toLowerCase()));

  // add: in current but not original
  const add = current.filter((t) => !origSet.has(t.toLowerCase()));
  // remove: in original but not current
  const remove = original.filter((t) => !currSet.has(t.toLowerCase()));

  return { add, remove };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagEditorField({
  currentTags,
  onSave,
  disabled = false,
  label = "Tags",
  placeholder = "Add tag…",
}: TagEditorFieldProps) {
  const { data: tagOptions } = useTagOptions();

  // ---- Local chip state (optimistic) -------------------------------------
  // Reset to the controlled `currentTags` whenever the prop changes from
  // outside (e.g. after a successful save commits the server response).
  const [chips, setChips] = useState<string[]>(currentTags);
  useEffect(() => {
    setChips(currentTags);
  }, [currentTags]);

  // ---- Input state -------------------------------------------------------
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- Filtered suggestion list ------------------------------------------
  const suggestions = useMemo<TagOption[]>(() => {
    const q = inputValue.trim().toLowerCase();
    if (!tagOptions) return [];
    const chipsLower = new Set(chips.map((c) => c.toLowerCase()));

    return tagOptions
      .filter(
        (opt) =>
          // Don't suggest already-added chips
          !chipsLower.has(opt.name.toLowerCase()) &&
          // Prefix / substring match (empty query = show all)
          (!q || opt.name.toLowerCase().includes(q)),
      )
      .slice(0, 12); // cap dropdown size
  }, [tagOptions, inputValue, chips]);

  // Whether the "create new" hint should be shown.
  const showCreateHint = useMemo(() => {
    const q = inputValue.trim();
    if (!q) return false;
    const chipsLower = new Set(chips.map((c) => c.toLowerCase()));
    const suggestNames = new Set(suggestions.map((s) => s.name.toLowerCase()));
    return !chipsLower.has(q.toLowerCase()) && !suggestNames.has(q.toLowerCase());
  }, [inputValue, chips, suggestions]);

  // Total dropdown entries (suggestions + optional create hint).
  const dropdownLength = suggestions.length + (showCreateHint ? 1 : 0);
  const showDropdown = isOpen && !disabled && (suggestions.length > 0 || showCreateHint);

  // Reset highlight when suggestions change.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  // Click-outside closes the dropdown.
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ---- Save helper --------------------------------------------------------
  const commitDiff = useCallback(
    async (nextChips: string[]) => {
      const { add, remove } = computeDiff(currentTags, nextChips);
      if (add.length === 0 && remove.length === 0) return;

      const snapshot = chips;
      setSaving(true);
      try {
        await onSave(add, remove);
      } catch {
        // Rollback on failure.
        setChips(snapshot);
      } finally {
        setSaving(false);
      }
    },
    [chips, currentTags, onSave],
  );

  // ---- Add chip -----------------------------------------------------------
  const addChip = useCallback(
    async (rawName: string) => {
      const name = rawName.trim();
      if (!name) return;
      if (chips.some((c) => c.toLowerCase() === name.toLowerCase())) {
        setInputValue("");
        setIsOpen(false);
        return;
      }
      const next = [...chips, name];
      setChips(next);
      setInputValue("");
      setIsOpen(false);
      await commitDiff(next);
    },
    [chips, commitDiff],
  );

  // ---- Remove chip --------------------------------------------------------
  const removeChip = useCallback(
    async (name: string) => {
      if (disabled) return;
      const next = chips.filter((c) => c !== name);
      setChips(next);
      await commitDiff(next);
    },
    [chips, commitDiff, disabled],
  );

  // ---- Input key handler --------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) =>
          prev < dropdownLength - 1 ? prev + 1 : 0,
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : dropdownLength - 1,
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < dropdownLength) {
          // Highlighted item selected.
          if (highlightedIndex < suggestions.length) {
            void addChip(suggestions[highlightedIndex].name);
          } else if (showCreateHint) {
            void addChip(inputValue.trim());
          }
        } else {
          // No highlight — add raw input value if present.
          if (inputValue.trim()) {
            void addChip(inputValue.trim());
          }
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        setInputValue("");
        inputRef.current?.blur();
        return;
      }
      // Backspace on empty input removes the last chip.
      if (e.key === "Backspace" && !inputValue) {
        if (chips.length > 0) {
          void removeChip(chips[chips.length - 1]);
        }
      }
    },
    [
      dropdownLength,
      highlightedIndex,
      suggestions,
      showCreateHint,
      inputValue,
      chips,
      addChip,
      removeChip,
    ],
  );

  // Unique IDs for ARIA listbox.
  const listboxId = useId();
  const getOptionId = (i: number) => `${listboxId}-opt-${i}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className="relative w-full"
    >
      {/* Chip + input container */}
      <div
        aria-label={label}
        className={cn(
          "flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-sm px-2 py-1.5",
          "border border-transparent transition-colors",
          !disabled && "hover:border-input focus-within:border-input",
          disabled && "opacity-60",
          saving && "opacity-70",
        )}
      >
        {chips.map((chip) => (
          <span key={chip} className="inline-flex min-h-[44px] items-center">
            <Badge
              variant="secondary"
              className="flex items-center gap-1 pr-0.5 text-xs"
            >
              <span>{chip}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${chip}`}
                  onClick={() => void removeChip(chip)}
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
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-activedescendant={
              highlightedIndex >= 0 && showDropdown
                ? getOptionId(highlightedIndex)
                : undefined
            }
            aria-autocomplete="list"
            aria-label={`Add ${label}`}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={saving}
            autoComplete="off"
            className={cn(
              "min-w-[80px] flex-1 bg-transparent text-xs text-foreground",
              "placeholder:text-muted-foreground",
              "focus:outline-none",
              "disabled:cursor-not-allowed",
            )}
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className={cn(
            "absolute z-50 mt-0.5 max-h-56 w-full overflow-auto",
            "rounded-md border border-border bg-popover text-popover-foreground shadow-md",
            "py-1",
          )}
        >
          {suggestions.map((opt, idx) => (
            <li
              key={opt.name}
              id={getOptionId(idx)}
              role="option"
              aria-selected={idx === highlightedIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                void addChip(opt.name);
              }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={cn(
                "flex cursor-pointer select-none items-center justify-between px-3 py-1.5 text-sm outline-none",
                idx === highlightedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50 hover:text-accent-foreground",
              )}
            >
              <span>{opt.name}</span>
              <span className="text-xs text-muted-foreground">{opt.count}</span>
            </li>
          ))}

          {showCreateHint && (
            <li
              id={getOptionId(suggestions.length)}
              role="option"
              aria-selected={highlightedIndex === suggestions.length}
              onMouseDown={(e) => {
                e.preventDefault();
                void addChip(inputValue.trim());
              }}
              onMouseEnter={() => setHighlightedIndex(suggestions.length)}
              className={cn(
                "flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 text-sm italic text-muted-foreground outline-none",
                highlightedIndex === suggestions.length
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50 hover:text-accent-foreground",
              )}
            >
              <span className="not-italic font-medium text-primary">+</span>
              <span>
                Create &ldquo;{inputValue.trim()}&rdquo;
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
