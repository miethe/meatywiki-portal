/**
 * Harness smoke test (P3-11 Batch 1).
 *
 * Proves the Jest + RTL + MSW + jest-dom stack is wired correctly:
 * - jsdom renders a React component
 * - jest-dom matchers are available (toBeInTheDocument, etc.)
 * - MSW intercepts fetch and returns stub data
 *
 * This test intentionally uses a trivial inline component so it stays
 * independent of screen implementations (P3-03..P3-07).
 */

import React, { useEffect, useState } from "react";
import { renderWithProviders, screen, waitFor } from "../utils/render";

// ---------------------------------------------------------------------------
// Trivial component that fetches /health and renders the result
// ---------------------------------------------------------------------------

interface HealthStatus {
  status: string;
}

function HealthBadge(): React.JSX.Element {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8765/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthStatus>;
      })
      .then((data) => setStatus(data.status))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Unknown error"),
      );
  }, []);

  if (error !== null) return <p role="alert">Error: {error}</p>;
  if (status === null) return <p>Loading…</p>;
  return <p data-testid="health-status">Backend: {status}</p>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Test harness smoke tests", () => {
  it("renders a React component in jsdom", () => {
    renderWithProviders(<p data-testid="hello">Hello, world</p>);
    expect(screen.getByTestId("hello")).toBeInTheDocument();
    expect(screen.getByTestId("hello")).toHaveTextContent("Hello, world");
  });

  it("MSW intercepts fetch and returns stub health response", async () => {
    renderWithProviders(<HealthBadge />);

    // Initially shows loading state
    expect(screen.getByText("Loading…")).toBeInTheDocument();

    // After MSW responds, shows the stubbed status
    await waitFor(() => {
      expect(screen.getByTestId("health-status")).toBeInTheDocument();
    });

    expect(screen.getByTestId("health-status")).toHaveTextContent("Backend: ok");
  });

  it("jest-dom matchers work (toBeVisible, toHaveAttribute)", () => {
    renderWithProviders(
      <button type="button" aria-label="Close dialog" disabled>
        Close
      </button>,
    );
    const btn = screen.getByRole("button", { name: /close dialog/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-label", "Close dialog");
  });
});
