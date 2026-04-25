import React from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Test render utilities for MeatyWiki Portal.
 *
 * `renderWithProviders` wraps the component under test with all app-level
 * context providers: QueryClientProvider (TanStack Query).
 *
 * Usage:
 *
 *   import { renderWithProviders } from "../utils/render";
 *
 *   const { getByRole } = renderWithProviders(<MyComponent />);
 *
 * To wrap with additional providers per-test, use the `wrapper` option:
 *
 *   renderWithProviders(<MyComponent />, {
 *     wrapper: ({ children }) => <SomeProvider>{children}</SomeProvider>,
 *   });
 */

// ---------------------------------------------------------------------------
// Provider wrappers
// ---------------------------------------------------------------------------

/**
 * Root wrapper applied to every renderWithProviders call.
 *
 * Includes:
 * - QueryClientProvider (TanStack Query v5) with a fresh per-render client
 *   (retries disabled so tests fail fast; gcTime=0 to prevent stale state)
 */
function AllProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

type ProvidersOptions = Omit<RenderOptions, "wrapper">;

/**
 * Render a component wrapped in all app-level providers.
 *
 * Returns the standard RTL `RenderResult`, so all queries (getByRole,
 * findByText, etc.) are available directly on the return value.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: ProvidersOptions,
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Re-export RTL primitives so test files can import everything from one place.
 */
export { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
export { userEvent } from "./userEvent";
