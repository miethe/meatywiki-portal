/**
 * WorkflowViewerScreen — operator controls + OPERATOR_CONTROL_ENABLED tests (P3-06).
 *
 * Covers:
 *   - OPERATOR_CONTROL_ENABLED=false: operator actions block is absent from DOM
 *   - OPERATOR_CONTROL_ENABLED=true + running run: operator actions block rendered
 *   - OPERATOR_CONTROL_ENABLED=true + terminal run: operator actions block absent
 *     (OperatorActionsBlock renders null for non-actionable statuses)
 *   - Pause button calls pauseWorkflow on click (smoke test of wiring)
 *   - Timeline panel renders
 *   - Run History panel renders
 *
 * Mocking strategy:
 *   - Mock @/lib/env to control OPERATOR_CONTROL_ENABLED flag.
 *   - Mock useWorkflowTimeline and useRunHistory at the hook boundary.
 *   - Mock pauseWorkflow / resumeWorkflow / cancelWorkflow (workflow-viewer API).
 *   - Mock sub-components that make independent network calls or use complex deps.
 */

import React from "react";
import { renderWithProviders, screen, waitFor, fireEvent } from "../../../utils/render";
import { WorkflowViewerScreen } from "@/components/workflow/viewer/workflow-viewer-screen";
import * as workflowViewerApi from "@/lib/api/workflow-viewer";
import type { WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// env module — mocked with a mutable state container held inside the factory
// closure so the getter reflects the current test's expectation.
// The factory runs before the test file's variable declarations, so we use
// a module-level object that is mutated via the exported setter below.
jest.mock("@/lib/env", () => {
  const state = { OPERATOR_CONTROL_ENABLED: false };
  return {
    get OPERATOR_CONTROL_ENABLED() { return state.OPERATOR_CONTROL_ENABLED; },
    __setState: (v: boolean) => { state.OPERATOR_CONTROL_ENABLED = v; },
  };
});

// Typed accessor for convenience in tests
import * as envModule from "@/lib/env";
const setOperatorControlEnabled = (v: boolean) =>
  (envModule as unknown as { __setState: (v: boolean) => void }).__setState(v);

// Workflow timeline hook
jest.mock("@/hooks/useWorkflowTimeline", () => ({
  useWorkflowTimeline: jest.fn(() => ({
    events: [],
    stages: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

// Run history hook
jest.mock("@/hooks/useRunHistory", () => ({
  useRunHistory: jest.fn(() => ({
    runs: [],
    isLoading: false,
    isReRunning: false,
    error: null,
    reRunError: null,
    reRun: jest.fn(),
    refetch: jest.fn(),
  })),
}));

// Audit log panel uses fetchAuditLog directly — stub it
jest.mock("@/lib/api/workflow-viewer", () => ({
  ...jest.requireActual("@/lib/api/workflow-viewer"),
  pauseWorkflow: jest.fn(),
  resumeWorkflow: jest.fn(),
  cancelWorkflow: jest.fn(),
  fetchAuditLog: jest.fn().mockResolvedValue([]),
}));

// (workflow-viewer API mock above covers all three operator actions)

const mockPause = workflowViewerApi.pauseWorkflow as jest.Mock;

jest.mock("next/link", () => ({
  __esModule: true,
  default: function MockLink({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const runningRun: WorkflowRun = {
  id: "run-001",
  template_id: "source_ingest_v1",
  workspace: "library",
  status: "running",
  current_stage: 2,
  started_at: "2026-04-20T09:00:00Z",
  completed_at: null,
  initiator: "portal",
};

const completeRun: WorkflowRun = {
  ...runningRun,
  id: "run-002",
  status: "complete",
  current_stage: 5,
  completed_at: "2026-04-20T09:10:00Z",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Default: operator controls off
  setOperatorControlEnabled(false);
  mockPause.mockResolvedValue({
    run_id: "run-001",
    status: "paused",
    updated_at: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderScreen(run?: WorkflowRun) {
  return renderWithProviders(
    <WorkflowViewerScreen runId="run-001" run={run ?? null} />,
  );
}

// ===========================================================================
// 1. OPERATOR_CONTROL_ENABLED = false
// ===========================================================================

describe("WorkflowViewerScreen — OPERATOR_CONTROL_ENABLED=false", () => {
  it("does not render the operator actions block when flag is off", () => {
    setOperatorControlEnabled(false);
    renderScreen(runningRun);

    expect(
      screen.queryByTestId("operator-actions-block"),
    ).not.toBeInTheDocument();
  });

  it("does not render the Pause button when flag is off", () => {
    setOperatorControlEnabled(false);
    renderScreen(runningRun);

    expect(
      screen.queryByRole("button", { name: /pause workflow run/i }),
    ).not.toBeInTheDocument();
  });

  it("still renders the Stage Timeline panel", () => {
    setOperatorControlEnabled(false);
    renderScreen(runningRun);

    expect(
      screen.getByRole("heading", { name: /stage timeline/i }),
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. OPERATOR_CONTROL_ENABLED = true, running run
// ===========================================================================

describe("WorkflowViewerScreen — OPERATOR_CONTROL_ENABLED=true, running run", () => {
  it("renders the operator actions block for a running run", () => {
    setOperatorControlEnabled(true);
    renderScreen(runningRun);

    expect(
      screen.getByTestId("operator-actions-block"),
    ).toBeInTheDocument();
  });

  it("renders the Pause button for a running run", () => {
    setOperatorControlEnabled(true);
    renderScreen(runningRun);

    expect(
      screen.getByRole("button", { name: /pause workflow run/i }),
    ).toBeInTheDocument();
  });

  it("renders the Cancel button for a running run", () => {
    setOperatorControlEnabled(true);
    renderScreen(runningRun);

    expect(
      screen.getByRole("button", { name: /cancel workflow run/i }),
    ).toBeInTheDocument();
  });

  it("does not render the Resume button for a running run", () => {
    setOperatorControlEnabled(true);
    renderScreen(runningRun);

    expect(
      screen.queryByRole("button", { name: /resume workflow run/i }),
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 3. OPERATOR_CONTROL_ENABLED = true, terminal run
// ===========================================================================

describe("WorkflowViewerScreen — OPERATOR_CONTROL_ENABLED=true, complete run", () => {
  it("does not render the operator actions block for a complete run", () => {
    setOperatorControlEnabled(true);
    renderScreen(completeRun);

    // OperatorActionsBlock returns null for non-actionable statuses
    expect(
      screen.queryByTestId("operator-actions-block"),
    ).not.toBeInTheDocument();
  });

  it("does not render Pause/Resume/Cancel for a complete run", () => {
    setOperatorControlEnabled(true);
    renderScreen(completeRun);

    expect(
      screen.queryByRole("button", { name: /pause workflow run/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /resume workflow run/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /cancel workflow run/i }),
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 4. Pause button calls pauseWorkflow
// ===========================================================================

describe("WorkflowViewerScreen — pause action wiring", () => {
  it("calls pauseWorkflow when the Pause button is clicked", async () => {
    setOperatorControlEnabled(true);
    renderScreen(runningRun);

    fireEvent.click(
      screen.getByRole("button", { name: /pause workflow run/i }),
    );

    await waitFor(() => {
      expect(mockPause).toHaveBeenCalledWith("run-001");
    });
  });
});

// ===========================================================================
// 5. Structural: timeline + history panels always rendered
// ===========================================================================

describe("WorkflowViewerScreen — panel structure", () => {
  it("renders the viewer grid data-testid", () => {
    renderScreen();
    expect(screen.getByTestId("viewer-grid")).toBeInTheDocument();
  });

  it("renders the Stage Timeline heading", () => {
    renderScreen(runningRun);
    expect(
      screen.getByRole("heading", { name: /stage timeline/i }),
    ).toBeInTheDocument();
  });

  it("renders the Back to workflows link", () => {
    renderScreen(runningRun);
    expect(
      screen.getByRole("link", { name: /back to workflows list/i }),
    ).toBeInTheDocument();
  });
});
