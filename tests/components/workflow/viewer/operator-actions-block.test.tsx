/**
 * Unit tests for OperatorActionsBlock (P7-03).
 *
 * Tests:
 *   - Pause button visible + enabled only when status === 'running'
 *   - Resume button visible + enabled only when status === 'paused'
 *   - Cancel button visible when running or paused; hidden otherwise
 *   - Buttons disabled while in-flight (isPending)
 *   - Cancel opens confirmation dialog
 *   - Confirm in dialog calls cancel API; dialog closes on success
 *   - Dismiss dialog does not fire cancel
 *   - Error message rendered on failure
 *   - Nothing rendered for terminal states (complete, failed, abandoned)
 */

import React from "react";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../../utils/render";
import { OperatorActionsBlock } from "@/components/workflow/viewer/operator-actions-block";
import * as workflowApi from "@/lib/api/workflow-viewer";

// ---------------------------------------------------------------------------
// Mock the API module
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/workflow-viewer", () => ({
  ...jest.requireActual("@/lib/api/workflow-viewer"),
  pauseWorkflow: jest.fn(),
  resumeWorkflow: jest.fn(),
  cancelWorkflow: jest.fn(),
}));

const mockPause = workflowApi.pauseWorkflow as jest.Mock;
const mockResume = workflowApi.resumeWorkflow as jest.Mock;
const mockCancel = workflowApi.cancelWorkflow as jest.Mock;

const ACK = { run_id: "run-test", status: "paused", updated_at: "2026-04-24T10:00:00Z" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBlock(
  status: string,
  onAction = jest.fn(),
) {
  return renderWithProviders(
    <OperatorActionsBlock
      runId="run-test"
      status={status as Parameters<typeof OperatorActionsBlock>[0]["status"]}
      onAction={onAction}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OperatorActionsBlock", () => {
  beforeEach(() => {
    mockPause.mockReset();
    mockResume.mockReset();
    mockCancel.mockReset();
  });

  // --- State-conditional visibility ---

  it("renders Pause + Cancel buttons for running status", () => {
    renderBlock("running");
    expect(screen.getByTestId("operator-pause-button")).toBeInTheDocument();
    expect(screen.queryByTestId("operator-resume-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("operator-cancel-button")).toBeInTheDocument();
  });

  it("renders Resume + Cancel buttons for paused status", () => {
    renderBlock("paused");
    expect(screen.queryByTestId("operator-pause-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("operator-resume-button")).toBeInTheDocument();
    expect(screen.getByTestId("operator-cancel-button")).toBeInTheDocument();
  });

  it("renders nothing for terminal statuses", () => {
    for (const status of ["complete", "failed", "abandoned", "pending"]) {
      const { container } = renderBlock(status);
      expect(container.firstChild).toBeNull();
    }
  });

  // --- Pause action ---

  it("calls pauseWorkflow and triggers onAction on success", async () => {
    mockPause.mockResolvedValueOnce(ACK);
    const onAction = jest.fn();
    renderBlock("running", onAction);

    fireEvent.click(screen.getByTestId("operator-pause-button"));
    await waitFor(() => expect(mockPause).toHaveBeenCalledWith("run-test"));
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
  });

  it("shows error when pauseWorkflow rejects", async () => {
    mockPause.mockRejectedValueOnce(new Error("Pause failed"));
    renderBlock("running");

    fireEvent.click(screen.getByTestId("operator-pause-button"));
    await waitFor(() => expect(screen.getByTestId("operator-error")).toHaveTextContent("Pause failed"));
  });

  // --- Resume action ---

  it("calls resumeWorkflow and triggers onAction on success", async () => {
    mockResume.mockResolvedValueOnce(ACK);
    const onAction = jest.fn();
    renderBlock("paused", onAction);

    fireEvent.click(screen.getByTestId("operator-resume-button"));
    await waitFor(() => expect(mockResume).toHaveBeenCalledWith("run-test"));
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
  });

  // --- Cancel confirmation dialog ---

  it("opens confirmation dialog on Cancel button click", () => {
    renderBlock("running");
    fireEvent.click(screen.getByTestId("operator-cancel-button"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText(/Cancel Workflow Run/i)).toBeInTheDocument();
  });

  it("does not call cancelWorkflow when user dismisses dialog", () => {
    renderBlock("running");
    fireEvent.click(screen.getByTestId("operator-cancel-button"));
    fireEvent.click(screen.getByText("Keep Running"));
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("calls cancelWorkflow and closes dialog on confirm", async () => {
    mockCancel.mockResolvedValueOnce({ ...ACK, status: "abandoned" });
    const onAction = jest.fn();
    renderBlock("running", onAction);

    fireEvent.click(screen.getByTestId("operator-cancel-button"));
    fireEvent.click(screen.getByText("Cancel run"));

    await waitFor(() => expect(mockCancel).toHaveBeenCalledWith("run-test"));
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    // Dialog should be closed
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  // --- Disabled while in-flight ---

  it("disables buttons while a request is in-flight", async () => {
    // Never resolves — keeps isPending = true
    mockPause.mockImplementation(() => new Promise(() => {}));
    renderBlock("running");

    const pauseBtn = screen.getByTestId("operator-pause-button");
    fireEvent.click(pauseBtn);
    await waitFor(() => expect(pauseBtn).toBeDisabled());
    expect(screen.getByTestId("operator-cancel-button")).toBeDisabled();
  });
});
