/**
 * PaletteProvider and usePalette hook for color-blind palette support.
 *
 * P5-08: Color-blind palette context provider.
 *
 * This module provides:
 * 1. PaletteProvider — wraps the graph page tree, manages palette state + localStorage sync.
 * 2. usePalette() — hook that returns the active ColorPalette object.
 * 3. usePaletteKey() — hook that returns the palette key + setter for toggle UI.
 *
 * Resilience contract:
 *   - If context is not available (early mount), surfaces render with default palette.
 *   - Palette swap (via setting context value) triggers re-render via React state.
 *   - No flicker beyond 1 React render frame (default palette rendered once, swaps on next tick).
 *   - localStorage write happens synchronously; read happens on provider mount.
 *
 * Usage:
 *   // In VaultGraphPageClient or parent:
 *   <PaletteProvider>
 *     <GraphComponent />
 *   </PaletteProvider>
 *
 *   // In any child component:
 *   const palette = usePalette();
 *   const [key, setKey] = usePaletteKey();
 *   // Toggle: setKey(key === 'default' ? 'colorblind' : 'default')
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import {
  getPalette,
  readPalettePreference,
  writePalettePreference,
  type ColorPalette,
  type PaletteKey,
} from "./palette";

// ---------------------------------------------------------------------------
// Context definition
// ---------------------------------------------------------------------------

interface PaletteContextValue {
  palette: ColorPalette;
  paletteKey: PaletteKey;
  setPaletteKey: Dispatch<SetStateAction<PaletteKey>>;
}

const PaletteContext = createContext<PaletteContextValue | undefined>(
  undefined,
);

// ---------------------------------------------------------------------------
// PaletteProvider component
// ---------------------------------------------------------------------------

interface PaletteProviderProps {
  children: ReactNode;
}

export function PaletteProvider({ children }: PaletteProviderProps) {
  const [paletteKey, setPaletteKey] = useState<PaletteKey>("default");
  const [mounted, setMounted] = useState(false);

  // Resilience: read localStorage on mount (client-side only)
  useEffect(() => {
    const stored = readPalettePreference();
    setPaletteKey(stored);
    setMounted(true);
  }, []);

  // Sync palette preference to localStorage when key changes
  useEffect(() => {
    if (!mounted) return; // Skip initial mount to avoid write before read
    writePalettePreference(paletteKey);
  }, [paletteKey, mounted]);

  const palette = getPalette(paletteKey);

  return (
    <PaletteContext.Provider
      value={{
        palette,
        paletteKey,
        setPaletteKey,
      }}
    >
      {children}
    </PaletteContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Get the current active palette.
 * Throws if called outside PaletteProvider.
 * Falls back to default palette if context is unavailable (resilience).
 */
export function usePalette(): ColorPalette {
  const context = useContext(PaletteContext);
  if (context === undefined) {
    // Fallback: return default palette without throwing.
    // This handles early mount / SSR edge cases gracefully.
    return getPalette("default");
  }
  return context.palette;
}

/**
 * Get the current palette key and a setter to change it.
 * Returns default key if context is unavailable.
 */
export function usePaletteKey(): [PaletteKey, (key: PaletteKey) => void] {
  const context = useContext(PaletteContext);
  if (context === undefined) {
    // Fallback: return default key with a no-op setter.
    return ["default", () => {}];
  }
  return [context.paletteKey, context.setPaletteKey];
}
