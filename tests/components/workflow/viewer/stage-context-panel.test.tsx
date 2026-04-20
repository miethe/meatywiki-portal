/**
 * Unit tests for StageContextPanel (P1.5-2-02).
 *
 * Tests:
 *   - Null stage shows "click a stage" empty state
 *   - Stage with inputs shows inputs section
 *   - Stage with outputs shows outputs section
 *   - Stage with artifact_id shows produced artifacts section
 *   - Failed stage shows error message
 *   - Status badge matches stage.status
 *   - Duration is formatted and displayed
 */

import React from "react";
import { renderWithProviders, screen } from "../../../utils/render";
import { StageContextPanel } from "@/components/workflow/viewer/stage-context-panel";
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
    events: [
      {
        id: "evt-01",
        run_id: "run-01",
        stage: "compile",
        event_type: "stage_completed",
        event_payload: {
          inputs: { scope: "wiki/**" },
          outputs: { compiled: 40 },
          artifact_id: "01HXYZ0000000000000000010",
        },
        created_at: "2026-04-18T10:05:00Z",
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StageContextPanel", () => {
  it("shows empty state when stage is null", () => {
    renderWithProviders(<StageContextPanel stage={null} />);
    expect(screen.getByText(/Click a stage in the timeline/i)).toBeInTheDocument();
  });

  it("renders stage label in header", () => {
    renderWithProviders(<StageContextPanel stage={makeStage()} />);
    expect(screen.getByText("Compile")).toBeInTheDocument();
  });

  it("shows Inputs section with key-value pairs", () => {
    renderWithProviders(<StageContextPanel stage={makeStage()} />);
    expect(screen.getByText("Inputs")).toBeInTheDocument();
    expect(screen.getByText("scope")).toBeInTheDocument();
    expect(screen.getByText("wiki/**")).toBeInTheDocument();
  });

  it("shows Outputs section", () => {
    renderWithProviders(<StageContextPanel stage={makeStage()} />);
    expect(screen.getByText("Outputs")).toBeInTheDocument();
  });

  it("shows produced artifact ID", () => {
    renderWithProviders(<StageContextPanel stage={makeStage()} />);
    expect(screen.getByText("Produced Artifacts")).toBeInTheDocument();
    expect(screen.getByText("01HXYZ0000000000000000010")).toBeInTheDocument();
  });

  it("shows error message for failed stage", () => {
    const stage = makeStage({
      status: "error",
      events: [
        {
          id: "evt-err",
          run_id: "run-01",
          stage: "compile",
          event_type: "stage_failed",
          event_payload: { error: "Out of memory at compile step" },
          created_at: "2026-04-18T10:05:00Z",
        },
      ],
    });
    renderWithProviders(<StageContextPanel stage={stage} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Out of memory at compile step");
  });

  it("renders duration in header", () => {
    renderWithProviders(<StageContextPanel stage={makeStage({ durationS: 65 })} />);
    expect(screen.getByText(/1m 5s/)).toBeInTheDocument();
  });

  it("shows 'Completed' status badge for success stage", () => {
    renderWithProviders(<StageContextPanel stage={makeStage({ status: "success" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Completed");
  });

  it("shows 'In Progress' status badge for in_progress stage", () => {
    renderWithProviders(
      <StageContextPanel
        stage={makeStage({ status: "in_progress", completedAt: null })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("In Progress");
  });
});
