"use client";
import { useEffect, useRef, useState } from "react";
import { ANIMATION_TIMINGS } from "@/lib/graph/animationTimings";

/**
 * useAnimationBudget — tracks rolling RAF frame duration and exposes a
 * `slowFrame` flag that becomes true when recent frames exceeded the
 * performance-guard threshold (default 33ms ≈ <30fps). Consumers should
 * skip non-essential animations when `slowFrame` is true, degrading to
 * instant setState() calls instead of camera.animate().
 *
 * Uses a 10-frame rolling window; flag flips when the median frame time
 * exceeds the threshold. The median is used (rather than max) to avoid
 * false positives from single-frame GC spikes.
 *
 * Corresponds to interaction spec §12 "Performance guard fallback" row:
 * >33ms frame → instant (animate→setState).
 */
export interface AnimationBudget {
  /** True when the rolling-window median frame time exceeds the threshold. */
  slowFrame: boolean;
  /** Duration of the most recent RAF frame in milliseconds. */
  lastFrameMs: number;
}

export function useAnimationBudget(
  thresholdMs: number = ANIMATION_TIMINGS.performanceGuardThresholdMs,
): AnimationBudget {
  const [slowFrame, setSlowFrame] = useState(false);
  // Use a ref for lastFrameMs to avoid re-render on every frame; callers can
  // read it via the returned object snapshot (only updated when slowFrame flips).
  const lastFrameMsRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let raf = 0;
    let prev = performance.now();
    const window10: number[] = [];

    const tick = () => {
      const now = performance.now();
      const delta = now - prev;
      prev = now;
      lastFrameMsRef.current = delta;

      window10.push(delta);
      if (window10.length > 10) window10.shift();

      const sorted = [...window10].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      const isSlow = median > thresholdMs;

      // Only call setState when the flag actually flips to avoid render storms.
      setSlowFrame((prev) => (prev !== isSlow ? isSlow : prev));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [thresholdMs]);

  return { slowFrame, lastFrameMs: lastFrameMsRef.current };
}
