"use client";

/**
 * DateRangePicker — dual date input for "from" / "to" ranges.
 * Built from native <input type="date"> (no react-day-picker dependency).
 * Used by: date_range (dim 7) — created and updated sub-ranges.
 */

import { cn } from "@/lib/utils";

export interface DateRangeValue {
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  label: string;
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  disabled?: boolean;
  className?: string;
}

export function DateRangePicker({
  label,
  value,
  onChange,
  disabled = false,
  className,
}: DateRangePickerProps) {
  return (
    <fieldset className={cn("flex flex-col gap-1.5 border-0 p-0", className)}>
      <legend className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </legend>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-6 shrink-0">From</span>
          <input
            type="date"
            value={value.from}
            max={value.to || undefined}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={cn(
              "flex-1 rounded border border-input bg-background px-2 py-1 text-[11px]",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-6 shrink-0">To</span>
          <input
            type="date"
            value={value.to}
            min={value.from || undefined}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className={cn(
              "flex-1 rounded border border-input bg-background px-2 py-1 text-[11px]",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
        </div>
      </div>
    </fieldset>
  );
}
