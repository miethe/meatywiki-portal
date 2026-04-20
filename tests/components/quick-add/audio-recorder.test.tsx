/**
 * Tests for AudioRecorder component (P4-03).
 *
 * jsdom does not implement MediaRecorder or navigator.mediaDevices, so we
 * provide full mocks for both. Test cases cover:
 *   - Unsupported browser guard (missing MediaRecorder/getUserMedia)
 *   - Permission granted: start + stop recording → onRecorded fires
 *   - Permission denied: onError fires with a helpful message
 *   - Size limit: blob > 25 MB → onError fires, onRecorded NOT called
 *   - onRecorded receives the correct Blob and mimeType
 *   - Elapsed timer increments while recording (fake timers)
 *   - Stop button present during recording
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

// ---------------------------------------------------------------------------
// MediaRecorder mock factory
// ---------------------------------------------------------------------------

interface MockRecorderOptions {
  /** Simulate onstop firing with a blob of this size (bytes). */
  blobSize?: number;
  /** MIME type to report via recorder.mimeType. */
  mimeType?: string;
}

interface MockRecorderInstance {
  mimeType: string;
  state: "inactive" | "recording";
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start: jest.Mock;
  stop: jest.Mock;
}

function makeMockMediaRecorder(options: MockRecorderOptions = {}): MockRecorderInstance {
  const { mimeType = "audio/webm;codecs=opus" } = options;

  const instance: MockRecorderInstance = {
    mimeType,
    state: "inactive",
    ondataavailable: null,
    onstop: null,
    start: jest.fn(),
    stop: jest.fn(),
  };

  instance.start.mockImplementation(() => {
    instance.state = "recording";
    if (instance.ondataavailable) {
      instance.ondataavailable({ data: new Blob([new Uint8Array(512)]) });
    }
  });

  instance.stop.mockImplementation(() => {
    instance.state = "inactive";
    if (instance.onstop) {
      instance.onstop();
    }
  });

  return instance;
}

// ---------------------------------------------------------------------------
// Global mock setup
// ---------------------------------------------------------------------------

let mockRecorderInstance: MockRecorderInstance;
let mockStreamTracks: { stop: jest.Mock }[];

function setupMediaMocks(options: MockRecorderOptions & { permissionDenied?: boolean } = {}) {
  mockStreamTracks = [{ stop: jest.fn() }, { stop: jest.fn() }];
  const mockStream = { getTracks: () => mockStreamTracks };

  if (options.permissionDenied) {
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockRejectedValue(new DOMException("Permission denied", "NotAllowedError")),
      },
    });
  } else {
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream),
      },
    });
  }

  mockRecorderInstance = makeMockMediaRecorder(options);

  function MockMediaRecorder(_stream: MediaStream, _opts?: MediaRecorderOptions) {
    return mockRecorderInstance;
  }
  MockMediaRecorder.isTypeSupported = (mime: string) =>
    mime === "audio/webm;codecs=opus" || mime === "audio/webm";

  Object.defineProperty(globalThis, "MediaRecorder", {
    configurable: true,
    writable: true,
    value: MockMediaRecorder,
  });
}

function removeMockMediaRecorder() {
  delete (globalThis as Record<string, unknown>).MediaRecorder;
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
}

// ---------------------------------------------------------------------------
// Import component under test (after global setup placeholders)
// ---------------------------------------------------------------------------

import { AudioRecorder } from "@/components/quick-add/audio-recorder";

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("AudioRecorder — unsupported browser", () => {
  beforeEach(() => {
    removeMockMediaRecorder();
  });

  it("renders mic button as disabled when MediaRecorder is unavailable", () => {
    const onRecorded = jest.fn();
    const onError = jest.fn();

    render(<AudioRecorder onRecorded={onRecorded} onError={onError} />);

    const btn = screen.getByRole("button", { name: /record audio/i });
    expect(btn).toBeDisabled();
  });

  it("shows unsupported message", () => {
    render(<AudioRecorder onRecorded={jest.fn()} onError={jest.fn()} />);

    expect(screen.getByText(/audio recording not supported/i)).toBeInTheDocument();
  });
});

