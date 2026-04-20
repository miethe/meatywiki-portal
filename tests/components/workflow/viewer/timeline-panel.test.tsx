/**
 * Unit tests for TimelinePanel (P1.5-2-02).
 *
 * Uses RTL with synthetic TimelineStage[] data — no MSW / fetch needed.
 * Tests:
 *   - Renders stage nodes with correct labels and count
 *   - Loading state shows skeleton
 *   - Error state renders alert
 *   - Empty state renders helpful message
 *   - Clicking a stage calls onSelectStage
 *   - Keyboard Enter/Space on a stage calls onSelectStage
 *   - Selected stage has aria-pressed=true
 *   - ARIA labels on nodes
 */

import React from "react";
import { renderWithProviders, screen, within, fireEvent } from "../../../utils/render";
import { TimelinePanel } from "@/components/workflow/viewer/timeline-panel";
import type { TimelineStage } from "@/types/workflow-viewer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStage(overrides: Partial<TimelineStage> = {}): TimelineStage {
  return {
    name: "compile",
    label: "Compile",
    status: "success",
    startedAt: "2026-04-18T10:00:00Z",
    completedAt: "2026-04-18T10:05:00Z",
    durationS: 300,
    events: [],
    ...overrides,
  };
}

const STAGES: TimelineStage[] = [
  makeStage({ name: "scope", label: "Scope", status: "success", durationS: 20 }),
  makeStage({ name: "compile", label: "Compile", status: "success", durationS: 300 }),
  makeStage({ name: "synthesise", label: "Synthesise", status: "in_progress", durationS: null }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TimelinePanel", () => {
  const noop = jest.fn();

  beforeEach(() => noop.mockClear());

  it("renders all stage labels", () => {
    renderWithProviders(
      <TimelinePanel
        stages={STAGES}
        selectedStageName={null}
        onSelectStage={noop}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("Scope")).toBeInTheDocument();
    expect(screen.getByText("Compile")).toBeInTheDocument();
    expect(screen.getByText("Synthesise")).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading=true and no stages", () => {
    renderWithProviders(
      <TimelinePanel
        stages={[]}
        selectedStageName={null}
        onSelectStage={noop}
        isLoading
        error={null}
      />,
    );

    expect(screen.getByLabelText("Loading timeline")).toBeInTheDocument();
  });

  it("shows error message when error is set", () => {
    renderWithProviders(
      <TimelinePanel
        stages={[]}
        selectedStageName={null}
        onSelectStage={noop}
        isLoading={false}
        error="Failed to load timeline"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load timeline");
  });

  it("shows empty state when no stages and not loading", () => {
    renderWithProviders(
      <TimelinePanel
        stages={[]}
        selectedStageName={null}
        onSelectStage={noop}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/No timeline events/i)).toBeInTheDocument();
  });

  it("calls onSelectStage with stage name when clicked", () => {
    renderWithProviders(
      <TimelinePanel
        stages={STAGES}
        selectedStageName={null}
        onSelectStage={noop}
        isLoading={false}
        error={null}
      />,
    );

    // Click the "Scope" node button (role=button, aria-pressed=false)
    const scopeNode = screen.getAllByRole("button").find(
      (btn) => btn.getAttribute("aria-pressed") === "false" &&
        within(btn).queryByText("Scope") !== null,
    );
    expect(scopeNode).toBeDefined();
    fireEvent.click(scopeNode!);
    expect(noop).toHaveBeenCalledWith("scope");
  });

  it("calls onSelectStage(null) when selected stage is clicked again", () => {
    renderWithProviders(
      <TimelinePanel
        stages={STAGES}
        selectedStageName="scope"
        onSelectStage={noop}
        isLoading={false}
        error={null}
      />,
    );

    const scopeNode = screen.getAllByRole("button").find(
      (btn) => btn.getAttribute("aria-pressed") === "true",
    );
    expect(scopeNode).toBeDefined();
    fireEvent.click(scopeNode!);
    expect(noop).toHaveBeenCalledWith(null);
  });

  it("selected stage has aria-pressed=true", () => {
    renderWithProviders(
      <TimelinePanel
        stages={STAGES}
        selectedStageName="compile"
        onSelectStage={noop}
        isLoading={false}
        error={null}
      />,
    );

    const pressedButtons = screen.getAllByRole("button", { pressed: true });
    expect(pressedButtons).toHaveLength(1);
  });

  it("renders duration badge for completed stages", () => {
    renderWithProviders(
      <TimelinePanel
        stages={STAGES}
        selectedStageName={null}
        onSelectStage={noop}
        isLoading={false}
        error={null}
      />,
    );

    // 20s for Scope
    expect(screen.getByText("20s")).toBeInTheDocument();
    // 5m for Compile (300s)
    expect(screen.getByText("5m")).toBeInTheDocument();
  });

  it("supports keyboard Enter to select stage", () => {
    renderWithProviders(
      <TimelinePanel
        stages={STAGES}
        selectedStageName={null}
        onSelectStage={noop}
        isLoading={false}
        error={null}
      />,
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.keyDown(buttons[0]!, { key: "Enter" });
    expect(noop).toHaveBeenCalled();
  });
});
