/**
 * GraphCanvasOverlay tests — P3-13 (e).
 *
 * Covers:
 *   (e) Empty state renders when nodeCount=0 and hasActiveFilters=true;
 *       "Clear all" button calls onClearAll.
 *   - Loading overlay shown when loading=true.
 *   - Error overlay shown when error is non-null (takes priority over empty).
 *   - No overlay when loading=false, nodeCount > 0, no error.
 *   - Empty state NOT shown when hasActiveFilters=false (even if nodeCount=0).
 */

import React from "react";
import { render, screen, fireEvent } from "../utils/render";
import { GraphCanvasOverlay } from "@/components/graph/GraphCanvasOverlay";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderOverlay(props: Partial<React.ComponentProps<typeof GraphCanvasOverlay>> = {}) {
  const defaults = {
    loading: false,
    error: null,
    nodeCount: 10,
    hasActiveFilters: false,
    onClearAll: jest.fn(),
  };
  return render(<GraphCanvasOverlay {...defaults} {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GraphCanvasOverlay — empty state (P3-13e)", () => {
  it("renders empty overlay when nodeCount=0 and hasActiveFilters=true", () => {
    renderOverlay({ nodeCount: 0, hasActiveFilters: true, loading: false });

    expect(
      screen.getByRole("status", { name: /no nodes match the active filters/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("No nodes match these filters")).toBeInTheDocument();
  });

  it("Clear all button in empty overlay calls onClearAll", () => {
    const onClearAll = jest.fn();
    renderOverlay({ nodeCount: 0, hasActiveFilters: true, loading: false, onClearAll });

    fireEvent.click(
      screen.getByRole("button", { name: /clear all active graph filters/i }),
    );

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("does NOT render empty overlay when hasActiveFilters=false", () => {
    const { container } = renderOverlay({
      nodeCount: 0,
      hasActiveFilters: false,
      loading: false,
    });

    expect(container.firstChild).toBeNull();
  });
});

describe("GraphCanvasOverlay — loading state", () => {
  it("renders loading overlay when loading=true", () => {
    renderOverlay({ loading: true });

    expect(
      screen.getByRole("status", { name: /loading graph/i }),
    ).toBeInTheDocument();
  });

  it("loading overlay takes lower priority than empty state (loading+empty → loading)", () => {
    // Per implementation: error > empty > loading. When nodeCount=0 and loading=true,
    // the empty check fails (loading=true is excluded by the guard), so loading shows.
    renderOverlay({ nodeCount: 0, hasActiveFilters: true, loading: true });

    // Loading state is shown (empty state requires !loading)
    expect(screen.getByRole("status", { name: /loading graph/i })).toBeInTheDocument();
    expect(
      screen.queryByText("No nodes match these filters"),
    ).not.toBeInTheDocument();
  });
});

describe("GraphCanvasOverlay — error state", () => {
  it("renders error overlay when error is non-null", () => {
    const err = new Error("Network timeout");
    renderOverlay({ error: err });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Graph failed to load")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
  });

  it("error takes priority over empty state", () => {
    const err = new Error("500");
    renderOverlay({ error: err, nodeCount: 0, hasActiveFilters: true });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.queryByText("No nodes match these filters"),
    ).not.toBeInTheDocument();
  });

  it("error takes priority over loading state", () => {
    const err = new Error("WebGL context lost");
    renderOverlay({ error: err, loading: true });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /loading graph/i }),
    ).not.toBeInTheDocument();
  });
});

describe("GraphCanvasOverlay — no overlay", () => {
  it("renders null when no error, not loading, and nodeCount > 0", () => {
    const { container } = renderOverlay({
      loading: false,
      error: null,
      nodeCount: 42,
      hasActiveFilters: false,
    });

    expect(container.firstChild).toBeNull();
  });
});
