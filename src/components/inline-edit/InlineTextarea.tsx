"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export type InlineTextareaProps = {
  value: string;
  onSave: (v: string) => Promise<void>;
  onCancel?: () => void;
  label: string;
  maxLength?: number;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
};

/**
 * Inline textarea component for multi-line artifact field editing.
 *
 * Display mode: renders value with whitespace-pre-wrap; pencil icon on hover.
 * Edit mode: <textarea> focused with current value.
 *   - Enter (no Shift) → onSave(trimmed); empty string allowed.
 *   - Shift+Enter → inserts newline.
 *   - Escape → onCancel.
 *   - Auto-expands to content height via field-sizing:content + scrollHeight fallback.
 *   - On rejected save: stays in edit mode.
 *
 * 44pt minimum touch target on the display click region.
 */
export function InlineTextarea({
  value,
  onSave,
  onCancel,
  label,
  maxLength,
  disabled = false,
  rows = 3,
  placeholder,
}: InlineTextareaProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft with external value changes (e.g. optimistic rollback).
  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  // Auto-focus and size the textarea when entering edit mode.
  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      // Move cursor to end.
      el.setSelectionRange(el.value.length, el.value.length);
      adjustHeight(el);
    }
  }, [editing]);

  function adjustHeight(el: HTMLTextAreaElement) {
    // Prefer CSS field-sizing:content; if browser doesn't support it the
    // scrollHeight approach takes over.
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  const handleDisplayClick = useCallback(() => {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  }, [disabled, value]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch {
      // Stay in edit mode on rejection.
    } finally {
      setSaving(false);
    }
  }, [draft, onSave, saving]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setDraft(value);
    onCancel?.();
  }, [onCancel, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
      // Shift+Enter falls through to default textarea behaviour (newline).
    },
    [handleCancel, handleSave],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDraft(e.target.value);
      adjustHeight(e.target);
    },
    [],
  );

  if (editing) {
    return (
      <div className="relative w-full">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          rows={rows}
          placeholder={placeholder}
          disabled={saving}
          aria-label={label}
          className={cn(
            // field-sizing:content is the progressive-enhancement path;
            // the scrollHeight fallback in adjustHeight() handles older browsers.
            "[field-sizing:content]",
            "w-full resize-none rounded-md border border-input bg-background px-3 py-2",
            "text-sm leading-relaxed shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            "disabled:opacity-50",
            "transition-shadow duration-150",
          )}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Enter to save · Shift+Enter for newline · Esc to cancel
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDisplayClick}
      disabled={disabled}
      aria-label={`Edit ${label}`}
      className={cn(
        "group relative w-full min-h-[44px] rounded-md px-1 py-1 text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "hover:bg-muted/50 transition-colors duration-150",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span
        className={cn(
          "block whitespace-pre-wrap break-words text-sm leading-relaxed",
          !value && "text-muted-foreground italic",
        )}
      >
        {value || placeholder || <span className="sr-only">{label}</span>}
      </span>
      <Pencil
        className={cn(
          "absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground",
          "opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
        aria-hidden="true"
      />
    </button>
  );
}
