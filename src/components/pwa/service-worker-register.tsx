"use client";

/**
 * ServiceWorkerRegister — registers /sw.js on mount when PWA is enabled.
 *
 * Feature flag: NEXT_PUBLIC_PORTAL_ENABLE_PWA
 *   Set to "1" to enable. Mirrors backend PORTAL_ENABLE_PWA=1.
 *   Off by default — no install prompts or SW registration in dev unless
 *   explicitly opted in.
 *
 * Guard conditions (all must pass):
 *   1. NEXT_PUBLIC_PORTAL_ENABLE_PWA === "1"
 *   2. typeof navigator !== "undefined" (SSR safety)
 *   3. navigator.serviceWorker is a truthy object (browser support check)
 *   4. Secure context: https OR hostname is localhost / 127.0.0.1
 *      (SW API is restricted to secure origins; localhost is exempted by spec)
 *
 * The component renders nothing — it is a side-effect-only shell.
 * Mount it once near the root (layout.tsx) alongside other providers.
 *
 * Traces FR-1.5-15 (PWA manifest + SW registration).
 * P4-01 — initial skeleton.
 */

import { useEffect } from "react";

/** Allowed insecure origins (spec-exempted secure contexts). */
const ALLOWED_INSECURE_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/** Returns true when the current page origin qualifies for SW registration. */
function isSecureEnoughForSW(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  return ALLOWED_INSECURE_HOSTNAMES.has(window.location.hostname);
}

export function ServiceWorkerRegister(): null {
  useEffect(() => {
    // Guard 1: feature flag
    if (process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA !== "1") {
      return;
    }

    // Guard 2: SSR safety (belt-and-suspenders; useEffect only runs client-side)
    if (typeof navigator === "undefined") return;

    // Guard 3: browser support — check truthiness, not just key presence.
    // Some environments (jsdom, older browsers) define the key but return
    // undefined; a truthy check correctly gates both cases.
    if (!navigator.serviceWorker) {
      console.info("[PWA] Service workers not supported in this browser.");
      return;
    }

    // Guard 4: secure context (HTTPS or localhost)
    if (!isSecureEnoughForSW()) {
      console.warn(
        "[PWA] Service worker registration skipped: not a secure context " +
          "(requires HTTPS or localhost). " +
          "Set NEXT_PUBLIC_PORTAL_ENABLE_PWA=1 only on secure origins."
      );
      return;
    }

    // Register the service worker after the page has loaded to avoid
    // competing with page resource fetches on first load.
    const register = (): void => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.info(
            "[PWA] Service worker registered. Scope:",
            registration.scope
          );

          // Listen for SW updates — the SW sends SKIP_WAITING on demand.
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;

            installing.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // A new SW is waiting; the page can prompt the user to refresh.
                // P4-05: wire up a toast/banner here if desired.
                console.info("[PWA] New service worker available.");
              }
            });
          });
        })
        .catch((err: unknown) => {
          console.error("[PWA] Service worker registration failed:", err);
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  // Renders nothing — side-effect only.
  return null;
}
