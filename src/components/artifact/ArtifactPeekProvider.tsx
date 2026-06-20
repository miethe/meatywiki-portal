"use client";

/**
 * ArtifactPeekProvider — context + deep-link wiring for the peek modal.
 *
 * Provides:
 *   - `useArtifactPeek()` context hook with { openPeek, closePeek, peekId }
 *   - Deep-link support via ?peek=<id> search param:
 *       • When the page loads with ?peek=<id>, the modal opens automatically.
 *       • When the modal closes, the param is removed via router.replace (no history entry).
 *       • When openPeek(id) is called, the param is added via router.push.
 *   - Lazy-loads <ArtifactPeekModal> via next/dynamic (client-only, no SSR).
 *
 * OQ-2 compliance: This provider does NOT intercept full-page artifact
 * navigation. It only responds to openPeek() calls (programmatic content-
 * context opens) and the ?peek= search param (deep-link opens). Explicit
 * <Link href="/artifact/:id"> clicks route normally.
 *
 * Usage:
 *   // Mount the provider once, high in the tree (e.g. (main) layout).
 *   <ArtifactPeekProvider>
 *     {children}
 *   </ArtifactPeekProvider>
 *
 *   // From any client component:
 *   const { openPeek } = useArtifactPeek();
 *   <button onClick={() => openPeek(artifactId)}>Preview</button>
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// Lazy-load the modal — never SSR, loaded on first open.
const ArtifactPeekModal = dynamic(
  () =>
    import("./ArtifactPeekModal").then((m) => ({ default: m.ArtifactPeekModal })),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ArtifactPeekContextValue {
  /** The artifact ID currently open in the peek modal, or null. */
  peekId: string | null;
  /**
   * Open the peek modal for `id`.
   * Adds ?peek=<id> to the URL (router.push → adds a history entry).
   * Pass `shallow?: false` to skip the URL update (e.g. programmatic auto-opens).
   */
  openPeek: (id: string, options?: { shallow?: boolean }) => void;
  /** Close the peek modal and remove ?peek from the URL. */
  closePeek: () => void;
}

const ArtifactPeekContext = React.createContext<ArtifactPeekContextValue | null>(
  null,
);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useArtifactPeek — access the peek modal context.
 *
 * Throws if called outside <ArtifactPeekProvider>.
 *
 * @example
 * const { openPeek, closePeek, peekId } = useArtifactPeek();
 * openPeek("abc-123");
 */
export function useArtifactPeek(): ArtifactPeekContextValue {
  const ctx = React.useContext(ArtifactPeekContext);
  if (!ctx) {
    throw new Error(
      "useArtifactPeek must be used inside <ArtifactPeekProvider>.",
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ArtifactPeekProviderProps {
  children: React.ReactNode;
}

/**
 * ArtifactPeekProvider — mount once in the app layout.
 *
 * Reads the ?peek= search param on mount and on navigation events to keep
 * the modal in sync with the URL. Uses useSearchParams (requires Suspense
 * boundary in the parent tree — Next.js App Router enforces this).
 *
 * The modal itself is rendered via a dynamic() import so it is never
 * included in the initial page bundle.
 */
export function ArtifactPeekProvider({ children }: ArtifactPeekProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL-derived peek ID (deep-link and router.push opens).
  const urlPeekId = searchParams.get("peek");

  // Local-state peek ID for shallow opens (programmatic, no URL update).
  // When both are set, URL takes precedence so closing via router.replace
  // also clears the modal.
  const [shallowPeekId, setShallowPeekId] = React.useState<string | null>(null);

  // Effective peek ID: URL param wins; shallow is the fallback.
  const peekId = urlPeekId ?? shallowPeekId;

  // Build a new URLSearchParams with ?peek= added.
  function buildPeekUrl(id: string): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("peek", id);
    return `?${params.toString()}`;
  }

  // Build a URLSearchParams with ?peek= removed.
  function buildCloseUrl(): string {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("peek");
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  const openPeek = React.useCallback(
    (id: string, options?: { shallow?: boolean }) => {
      if (options?.shallow === true) {
        // Shallow open: update local state only, no URL change.
        setShallowPeekId(id);
      } else {
        router.push(buildPeekUrl(id));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, searchParams],
  );

  const closePeek = React.useCallback(() => {
    // Clear shallow state regardless; replace URL to remove ?peek= if present.
    setShallowPeekId(null);
    router.replace(buildCloseUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams]);

  // When the URL param clears (e.g. user navigates back), also clear shallow
  // state so the two sources stay consistent.
  React.useEffect(() => {
    if (urlPeekId === null) {
      setShallowPeekId(null);
    }
  }, [urlPeekId]);

  const value = React.useMemo<ArtifactPeekContextValue>(
    () => ({ peekId, openPeek, closePeek }),
    [peekId, openPeek, closePeek],
  );

  return (
    <ArtifactPeekContext.Provider value={value}>
      {children}
      {/* Modal is rendered at provider level so it floats over any child page. */}
      <ArtifactPeekModal
        artifactId={peekId}
        open={peekId !== null}
        onClose={closePeek}
      />
    </ArtifactPeekContext.Provider>
  );
}
