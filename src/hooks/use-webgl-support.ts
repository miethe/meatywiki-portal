"use client";

/**
 * useWebGLSupport — detects WebGL2 availability and device capability for 3D mode.
 *
 * Tests two conditions on mount (client-only):
 *   1. WebGL2 availability — canvas.getContext('webgl2') returns null on iOS < 15,
 *      some Android WebViews, and Firefox ESR in certain configurations.
 *   2. Low-power device — navigator.hardwareConcurrency < 4 is a coarse proxy for
 *      devices that struggle with a continuous 60fps WebGL render loop. Tablets and
 *      entry-level phones commonly expose 2–4 cores.
 *
 * Returns:
 *   { supported: true }                         — 3D mode is safe to enable.
 *   { supported: false, reason: string }        — 3D mode should be disabled; reason
 *                                                 is a user-facing sentence for tooltip copy.
 *
 * SSR-safe: result defaults to { supported: true } until the effect runs, so the
 * toggle button renders enabled on first paint and only disables after hydration if
 * either condition fails. This prevents a flash-of-disabled-button on capable devices.
 *
 * Implements: MOBILE-002 (portal-v2.5-graph-immersive, Phase 6)
 */

import { useEffect, useState } from "react";

export interface WebGLSupportResult {
  supported: boolean;
  reason?: string;
}

export function useWebGLSupport(): WebGLSupportResult {
  // Default to supported — prevents flicker on capable devices during hydration.
  const [result, setResult] = useState<WebGLSupportResult>({ supported: true });

  useEffect(() => {
    // Test 1: WebGL2 context availability
    try {
      const testCanvas = document.createElement("canvas");
      const ctx = testCanvas.getContext("webgl2");
      if (!ctx) {
        setResult({
          supported: false,
          reason: "3D mode requires WebGL2, which is not available on this device or browser.",
        });
        return;
      }
    } catch {
      setResult({
        supported: false,
        reason: "3D mode requires WebGL2, which is not available on this device or browser.",
      });
      return;
    }

    // Test 2: Low-power device heuristic
    const cores = navigator.hardwareConcurrency;
    if (typeof cores === "number" && cores < 4) {
      setResult({
        supported: false,
        reason: "3D mode is disabled on low-power devices (fewer than 4 CPU cores detected).",
      });
      return;
    }

    setResult({ supported: true });
  }, []);

  return result;
}
