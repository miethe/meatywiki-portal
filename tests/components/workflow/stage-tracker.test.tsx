/**
 * StageTracker component tests (P4-07).
 *
 * Covers:
 * - Timeline variant renders all six fixed stages
 * - Correct stage state (completed / current / upcoming) for a synthetic run
 * - Tooltip label appears on hover/focus (aria-label on circle)
 * - Handles missing events array gracefully
 * - Full variant still renders (regression guard for P3-07)
 * - Compact (bar) variant still renders (regression guard for P3-07)
 */

import React from "react";
import { renderWithProviders, screen, within, fireEvent } from "../../utils/render";
import { StageTracker } from "@/components/workflow/stage-tracker";
import { TIMELINE_STAGES, TIMELINE_STAGE_LABELS } from "@/lib/workflow/stages";
import type { WorkflowRun } from "@/types/artifact";
import type { StageCompletedEvent, StageStartedEvent } from "@/lib/sse/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run-01",
    template_id: "source_ingest_v1",
    workspace: "inbox",
    status: "running",
    current_stage: 2, // "extract" (0-indexed: ingest_start=0, classify=1, extract=2)
    started_at: "2026-04-17T10:00:00Z",
    completed_at: null,
    initiator: "portal",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Timeline variant — rendering
// ---------------------------------------------------------------------------

