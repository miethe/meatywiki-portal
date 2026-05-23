"use client";

import { useEffect, useState } from "react";

type PointerType = "coarse" | "fine";

/**
 * usePointerType — returns 'coarse' for touch/stylus devices and 'fine' for
 * mouse-driven devices. SSR-safe: defaults to 'fine' until hydrated.
 *
 * Subscribes to `(pointer: coarse)` media query and updates reactively when
 * the user switches input devices (e.g. laptop with touchscreen).
 */
export function usePointerType(): PointerType {
  const [pointerType, setPointerType] = useState<PointerType>("fine");

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");

    // Set initial value after mount
    setPointerType(mq.matches ? "coarse" : "fine");

    const handleChange = (e: MediaQueryListEvent) => {
      setPointerType(e.matches ? "coarse" : "fine");
    };

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  return pointerType;
}
