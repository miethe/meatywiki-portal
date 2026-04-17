import React from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";

/**
 * Test render utilities for MeatyWiki Portal.
 *
 * `renderWithProviders` wraps the component under test with any app-level
 * context providers. Kept minimal in Batch 1 — expand in Batch 3 as
 * providers are added (e.g., auth context, theme, query client).
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
 * Currently a passthrough. Add providers here as they are introduced:
 * - QueryClientProvider (React Query, if adopted)
 * - AuthProvider (if a React context is needed client-side)
 * - ThemeProvider (if added in later phases)
 */
function AllProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
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
