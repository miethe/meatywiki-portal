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
  audioRecorderProps = {};
  mockSubmitUpload.mockReset();
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
const mockSubmitUpload = jest.fn();
jest.mock("@/lib/api/intake", () => ({
  submitNote: (...args: unknown[]) => mockSubmitNote(...args),
  submitUrl: (...args: unknown[]) => mockSubmitUrl(...args),
  submitUpload: (...args: unknown[]) => mockSubmitUpload(...args),
  parseTagString: (raw: string) => (raw.trim() ? raw.split(",").map((s: string) => s.trim()) : []),
  isQueuedResponse: (r: unknown) =>
    (r as { queued?: boolean }).queued === true,
}));

// Mock AudioRecorder — controls the onRecorded/onError callback injection.
let audioRecorderProps: {
  onRecorded?: (blob: Blob, mimeType: string) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
} = {};
jest.mock("@/components/quick-add/audio-recorder", () => ({
  AudioRecorder: (props: {
    onRecorded: (blob: Blob, mimeType: string) => void;
    onError: (msg: string) => void;
    disabled?: boolean;
  }) => {
    audioRecorderProps = props;
    return (
      <div data-testid="audio-recorder">
        <button
          type="button"
          data-testid="mock-mic-btn"
          disabled={props.disabled}
          onClick={() => {
            // Simulate a successful recording of 1 KB
            props.onRecorded(new Blob([new Uint8Array(1024)], { type: "audio/webm" }), "audio/webm");
          }}
        >
          Record
        </button>
      </div>
    );
  },
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

// ---------------------------------------------------------------------------
// Audio tab (P4-03)
// ---------------------------------------------------------------------------

describe("QuickAddModal — Audio tab (P4-03)", () => {
  it("shows Audio tab button", () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    renderModal();

    expect(screen.getByRole("tab", { name: /audio/i })).toBeInTheDocument();
  });

  it("renders AudioRecorder when Audio tab is active", () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    renderModal();

    fireEvent.click(screen.getByRole("tab", { name: /audio/i }));

    expect(screen.getByTestId("audio-recorder")).toBeInTheDocument();
  });

  it("Submit button is disabled before a recording is captured", () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    renderModal();

    fireEvent.click(screen.getByRole("tab", { name: /audio/i }));

    // Submit button should be disabled (no recording yet)
    const submitBtn = screen.getByRole("button", { name: /^submit$/i });
    expect(submitBtn).toBeDisabled();
  });

  it("enables Submit after onRecorded is called by AudioRecorder", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    renderModal();

    fireEvent.click(screen.getByRole("tab", { name: /audio/i }));

    // Trigger mock recording
    fireEvent.click(screen.getByTestId("mock-mic-btn"));

    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /^submit$/i });
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it("calls submitUpload when Submit is clicked with a captured blob", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitUpload.mockResolvedValue({
      run_id: "run-audio-1",
      status: "queued",
      created_at: "2026-04-20T00:00:00Z",
    });

    renderModal();

    fireEvent.click(screen.getByRole("tab", { name: /audio/i }));
    fireEvent.click(screen.getByTestId("mock-mic-btn")); // triggers onRecorded

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^submit$/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() => {
      expect(mockSubmitUpload).toHaveBeenCalledTimes(1);
    });

    const [blob, mimeType] = mockSubmitUpload.mock.calls[0] as [Blob, string];
    expect(blob).toBeInstanceOf(Blob);
    expect(mimeType).toBe("audio/webm");
  });

  it("transitions to 'audio_queued' phase after successful upload", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitUpload.mockResolvedValue({
      run_id: "run-audio-1",
      status: "queued",
      created_at: "2026-04-20T00:00:00Z",
    });

    renderModal();

    fireEvent.click(screen.getByRole("tab", { name: /audio/i }));
    fireEvent.click(screen.getByTestId("mock-mic-btn"));

    await waitFor(() => expect(screen.getByRole("button", { name: /^submit$/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() => {
      expect(screen.getByText(/transcription pending/i)).toBeInTheDocument();
    });
  });

  it("shows 'Audio submitted' header in audio_queued phase", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitUpload.mockResolvedValue({
      run_id: "run-audio-1",
      status: "queued",
      created_at: "2026-04-20T00:00:00Z",
    });

    renderModal();

    fireEvent.click(screen.getByRole("tab", { name: /audio/i }));
    fireEvent.click(screen.getByTestId("mock-mic-btn"));

    await waitFor(() => expect(screen.getByRole("button", { name: /^submit$/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() => {
      expect(screen.getByText(/audio submitted/i)).toBeInTheDocument();
    });
  });

  it("transitions to 'queued' phase when offline (submitUpload returns queued)", async () => {
    mockUseOfflineQueue.mockReturnValue({ ...defaultQueueState });
    mockSubmitUpload.mockResolvedValue({
      queued: true,
      run_id: null,
      status: "offline_queued",
    });

    renderModal();

    fireEvent.click(screen.getByRole("tab", { name: /audio/i }));
    fireEvent.click(screen.getByTestId("mock-mic-btn"));

    await waitFor(() => expect(screen.getByRole("button", { name: /^submit$/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));

    await waitFor(() => {
      expect(screen.getByText(/saved for later/i)).toBeInTheDocument();
    });
  });
});