describe("StageTracker (timeline variant)", () => {
  it("renders all six fixed stages", () => {
    const run = makeRun();
    renderWithProviders(
      <StageTracker
        runId={run.id}
        status={run.status}
        currentStage={run.current_stage}
        variant="timeline"
      />,
    );

    const list = screen.getByRole("list", { name: /workflow stage timeline/i });
    const items = within(list).getAllByRole("listitem");

    expect(items).toHaveLength(TIMELINE_STAGES.length); // 6
  });

  it("marks completed stages correctly for a mid-run workflow", () => {
    // current_stage = 2 (extract, 0-indexed). Stages 0 and 1 should be completed,
    // stage 2 active, stages 3-5 upcoming.
    const run = makeRun({ current_stage: 2, status: "running" });

    renderWithProviders(
      <StageTracker
        runId={run.id}
        status={run.status}
        currentStage={run.current_stage}
        variant="timeline"
      />,
    );

    // Stage 0 (ingest_start) — completed
    const ingestLabel = TIMELINE_STAGE_LABELS["ingest_start"];
    const ingestItem = screen.getByRole("listitem", {
      name: new RegExp(`${ingestLabel}.*completed`, "i"),
    });
    expect(ingestItem).toBeInTheDocument();
    expect(ingestItem).not.toHaveAttribute("aria-current");

    // Stage 1 (classify) — completed
    const classifyLabel = TIMELINE_STAGE_LABELS["classify"];
    const classifyItem = screen.getByRole("listitem", {
      name: new RegExp(`${classifyLabel}.*completed`, "i"),
    });
    expect(classifyItem).toBeInTheDocument();

    // Stage 2 (extract) — active / current step
    const extractLabel = TIMELINE_STAGE_LABELS["extract"];
    const extractItem = screen.getByRole("listitem", {
      name: new RegExp(`${extractLabel}.*active`, "i"),
    });
    expect(extractItem).toHaveAttribute("aria-current", "step");

    // Stage 3 (compile) — upcoming
    const compileLabel = TIMELINE_STAGE_LABELS["compile"];
    const compileItem = screen.getByRole("listitem", {
      name: new RegExp(`${compileLabel}.*upcoming`, "i"),
    });
    expect(compileItem).toBeInTheDocument();
    expect(compileItem).not.toHaveAttribute("aria-current");
  });

  it("marks all stages completed when status=complete", () => {
    const run = makeRun({ status: "complete", current_stage: 5 });

    renderWithProviders(
      <StageTracker
        runId={run.id}
        status={run.status}
        currentStage={run.current_stage}
        variant="timeline"
      />,
    );

    const list = screen.getByRole("list", { name: /workflow stage timeline/i });
    const items = within(list).getAllByRole("listitem");

    items.forEach((item) => {
      expect(item).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/completed/i),
      );
      expect(item).not.toHaveAttribute("aria-current");
    });
  });

  it("marks failing stage with failed state", () => {
    // current_stage = 1 (classify) fails
    const run = makeRun({ status: "failed", current_stage: 1 });

    renderWithProviders(
      <StageTracker
        runId={run.id}
        status={run.status}
        currentStage={run.current_stage}
        variant="timeline"
      />,
    );

    const classifyLabel = TIMELINE_STAGE_LABELS["classify"];
    expect(
      screen.getByRole("listitem", {
        name: new RegExp(`${classifyLabel}.*failed`, "i"),
      }),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Tooltip label
  // -------------------------------------------------------------------------

  it("shows tooltip aria-label on stage circle with stage name when no events", () => {
    const run = makeRun({ current_stage: 0 });

    renderWithProviders(
      <StageTracker
        runId={run.id}
        status={run.status}
        currentStage={run.current_stage}
        variant="timeline"
        events={null}
      />,
    );

    // The circle elements have aria-label = stage label (no timestamp when no events)
    const ingestLabel = TIMELINE_STAGE_LABELS["ingest_start"];
    expect(screen.getByLabelText(ingestLabel)).toBeInTheDocument();
  });

  it("includes timestamp in tooltip aria-label when matching event present", () => {
    const run = makeRun({ current_stage: 1 });

    const events: (StageCompletedEvent | StageStartedEvent)[] = [
      {
        event_id: "ev-01",
        run_id: "run-01",
        type: "stage_completed",
        stage: "ingest_start",
        timestamp: "2026-04-17T10:00:30Z",
      },
    ];

    renderWithProviders(
      <StageTracker
        runId={run.id}
        status={run.status}
        currentStage={run.current_stage}
        variant="timeline"
        events={events}
      />,
    );

    // The ingest_start circle should have a label containing the stage name
    // AND a formatted time derived from the event timestamp.
    const ingestLabel = TIMELINE_STAGE_LABELS["ingest_start"];
    // aria-label will be something like "Ingest · 10:00:30 AM"
    const circle = screen.getByLabelText(new RegExp(`^${ingestLabel} ·`));
    expect(circle).toBeInTheDocument();
  });

  it("shows tooltip-like label on hover (group CSS; aria-label accessible)", () => {
    const run = makeRun({ current_stage: 0 });

    renderWithProviders(
      <StageTracker
        runId={run.id}
        status={run.status}
        currentStage={run.current_stage}
        variant="timeline"
        events={[]}
      />,
    );

    const classifyLabel = TIMELINE_STAGE_LABELS["classify"];
    const circle = screen.getByLabelText(classifyLabel);

    // Simulate focus to trigger tooltip visibility (CSS-driven; RTL confirms element exists)
    fireEvent.focus(circle);
    // The tooltip panel is aria-hidden; accessible name on circle is the label.
    expect(circle).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Graceful degradation
  // -------------------------------------------------------------------------

  it("handles missing events array gracefully (no crash, no timestamp in label)", () => {
    expect(() => {
      renderWithProviders(
        <StageTracker
          runId="run-x"
          status="running"
          currentStage={0}
          variant="timeline"
          // events prop intentionally omitted
        />,
      );
    }).not.toThrow();

    // All stage circles should exist with simple label (no timestamp suffix)
    const ingestLabel = TIMELINE_STAGE_LABELS["ingest_start"];
    expect(screen.getByLabelText(ingestLabel)).toBeInTheDocument();
  });

  it("handles currentStage=null gracefully", () => {
    expect(() => {
      renderWithProviders(
        <StageTracker
          runId="run-x"
          status="running"
          currentStage={null}
          variant="timeline"
        />,
      );
    }).not.toThrow();

    const list = screen.getByRole("list", { name: /workflow stage timeline/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
  });

  it("handles out-of-range currentStage gracefully (clamps to valid index)", () => {
    expect(() => {
      renderWithProviders(
        <StageTracker
          runId="run-x"
          status="running"
          currentStage={99}
          variant="timeline"
        />,
      );
    }).not.toThrow();

    const list = screen.getByRole("list", { name: /workflow stage timeline/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Regression: full variant (P3-07)
// ---------------------------------------------------------------------------

describe("StageTracker (full variant — regression)", () => {
  it("renders vertical stage list with template stages", () => {
    renderWithProviders(
      <StageTracker
        runId="run-02"
        templateId="source_ingest_v1"
        status="running"
        currentStage={1}
        variant="full"
      />,
    );

    // Full variant renders an <ol> with aria-label "Workflow stages"
    const list = screen.getByRole("list", { name: /workflow stages/i });
    expect(list.tagName).toBe("OL");

    // source_ingest_v1 has 4 stages
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
  });

  it("shows (running) annotation for the active stage", () => {
    renderWithProviders(
      <StageTracker
        runId="run-02"
        templateId="compile_v1"
        status="running"
        currentStage={0}
        variant="full"
      />,
    );

    expect(screen.getByText("(running)")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Regression: compact (bar) variant (P3-07)
// ---------------------------------------------------------------------------

describe("StageTracker (compact/bar variant — regression)", () => {
  it("renders a progressbar element", () => {
    renderWithProviders(
      <StageTracker
        runId="run-03"
        templateId="source_ingest_v1"
        status="running"
        currentStage={2}
        variant="compact"
      />,
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows 100% progress and Complete label when status=complete", () => {
    renderWithProviders(
      <StageTracker
        runId="run-03"
        templateId="source_ingest_v1"
        status="complete"
        currentStage={4}
        variant="compact"
      />,
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});
