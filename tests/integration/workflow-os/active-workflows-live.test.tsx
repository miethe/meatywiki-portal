/**
 * Integration test — Active Workflows panel live SSE behavior (P4-12).
 *
 * Verifies that:
 *   - A newly-arriving active run appears in the Active section and bumps the
 *     panel-level active count badge.
 *   - When SSE delivers workflow_completed, the run transitions from Active
 *     to Recent and the count badge decrements.
 *
 * Strategy:
 *   Use the panel in "controlled" mode and flip the external active/recent
 *   arrays between renders to simulate what useWorkflowRuns would do in
 *   response to live events. This exercises the panel's rendering contract
 *   (count badge, section placement) without coupling to MSW SSE wire format.
 *
 *   The SSE → state transformation itself is validated in
 *   stage-tracker-sse.test.tsx (uses MockEventSource end-to-end).
 */

import React from "react";
import { renderWithProviders, screen } from "../../utils/render";
import { WorkflowStatusPanel } from "@/components/workflow/workflow-status-panel";
import type { WorkflowRun } from "@/types/artifact";
import type { SSEWorkflowEvent } from "@/lib/sse/types";

// Mock the SSE bridge — not the subject of this test (covered separately).
jest.mock("@/components/workflow/run-sse-bridge", () => ({
  RunSSEBridge: () => null,
}));

// Mock useWorkflowRuns since the panel uses controlled mode; guard side-effects.
jest.mock("@/hooks/useWorkflowRuns", () => ({
  useWorkflowRuns: () => ({
    activeRuns: [],
    recentRuns: [],
    isLoading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined),
    applyEvent: jest.fn(),
    notifySSEError: jest.fn(),
  }),
}));

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

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "wf-live-001",
    template_id: "source_ingest_v1",
    workspace: "inbox",
    status: "running",
    current_stage: 1,
    started_at: "2026-04-17T10:00:00Z",
    completed_at: null,
    initiator: "portal",
    ...overrides,
  };
}

function makeControlled(active: WorkflowRun[], recent: WorkflowRun[]) {
  return {
    activeRuns: active,
    recentRuns: recent,
    isLoading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined) as () => Promise<void>,
    applyEvent: jest.fn() as (runId: string, event: SSEWorkflowEvent) => void,
    notifySSEError: jest.fn() as (runId: string) => void,
  };
}

describe("Active Workflows panel — live behavior", () => {
  it("reflects count badge updates when an active run arrives", () => {
    const { rerender } = renderWithProviders(
      <WorkflowStatusPanel variant="full" controlled={makeControlled([], [])} />,
    );

    // Initial: no badge rendered (count=0)
    expect(screen.queryByTestId("panel-active-count-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("empty-active")).toBeInTheDocument();

    // Simulate SSE-driven state update: a new active run arrives
    rerender(
      <WorkflowStatusPanel
        variant="full"
        controlled={makeControlled([makeRun({ id: "wf-live-001" })], [])}
      />,
    );

    const badge = screen.getByTestId("panel-active-count-badge");
    expect(badge).toHaveTextContent("1");
    expect(screen.getAllByTestId("workflow-run-row")).toHaveLength(1);
  });

  it("moves a run from Active → Recent when it completes, decrementing the badge", () => {
    const running = makeRun({ id: "wf-live-002", status: "running" });

    const { rerender } = renderWithProviders(
      <WorkflowStatusPanel
        variant="full"
        controlled={makeControlled([running], [])}
      />,
    );

    expect(screen.getByTestId("panel-active-count-badge")).toHaveTextContent("1");

    // Simulate workflow_completed SSE event → hook moves it to Recent
    const completed = { ...running, status: "complete" as const, completed_at: "2026-04-17T10:05:00Z" };
    rerender(
      <WorkflowStatusPanel
        variant="full"
        controlled={makeControlled([], [completed])}
      />,
    );

    // Panel-level active count badge disappears when count=0
    expect(screen.queryByTestId("panel-active-count-badge")).not.toBeInTheDocument();
    // Empty-active message appears
    expect(screen.getByTestId("empty-active")).toBeInTheDocument();
    // Recent section has the completed run
    expect(screen.getByText(/Recent \(7 days\)/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("workflow-run-row")).toHaveLength(1);
  });

  it("badge count scales as multiple runs arrive (SSE-driven)", () => {
    const { rerender } = renderWithProviders(
      <WorkflowStatusPanel variant="full" controlled={makeControlled([], [])} />,
    );

    // Simulate three new runs arriving via SSE
    const runs = [
      makeRun({ id: "wf-live-a", status: "running" }),
      makeRun({ id: "wf-live-b", status: "pending" }),
      makeRun({ id: "wf-live-c", status: "running" }),
    ];
    rerender(
      <WorkflowStatusPanel variant="full" controlled={makeControlled(runs, [])} />,
    );

    expect(screen.getByTestId("panel-active-count-badge")).toHaveTextContent("3");
    expect(screen.getAllByTestId("workflow-run-row")).toHaveLength(3);
  });
});
