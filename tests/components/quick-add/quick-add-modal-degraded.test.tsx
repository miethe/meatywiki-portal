/**
 * Tests for QuickAddModal — pipeline observability degraded / success states (P2-04).
 *
 * Covers:
 *   - compile_failed SSE event transitions modal to amber warning (degraded phase)
 *   - stage_degraded SSE event transitions modal to amber warning (degraded phase)
 *   - workflow_completed SSE event still shows green success banner
 *   - "View details" link is present in degraded state and href points to artifact URL
 *   - Modal is dismissible (via "Dismiss" button) from degraded state
 *
 * Mocking strategy:
 *   - useSSE is a controlled mock: returns controlled events array per test.
 *   - submitNote returns a run_id to drive the modal into ingesting phase.
 *   - After ingesting phase starts, useSSE mock is updated to emit the target event.
 *   - StageTracker is stubbed (not under test).
 *   - useOfflineQueue is stubbed with defaults.
 *   - AudioRecorder / FileDropZone are stubbed.
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Reset IDB + env
// ---------------------------------------------------------------------------

beforeEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
  process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA = "1";
  jest.spyOn(console, "info").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  mockSubmitNote.mockReset();
  // Default: SSE returns no events (idle)
  mockUseSSE.mockReturnValue({ events: [], status: "closed" });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA;
});

// ---------------------------------------------------------------------------
// Module mocks (hoisted by jest — must appear before imports that use them)
// ---------------------------------------------------------------------------

const mockUseSSE = jest.fn();
jest.mock("@/hooks/useSSE", () => ({
  useSSE: (...args: unknown[]) => mockUseSSE(...args),
}));

const mockUseOfflineQueue = jest.fn();
jest.mock("@/hooks/use-offline-queue", () => ({
  useOfflineQueue: () => mockUseOfflineQueue(),
}));

jest.mock("@/components/workflow/stage-tracker", () => ({
  StageTracker: () => <div data-testid="stage-tracker" />,
}));

jest.mock("@/components/quick-add/audio-recorder", () => ({
  AudioRecorder: () => <div data-testid="audio-recorder" />,
}));

jest.mock("@/components/quick-add/file-drop-zone", () => ({
  FileDropZone: () => <div data-testid="file-drop-zone" />,
}));

const mockSubmitNote = jest.fn();
const mockSubmitUrl = jest.fn();
jest.mock("@/lib/api/intake", () => ({
  submitNote: (...args: unknown[]) => mockSubmitNote(...args),
  submitUrl: (...args: unknown[]) => mockSubmitUrl(...args),
  submitUpload: jest.fn(),
  parseTagString: (raw: string) =>
    raw.trim() ? raw.split(",").map((s: string) => s.trim()) : [],
  isQueuedResponse: (r: unknown) =>
    (r as { queued?: boolean }).queued === true,
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { QuickAddModal } from "@/components/quick-add/quick-add-modal";

// ---------------------------------------------------------------------------
// Default mock values
// ---------------------------------------------------------------------------

const defaultQueueState = {
  queuedCount: 0,
  failedCount: 0,
  isOnline: true,
  retryFailed: jest.fn(),
};

const INGESTING_RESPONSE = {
  run_id: "run-observability-test-01",
  status: "queued",
  created_at: "2026-04-27T10:00:00Z",
};

const ARTIFACT_ID = "01HXYZ0000000000000000099";

// ---------------------------------------------------------------------------
// SSE event factories
// ---------------------------------------------------------------------------

function makeCompileFailedEvent(artifactId?: string) {
  return {
    type: "compile_failed" as const,
    event_id: "sse-evt-01",
    run_id: "run-observability-test-01",
    timestamp: "2026-04-27T10:00:05Z",
    artifact_id: artifactId,
  };
}

function makeStageDegradedEvent(artifactId?: string) {
  return {
    type: "stage_degraded" as const,
    event_id: "sse-evt-02",
    run_id: "run-observability-test-01",
    timestamp: "2026-04-27T10:00:04Z",
    stage: "compile",
    reason: "extraction parse failure",
    artifact_id: artifactId,
  };
}

function makeWorkflowCompletedEvent(artifactId?: string) {
  return {
    type: "workflow_completed" as const,
    event_id: "sse-evt-03",
    run_id: "run-observability-test-01",
    timestamp: "2026-04-27T10:00:10Z",
    artifact_id: artifactId,
  };
}


// ===========================================================================
// 1. compile_failed SSE event → degraded phase
// ===========================================================================

describe("QuickAddModal — compile_failed SSE event (P2-04)", () => {
  it("transitions to degraded phase and shows amber warning banner", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);

    // Start with no SSE events
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note content" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() =>
      expect(screen.getByText(/ingesting/i)).toBeInTheDocument(),
    );

    // Now emit compile_failed event via SSE mock
    mockUseSSE.mockReturnValue({
      events: [makeCompileFailedEvent(ARTIFACT_ID)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/added with issues/i)).toBeInTheDocument();
    });
  });

  it("renders an alert role element in degraded phase (not green success)", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText(/ingesting/i)).toBeInTheDocument());

    mockUseSSE.mockReturnValue({
      events: [makeCompileFailedEvent(ARTIFACT_ID)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
    });

    // Green "Successfully ingested" text must NOT be present
    expect(screen.queryByText(/successfully ingested/i)).not.toBeInTheDocument();
  });

  it("shows 'View details' link pointing to artifact URL when artifact_id is present", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText(/ingesting/i)).toBeInTheDocument());

    mockUseSSE.mockReturnValue({
      events: [makeCompileFailedEvent(ARTIFACT_ID)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /view details/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", `/artifact/${ARTIFACT_ID}`);
    });
  });

  it("shows 'Dismiss' button that closes the modal in degraded phase", async () => {
    const onOpenChange = jest.fn();
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={onOpenChange} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText(/ingesting/i)).toBeInTheDocument());

    mockUseSSE.mockReturnValue({
      events: [makeCompileFailedEvent(ARTIFACT_ID)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("'View details' link is absent in degraded phase when artifact_id is null", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText(/ingesting/i)).toBeInTheDocument());

    // compile_failed without artifact_id
    mockUseSSE.mockReturnValue({
      events: [makeCompileFailedEvent(undefined)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/added with issues/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole("link", { name: /view details/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 2. stage_degraded SSE event → degraded phase
// ===========================================================================

describe("QuickAddModal — stage_degraded SSE event (P2-04)", () => {
  it("transitions to degraded phase on stage_degraded event", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText(/ingesting/i)).toBeInTheDocument());

    mockUseSSE.mockReturnValue({
      events: [makeStageDegradedEvent(ARTIFACT_ID)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/added with issues/i)).toBeInTheDocument();
    });
  });

  it("shows 'View details' link for stage_degraded when artifact_id is present", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText(/ingesting/i)).toBeInTheDocument());

    mockUseSSE.mockReturnValue({
      events: [makeStageDegradedEvent(ARTIFACT_ID)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /view details/i });
      expect(link).toHaveAttribute("href", `/artifact/${ARTIFACT_ID}`);
    });
  });
});

// ===========================================================================
// 3. workflow_completed SSE event → green success (regression guard)
// ===========================================================================

describe("QuickAddModal — workflow_completed SSE event (P2-04 regression guard)", () => {
  it("shows green success banner (not degraded) on workflow_completed", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText(/ingesting/i)).toBeInTheDocument());

    mockUseSSE.mockReturnValue({
      events: [makeWorkflowCompletedEvent(ARTIFACT_ID)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => {
      // Green success copy
      expect(screen.getByText(/successfully ingested/i)).toBeInTheDocument();
    });

    // Degraded copy must NOT be present
    expect(screen.queryByText(/added with issues/i)).not.toBeInTheDocument();
    // Alert role is used for degraded; "successfully ingested" lives in a non-alert div
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows 'Go to artifact' link (not 'View details') on workflow_completed", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText(/ingesting/i)).toBeInTheDocument());

    mockUseSSE.mockReturnValue({
      events: [makeWorkflowCompletedEvent(ARTIFACT_ID)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /go to artifact/i });
      expect(link).toHaveAttribute("href", `/artifact/${ARTIFACT_ID}`);
    });

    // "View details" is the degraded-state CTA — should NOT be present on success
    expect(screen.queryByRole("link", { name: /view details/i })).not.toBeInTheDocument();
  });

  it("shows 'Add another' button on successful completion", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue(INGESTING_RESPONSE);
    mockUseSSE.mockReturnValue({ events: [], status: "connecting" });

    const { rerender } = render(
      <QuickAddModal open={true} onOpenChange={jest.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "test note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText(/ingesting/i)).toBeInTheDocument());

    mockUseSSE.mockReturnValue({
      events: [makeWorkflowCompletedEvent(ARTIFACT_ID)],
      status: "open",
    });

    rerender(<QuickAddModal open={true} onOpenChange={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add another/i })).toBeInTheDocument();
    });
  });
});
