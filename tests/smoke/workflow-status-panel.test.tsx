/**
 * WorkflowStatusPanel smoke tests.
 *
 * Uses controlled mode so the panel can be validated without network hooks:
 * - Active and recent sections render
 * - Compact mode caps visible active rows at 3 and shows the remainder count
 * - Error state exposes the retry button
 *
 * P4-08: Updated "Recent (24 h)" → "Recent (7 days)" to match the new 7-day window.
 */

import React from "react";
import { renderWithProviders, screen, waitFor } from "../utils/render";
import { userEvent } from "../utils/userEvent";
import { WorkflowStatusPanel } from "@/components/workflow/workflow-status-panel";
import type { WorkflowRun } from "@/types/artifact";

jest.mock("@/components/workflow/run-sse-bridge", () => ({
  RunSSEBridge: () => null,
}));

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

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run-01",
    template_id: "source_ingest_v1",
    workspace: "inbox",
    status: "running",
    current_stage: 1,
    started_at: "2026-04-17T00:00:00Z",
    completed_at: null,
    initiator: "portal",
    ...overrides,
  };
}

const controlledBase = {
  isLoading: false,
  error: null,
  refetch: jest.fn().mockResolvedValue(undefined),
  applyEvent: jest.fn(),
  notifySSEError: jest.fn(),
};

describe("WorkflowStatusPanel", () => {
  it("renders active and recent sections in full mode", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <WorkflowStatusPanel
        variant="full"
        controlled={{
          ...controlledBase,
          activeRuns: [makeRun()],
          recentRuns: [makeRun({ id: "run-02", status: "complete", completed_at: "2026-04-17T00:05:00Z" })],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: /workflows/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /active/i })).toBeInTheDocument();
    // P4-08: section label changed from "Recent (24 h)" to "Recent (7 days)"
    expect(screen.getByRole("button", { name: /recent \(7 days\)/i })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /source ingest/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/run id:/i)).toBeInTheDocument();
    });
    // Full run ID appears in the expanded detail section
    expect(screen.getByText("run-01")).toBeInTheDocument();
  });

  it("caps compact mode at three visible active rows", () => {
    renderWithProviders(
      <WorkflowStatusPanel
        variant="compact"
        controlled={{
          ...controlledBase,
          activeRuns: [
            makeRun({ id: "run-01" }),
            makeRun({ id: "run-02" }),
            makeRun({ id: "run-03" }),
            makeRun({ id: "run-04" }),
          ],
          recentRuns: [],
        }}
      />,
    );

    expect(screen.getByText("+1 more active")).toBeInTheDocument();
  });

  it("renders retry affordance in the error state", () => {
    renderWithProviders(
      <WorkflowStatusPanel
        variant="full"
        controlled={{
          ...controlledBase,
          activeRuns: [],
          recentRuns: [],
          error: "Backend unavailable",
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Backend unavailable");
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
