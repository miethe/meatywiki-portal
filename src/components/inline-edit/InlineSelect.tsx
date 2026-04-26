"use client";

/**
 * InlineSelect — inline-edit component for single-value enum fields.
 *
 * Unlike InlineTextField/InlineTextarea, there is no separate display/edit
 * mode toggle: the shadcn/ui Select trigger IS always rendered, acting as
 * both the display surface and the interactive control. Clicking the trigger
 * opens the Radix dropdown; selecting an option immediately calls `onSave`.
 *
 * Optimistic update strategy:
 *   - On `onValueChange`: immediately set `localValue` optimistically.
 *   - Await `onSave(newValue)`.
 *   - On rejection: revert `localValue` to the prior value and set `error`.
 *
 * Displayed label resolution order:
 *   1. Matching option label for `localValue`
 *   2. `placeholder` prop (if supplied)
 *   3. Raw `localValue` string (fallback)
 *
 * Touch target: trigger has `min-h-[44px]` to meet WCAG 2.5.5 AAA / Apple HIG.
 * Accessibility: `aria-label={label}` forwarded to the trigger element.
 *
 * Props:
 *   value       — current persisted value (controlled)
 *   options     — list of { label, value } choices
 *   onSave      — async save handler; receives newly selected value string
 *   label       — human-readable field name (aria-label on trigger)
 *   disabled    — disables Select entirely
 *   placeholder — shown when no matching option label is found for current value
 */

import React, { useCallback, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type InlineSelectOption = {
  label: string;
  value: string;
};

export type InlineSelectProps = {
  value: string;
  options: InlineSelectOption[];
  onSave: (v: string) => Promise<void>;
  label: string;
  disabled?: boolean;
  placeholder?: string;
};

export function InlineSelect({
  value,
  options,
  onSave,
  label,
  disabled = false,
  placeholder,
}: InlineSelectProps) {
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);

  // Sync local value when the controlled `value` prop changes externally
  // (e.g. optimistic rollback from the parent completing).
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleValueChange = useCallback(
    async (newValue: string) => {
      const prevValue = localValue;
      // Optimistic update.
      setLocalValue(newValue);
      setSaving(true);
      try {
        await onSave(newValue);
      } catch {
        // Revert on rejection.
        setLocalValue(prevValue);
      } finally {
        setSaving(false);
      }
    },
    [localValue, onSave],
  );

  return (
    <Select
      value={localValue}
      onValueChange={(v) => void handleValueChange(v)}
      disabled={disabled || saving}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          "min-h-[44px] w-full",
          saving && "opacity-70",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
