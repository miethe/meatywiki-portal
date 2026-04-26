"use client";

/**
 * InlineTextField — single-line inline edit component.
 *
 * Display mode: renders `value` as text. On hover (when not disabled), shows
 * a pencil icon button with `aria-label={`Edit ${label}`}`. Clicking the
 * display text or the pencil enters edit mode.
 *
 * Edit mode: a focused `<input>` pre-populated with the current value.
 * - Enter → trims value; calls `onSave(trimmed)` if non-empty; stays in edit
 *   mode while the promise is pending; exits on resolution; stays in edit mode
 *   on rejection so the caller can surface a toast and the user can retry.
 * - Escape → calls `onCancel?.()` and returns to display mode.
 * - Empty trimmed value on Enter → ignored (keeps edit mode, no save called).
 *
 * Touch target: the display row is at minimum 44px tall (WCAG 2.5.5 AAA /
 * Apple HIG; best-practice for mobile).
 *
 * Props:
 *   value       — current persisted value (controlled)
 *   onSave      — async save handler; receives trimmed string
 *   onCancel    — optional; called when Escape is pressed
 *   label       — human-readable field name (used for aria-label)
 *   maxLength   — forwarded to <input>
 *   disabled    — removes all edit affordances
 *   placeholder — <input> placeholder text
 */

import React, { useCallback, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export type InlineTextFieldProps = {
  value: string;
  onSave: (v: string) => Promise<void>;
  onCancel?: () => void;
  label: string;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
};

export function InlineTextField({
  value,
  onSave,
  onCancel,
  label,
  maxLength,
  disabled = false,
  placeholder,
}: InlineTextFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Enter edit mode: sync draft to current persisted value, then focus input.
  const enterEdit = useCallback(() => {
    if (disabled || editing) return;
    setDraft(value);
    setEditing(true);
    // Focus is set via the autoFocus attribute on the input; this is a
    // belt-and-suspenders call for programmatic activation paths.
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [disabled, editing, value]);

  const exitEdit = useCallback(() => {
    setEditing(false);
    setSaving(false);
  }, []);

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      // Empty string — do not call onSave; keep edit mode.
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      exitEdit();
    } catch {
      // Stay in edit mode; let the caller surface a toast.
      setSaving(false);
    }
  }, [draft, onSave, exitEdit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
        exitEdit();
      }
    },
    [handleSave, onCancel, exitEdit],
  );

  // ---------------------------------------------------------------------------
  // Edit mode
  // ---------------------------------------------------------------------------
  if (editing) {
    return (
      <div className="flex min-h-[44px] w-full items-center">
        <input
          ref={inputRef}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={`Edit ${label}`}
          className={cn(
            "w-full rounded-sm border border-input bg-background px-2 py-1",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "transition-opacity",
          )}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Display mode
  // ---------------------------------------------------------------------------
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Edit ${label}`}
      onClick={disabled ? undefined : enterEdit}
      onKeyDown={
        disabled
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                enterEdit();
              }
            }
      }
      className={cn(
        "group relative flex min-h-[44px] w-full cursor-default items-center gap-2 rounded-sm px-2 py-1",
        !disabled && "cursor-pointer hover:bg-accent/50",
        disabled && "opacity-60",
      )}
    >
      <span className="flex-1 text-sm text-foreground">
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </span>

      {!disabled && (
        <button
          type="button"
          aria-label={`Edit ${label}`}
          tabIndex={-1}
          onClick={(e) => {
            // Prevent double-fire from the parent div's onClick.
            e.stopPropagation();
            enterEdit();
          }}
          className={cn(
            "shrink-0 rounded p-0.5 text-muted-foreground",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity focus-visible:opacity-100",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
