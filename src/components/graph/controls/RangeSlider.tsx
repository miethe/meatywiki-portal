"use client";

/**
 * RangeSlider — dual-handle range slider built from native HTML range inputs.
 * No @radix-ui/react-slider (not installed). Uses two overlapping <input type="range">
 * elements for the dual-handle behavior.
 *
 * Used by: freshness_score (0–1), classification_confidence (0–1), fidelity_level (0–4).
 */

import { useCallback, useId } from "react";
import { cn } from "@/lib/utils";

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  /** [minVal, maxVal] */
  value: [number, number];
  onChange: (value: [number, number]) => void;
  /** Optional label formatter. */
  formatLabel?: (v: number) => string;
  /** Optional track labels (rendered below the track). */
  trackLabels?: Array<{ position: number; label: string }>;
  disabled?: boolean;
  className?: string;
}

export function RangeSlider({
  min,
  max,
  step = 0.01,
  value,
  onChange,
  formatLabel,
  trackLabels,
  disabled = false,
  className,
}: RangeSliderProps) {
  const baseId = useId();
  const [low, high] = value;

  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  const handleLowChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Math.min(Number(e.target.value), high);
      onChange([next, high]);
    },
    [high, onChange],
  );

  const handleHighChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = Math.max(Number(e.target.value), low);
      onChange([low, next]);
    },
    [low, onChange],
  );

  const fmt = formatLabel ?? ((v: number) => v.toFixed(2));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Value labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{fmt(low)}</span>
        <span>{fmt(high)}</span>
      </div>

      {/* Track + dual thumb */}
      <div className="relative h-5 flex items-center">
        {/* Track fill */}
        <div
          className="absolute h-1.5 rounded-full bg-muted w-full"
          aria-hidden="true"
        />
        <div
          className="absolute h-1.5 rounded-full bg-primary"
          aria-hidden="true"
          style={{
            left: `${pct(low)}%`,
            width: `${pct(high) - pct(low)}%`,
          }}
        />

        {/* Low thumb */}
        <input
          id={`${baseId}-low`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          disabled={disabled}
          onChange={handleLowChange}
          aria-label="Minimum value"
          className={cn(
            "absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-primary",
            "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background",
            "[&::-webkit-slider-thumb]:shadow-sm",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />

        {/* High thumb */}
        <input
          id={`${baseId}-high`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          disabled={disabled}
          onChange={handleHighChange}
          aria-label="Maximum value"
          className={cn(
            "absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-primary",
            "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background",
            "[&::-webkit-slider-thumb]:shadow-sm",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      </div>

      {/* Optional track labels (e.g. F0 / F1 / F2 / F3 / F4) */}
      {trackLabels && trackLabels.length > 0 && (
        <div className="relative h-3" aria-hidden="true">
          {trackLabels.map(({ position, label }) => (
            <span
              key={label}
              className="absolute -translate-x-1/2 text-[9px] text-muted-foreground/70"
              style={{ left: `${pct(position)}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SingleRangeSlider — single-handle variant used by fidelity_level (min only).
 */
export interface SingleRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  formatLabel?: (v: number) => string;
  trackLabels?: Array<{ position: number; label: string }>;
  disabled?: boolean;
  className?: string;
}

export function SingleRangeSlider({
  min,
  max,
  step = 0.01,
  value,
  onChange,
  formatLabel,
  trackLabels,
  disabled = false,
  className,
}: SingleRangeSliderProps) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const fmt = formatLabel ?? ((v: number) => v.toFixed(2));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{fmt(value)}</span>
        <span className="text-muted-foreground/50">{fmt(max)}+</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute h-1.5 rounded-full bg-muted w-full" aria-hidden="true" />
        <div
          className="absolute h-1.5 rounded-full bg-primary"
          aria-hidden="true"
          style={{ left: 0, width: `${pct(value)}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Minimum value"
          className={cn(
            "absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-primary",
            "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background",
            "[&::-webkit-slider-thumb]:shadow-sm",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      </div>
      {trackLabels && trackLabels.length > 0 && (
        <div className="relative h-3" aria-hidden="true">
          {trackLabels.map(({ position, label }) => (
            <span
              key={label}
              className="absolute -translate-x-1/2 text-[9px] text-muted-foreground/70"
              style={{ left: `${pct(position)}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
