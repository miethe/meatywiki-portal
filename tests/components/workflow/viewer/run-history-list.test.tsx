/**
 * Unit tests for RunHistoryList (P1.5-2-02).
 *
 * Tests:
 *   - Loading state shows skeletons
 *   - Error state shows error message
 *   - Empty state shows "No previous runs" message
 *   - Renders list of runs with status badges
 *   - Current run has aria-current="page"
 *   - Re-run button calls onReRun
 *   - Re-run button disabled while isReRunning
 *   - reRunError is displayed
 */

import React from "react";
import { renderWithProviders, screen, fireEvent } from "../../../utils/render";
import { RunHistoryList } from "@/components/workflow/viewer/run-history-list";
import type { WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mock next/link
// ---------------------------------------------------------------------------

jest.mock("next/link", () => ({
  __esModule: true,
  default: function MockLink({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...rest}>{children}</a>;
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run-test-01",
    template_id: "research_synthesis_v1",
    workspace: "research",
    status: "complete",
    current_stage: null,
    started_at: "2026-04-17T10:00:00Z",
    completed_at: "2026-04-17T10:10:00Z",
    initiator: "portal",
    ...overrides,
  };
}

const RUNS: WorkflowRun[] = [
  makeRun({ id: "run-01", status: "complete" }),
  makeRun({ id: "run-02", status: "failed" }),
  makeRun({ id: "run-03", status: "running" }),
];

const DEFAULT_PROPS = {
  runs: RUNS,
  currentRunId: "run-01",
  isLoading: false,
  isReRunning: false,
  error: null,
  reRunError: null,
  onReRun: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RunHistoryList", () => {
  beforeEach(() => (DEFAULT_PROPS.onReRun as jest.Mock).mockClear());

  it("shows loading skeletons when isLoading and no runs", () => {
    renderWithProviders(
      <RunHistoryList {...DEFAULT_PROPS} runs={[]} isLoading />,
    );
    expect(screen.getByLabelText("Loading run history")).toBeInTheDocument();
  });

  it("shows error message when error is set", () => {
    renderWithProviders(
      <RunHistoryList {...DEFAULT_PROPS} runs={[]} error="Backend error" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Backend error");
  });

  it("shows empty state when no runs", () => {
    renderWithProviders(
      <RunHistoryList {...DEFAULT_PROPS} runs={[]} />,
    );
    expect(screen.getByText(/No previous runs/i)).toBeInTheDocument();
  });

  it("renders all run rows", () => {
    renderWithProviders(<RunHistoryList {...DEFAULT_PROPS} />);
    const rows = screen.getAllByTestId("run-history-row");
    expect(rows).toHaveLength(3);
  });

  it("current run has aria-current=page", () => {
    renderWithProviders(<RunHistoryList {...DEFAULT_PROPS} />);
    const currentLink = screen.getByRole("link", { current: "page" });
    expect(currentLink).toHaveAttribute("data-run-id", "run-01");
  });

  it("calls onReRun when Re-run button is clicked", () => {
    renderWithProviders(<RunHistoryList {...DEFAULT_PROPS} />);
    const btn = screen.getByTestId("rerun-button");
    fireEvent.click(btn);
    expect(DEFAULT_PROPS.onReRun).toHaveBeenCalledTimes(1);
  });

  it("disables Re-run button while isReRunning", () => {
    renderWithProviders(<RunHistoryList {...DEFAULT_PROPS} isReRunning />);
    const btn = screen.getByTestId("rerun-button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("Queuing…");
  });

  it("displays reRunError message", () => {
    renderWithProviders(
      <RunHistoryList {...DEFAULT_PROPS} reRunError="Network error" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Network error");
  });
});
