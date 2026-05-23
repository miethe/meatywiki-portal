'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the user has requested reduced motion via OS/browser settings.
 * SSR-safe: returns false when `window` is undefined (server render).
 * Listens for changes so the value stays in sync if the user toggles the setting.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mql.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }, []);

  return prefersReducedMotion;
}
