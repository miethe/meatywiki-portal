/**
 * Tests for QuickAddModal — focuses on P4-02 offline queue badge behaviour.
 *
 * Mocks:
 *   - useOfflineQueue hook — controls badge state
 *   - submitNote / submitUrl — controls submission response
 *   - useSSE — stub (no real SSE in tests)
 *   - StageTracker — stub
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
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_PORTAL_ENABLE_PWA;
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock useOfflineQueue so we control badge state without real IndexedDB reads.
const mockUseOfflineQueue = jest.fn();
jest.mock("@/hooks/use-offline-queue", () => ({
  useOfflineQueue: () => mockUseOfflineQueue(),
}));

// Mock useSSE — no real SSE in unit tests.
jest.mock("@/hooks/useSSE", () => ({
  useSSE: () => ({ events: [], status: "closed" }),
}));

// Mock StageTracker — not under test here.
jest.mock("@/components/workflow/stage-tracker", () => ({
  StageTracker: () => <div data-testid="stage-tracker" />,
}));

// Mock intake API.
const mockSubmitNote = jest.fn();
const mockSubmitUrl = jest.fn();
jest.mock("@/lib/api/intake", () => ({
  submitNote: (...args: unknown[]) => mockSubmitNote(...args),
  submitUrl: (...args: unknown[]) => mockSubmitUrl(...args),
  parseTagString: (raw: string) => (raw.trim() ? raw.split(",").map((s: string) => s.trim()) : []),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(props = { open: true, onOpenChange: jest.fn() }) {
  return render(<QuickAddModal {...props} />);
}

// ---------------------------------------------------------------------------
// Badge tests
// ---------------------------------------------------------------------------

describe("QuickAddModal — offline queue badge (P4-02)", () => {
  it("does not show badge when queue is empty", () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    renderModal();

    expect(screen.queryByText(/queued \(/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/retry failed/i)).not.toBeInTheDocument();
  });

  it("shows 'Queued (N)' badge when queuedCount > 0", () => {
    mockUseOfflineQueue.mockReturnValue({
      ...defaultQueueState,
      queuedCount: 3,
    });
    renderModal();

    expect(screen.getByText("Queued (3)")).toBeInTheDocument();
  });

  it("shows 'Queued (1)' with correct singular count", () => {
    mockUseOfflineQueue.mockReturnValue({
      ...defaultQueueState,
      queuedCount: 1,
    });
    renderModal();

    expect(screen.getByText("Queued (1)")).toBeInTheDocument();
  });

  it("shows 'Retry failed (N)' button when failedCount > 0", () => {
    mockUseOfflineQueue.mockReturnValue({
      ...defaultQueueState,
      failedCount: 2,
    });
    renderModal();

    expect(screen.getByText("Retry failed (2)")).toBeInTheDocument();
  });

  it("calls retryFailed when 'Retry failed' button is clicked", () => {
    const retryFailed = jest.fn().mockResolvedValue(undefined);
    mockUseOfflineQueue.mockReturnValue({
      ...defaultQueueState,
      failedCount: 1,
      retryFailed,
    });
    renderModal();

    fireEvent.click(screen.getByText("Retry failed (1)"));
    expect(retryFailed).toHaveBeenCalledTimes(1);
  });

  it("shows both queued and failed badges simultaneously", () => {
    mockUseOfflineQueue.mockReturnValue({
      ...defaultQueueState,
      queuedCount: 2,
      failedCount: 1,
    });
    renderModal();

    expect(screen.getByText("Queued (2)")).toBeInTheDocument();
    expect(screen.getByText("Retry failed (1)")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Offline submission flow
// ---------------------------------------------------------------------------

describe("QuickAddModal — offline submission flow (P4-02)", () => {
  it("transitions to 'Queued' phase when submitNote returns offline_queued", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue({
      queued: true,
      run_id: null,
      status: "offline_queued",
    });

    renderModal();

    // Enter note text.
    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "offline note" },
    });

    // Submit.
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText(/saved for later/i)).toBeInTheDocument();
    });
  });

  it("shows 'Add another' button in queued phase", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue({
      queued: true,
      run_id: null,
      status: "offline_queued",
    });

    renderModal();

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "offline note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText("Add another")).toBeInTheDocument();
    });
  });

  it("transitions to 'ingesting' phase when online and submitNote returns run_id", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitNote.mockResolvedValue({
      run_id: "run-abc-123",
      status: "queued",
      created_at: "2026-04-20T00:00:00Z",
    });

    renderModal();

    fireEvent.change(screen.getByPlaceholderText(/start typing your note/i), {
      target: { value: "online note" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(screen.getByText(/ingesting/i)).toBeInTheDocument();
    });
  });
});