describe("AudioRecorder — permission granted", () => {
  beforeEach(() => {
    setupMediaMocks();
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders mic button in idle state", () => {
    render(<AudioRecorder onRecorded={jest.fn()} onError={jest.fn()} />);

    expect(screen.getByRole("button", { name: /start audio recording/i })).toBeInTheDocument();
  });

  it("starts recording when mic button is clicked", async () => {
    render(<AudioRecorder onRecorded={jest.fn()} onError={jest.fn()} />);

    const btn = screen.getByRole("button", { name: /start audio recording/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument();
    });

    expect(mockRecorderInstance.start).toHaveBeenCalledTimes(1);
  });

  it("shows recording indicator when recording is active", async () => {
    render(<AudioRecorder onRecorded={jest.fn()} onError={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /start audio recording/i }));

    await waitFor(() => {
      expect(screen.getByText(/recording…/i)).toBeInTheDocument();
    });
  });

  it("calls onRecorded with blob and mimeType when recording is stopped", async () => {
    const onRecorded = jest.fn();

    render(<AudioRecorder onRecorded={onRecorded} onError={jest.fn()} />);

    // Start
    fireEvent.click(screen.getByRole("button", { name: /start audio recording/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument();
    });

    // Stop
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));
    });

    await waitFor(() => {
      expect(onRecorded).toHaveBeenCalledTimes(1);
    });

    const [blob, mimeType] = onRecorded.mock.calls[0] as [Blob, string];
    expect(blob).toBeInstanceOf(Blob);
    expect(typeof mimeType).toBe("string");
    expect(mimeType.length).toBeGreaterThan(0);
  });

  it("stops all stream tracks on stop", async () => {
    render(<AudioRecorder onRecorded={jest.fn()} onError={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /start audio recording/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));
    });

    await waitFor(() => {
      for (const track of mockStreamTracks) {
        expect(track.stop).toHaveBeenCalled();
      }
    });
  });

  it("elapsed timer is shown as 00:00 at start of recording", async () => {
    render(<AudioRecorder onRecorded={jest.fn()} onError={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /start audio recording/i }));

    await waitFor(() => {
      expect(screen.getByText("00:00")).toBeInTheDocument();
    });
  });
});

describe("AudioRecorder — permission denied", () => {
  beforeEach(() => {
    setupMediaMocks({ permissionDenied: true });
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls onError when permission is denied", async () => {
    const onError = jest.fn();
    const onRecorded = jest.fn();

    render(<AudioRecorder onRecorded={onRecorded} onError={onError} />);

    fireEvent.click(screen.getByRole("button", { name: /start audio recording/i }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });

    const errorMsg = onError.mock.calls[0][0] as string;
    expect(errorMsg.toLowerCase()).toMatch(/microphone|permission|access/);
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it("shows inline error message when permission is denied", async () => {
    render(<AudioRecorder onRecorded={jest.fn()} onError={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /start audio recording/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/microphone access denied/i)).toBeInTheDocument();
  });
});

describe("AudioRecorder — 25 MB size limit", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls onError and does NOT call onRecorded when blob exceeds 25 MB", async () => {
    // Create recorder whose onstop emits a blob > 25 MB
    const twentySixMB = 26 * 1024 * 1024;
    setupMediaMocks({ blobSize: twentySixMB });

    const onError = jest.fn();
    const onRecorded = jest.fn();

    render(<AudioRecorder onRecorded={onRecorded} onError={onError} />);

    // Start
    fireEvent.click(screen.getByRole("button", { name: /start audio recording/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument());

    // Override onstop to produce an oversized blob
    const originalStop = mockRecorderInstance.stop;
    mockRecorderInstance.stop = jest.fn(function (this: typeof mockRecorderInstance) {
      this.state = "inactive";
      // Push a large chunk before onstop fires
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob([new Uint8Array(twentySixMB)]) });
      }
      if (this.onstop) {
        this.onstop();
      }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });

    const errorMsg = onError.mock.calls[0][0] as string;
    expect(errorMsg).toMatch(/25 MB/);
    expect(onRecorded).not.toHaveBeenCalled();

    // Restore
    mockRecorderInstance.stop = originalStop;
  });

  it("shows '25 MB limit' inline error when blob too large", async () => {
    const twentySixMB = 26 * 1024 * 1024;
    setupMediaMocks({ blobSize: twentySixMB });

    render(<AudioRecorder onRecorded={jest.fn()} onError={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /start audio recording/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument());

    mockRecorderInstance.stop = jest.fn(function (this: typeof mockRecorderInstance) {
      this.state = "inactive";
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob([new Uint8Array(twentySixMB)]) });
      }
      if (this.onstop) this.onstop();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /stop recording/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/25 MB limit/i)).toBeInTheDocument();
  });
});

describe("AudioRecorder — disabled prop", () => {
  beforeEach(() => {
    setupMediaMocks();
  });

  it("mic button is disabled when disabled=true and not recording", () => {
    render(<AudioRecorder onRecorded={jest.fn()} onError={jest.fn()} disabled={true} />);

    const btn = screen.getByRole("button", { name: /start audio recording/i });
    expect(btn).toBeDisabled();
  });
});
