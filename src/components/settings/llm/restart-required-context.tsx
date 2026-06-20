"use client";

/**
 * RestartRequiredContext — shared state for the "restart required" banner.
 *
 * Set to true by usePatchModels or useTriggerReload when the backend
 * response carries restart_required=true. Consumed by the LLM Settings
 * layout to render a persistent banner until the user restarts the engine.
 *
 * Implementation note: this is a plain React Context (no Zustand) per
 * YAGNI; the state is scoped to the /settings/llm sub-route tree.
 *
 * Usage:
 *   // In the settings layout:
 *   <RestartRequiredProvider>…</RestartRequiredProvider>
 *
 *   // In any child component:
 *   const { restartRequired, setRestartRequired } = useRestartRequired();
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface RestartRequiredContextValue {
  restartRequired: boolean;
  setRestartRequired: (required: boolean) => void;
}

const RestartRequiredContext = createContext<RestartRequiredContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function RestartRequiredProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [restartRequired, setRestartRequiredState] = useState(false);

  const setRestartRequired = useCallback((required: boolean) => {
    setRestartRequiredState(required);
  }, []);

  const value = useMemo(
    () => ({ restartRequired, setRestartRequired }),
    [restartRequired, setRestartRequired],
  );

  return (
    <RestartRequiredContext.Provider value={value}>
      {children}
    </RestartRequiredContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Read and update the shared restartRequired flag.
 *
 * Must be called inside a <RestartRequiredProvider> tree — throws otherwise
 * to surface wiring errors early.
 */
export function useRestartRequired(): RestartRequiredContextValue {
  const ctx = useContext(RestartRequiredContext);
  if (ctx === null) {
    throw new Error(
      "useRestartRequired must be used within a <RestartRequiredProvider>",
    );
  }
  return ctx;
}
