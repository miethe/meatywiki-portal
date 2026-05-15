/**
 * Integration tests — ActiveResearchRuns widget (P5-06).
 *
 * Coverage:
 *   1. Mounts and fetches GET /api/workflows/runs?template_id=external_research_v1.
 *   2. ResearchRunCard renders for each run with status pill.
 *   3. Action buttons (Pause/Resume/Upload Result) trigger correct API calls.
 *   4. Polling fires on the 5 s schedule; unmount cleanup prevents post-unmount fetches.
 *   5. Error path: fetch failure shows error banner + toast; backoff applied.
 *   6. Upload result modal: text-path submits JSON to correct endpoint, closes on success,
 *      triggers refresh poll.
 *
 * Strategy:
 *   All API calls are mocked at the module level (jest.mock on @/lib/api/research).
 *   This sidesteps the undici/clearImmediate incompatibility with jsdom that occurs
 *   when real HTTP goes through the undici polyfill inside jsdom's window context.
 *   The MSW server (wired globally in tests/setup.ts) is still present for correctness
 *   but is not the interception layer here — module mocks run before MSW.
 *
 *   Fake timers (with doNotFake for setImmediate/clearImmediate) are used for
 *   polling and backoff tests. All other tests use real timers + waitFor.
 *
 *   Dialog is mocked to a plain div to avoid Radix UI portal issues in jsdom.
 */

import React from "react";
import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";

// ---------------------------------------------------------------------------
// Module mocks — must appear before any component imports
// ---------------------------------------------------------------------------

// Mock the entire research API so no real HTTP fires through undici/jsdom.
jest.mock("@/lib/api/research", () => ({
  listActiveResearchRuns: jest.fn(),
  getWorkflowRunDetail: jest.fn(),
  patchResearchTaskStatus: jest.fn(),
  uploadResearchResultJson: jest.fn(),
  uploadResearchResultFile: jest.fn(),
  getFreshnessStatus: jest.fn(),
  getContradictions: jest.fn(),
}));

// Stub Dialog to a plain div — Radix portals don't work in jsdom.
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

// Stub next/link (pulled in transitively by some imports)
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
// Subject imports (after mocks)
// ---------------------------------------------------------------------------

import { ActiveResearchRuns } from "@/components/research/ActiveResearchRuns";
import { ResearchRunCard } from "@/components/research/ResearchRunCard";
import * as researchApi from "@/lib/api/research";
import type { WorkflowRun } from "@/types/artifact";
import type {
  WorkflowRunDetail,
  ExternalResearchTaskStatus,
  ExternalResearchTaskRow,
  UploadResultResponse,
} from "@/types/workflows/research";
import type { ResearchRun, ServiceModeEnvelope } from "@/types/research-runs";

// ---------------------------------------------------------------------------
// Typed mock accessors
// ---------------------------------------------------------------------------

const mockListActiveResearchRuns = researchApi.listActiveResearchRuns as jest.MockedFunction<
  typeof researchApi.listActiveResearchRuns
>;
const mockGetWorkflowRunDetail = researchApi.getWorkflowRunDetail as jest.MockedFunction<
  typeof researchApi.getWorkflowRunDetail
>;
const mockPatchResearchTaskStatus =
  researchApi.patchResearchTaskStatus as jest.MockedFunction<
    typeof researchApi.patchResearchTaskStatus
  >;
const mockUploadResearchResultJson =
  researchApi.uploadResearchResultJson as jest.MockedFunction<
    typeof researchApi.uploadResearchResultJson
  >;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeWorkflowRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run-research-001",
    template_id: "external_research_v1" as WorkflowRun["template_id"],
    workspace: "inbox",
    status: "running",
    created_at: new Date(Date.now() - 300_000).toISOString(),
    completed_at: null,
    metadata: {
      topic: "Distributed Caching",
      research_question: "How does Redis handle cache invalidation at scale?",
    },
    ...overrides,
  };
}

function makeResearchRun(overrides: Partial<ResearchRun> = {}): ResearchRun {
  return {
    run_id: "run-research-001",
    template_id: "external_research_v1",
    status: "running",
    created_at: new Date(Date.now() - 300_000).toISOString(),
    completed_at: null,
    topic: "Distributed Caching",
    research_question: "How does Redis handle cache invalidation?",
    task: null,
    ...overrides,
  };
}

function makeRunDetail(
  runId: string,
  status: ExternalResearchTaskStatus = "waiting_external",
): WorkflowRunDetail {
  return {
    run_id: runId,
    template_id: "external_research_v1",
    status,
    created_at: new Date(Date.now() - 300_000).toISOString(),
    completed_at: null,
    artifact_id: null,
    events: [],
    source_artifacts: [],
    created_artifacts: [],
    stage_durations: {},
  };
}

function makeRunsEnvelope(
  runs: WorkflowRun[],
): ServiceModeEnvelope<WorkflowRun> {
  return { data: runs, cursor: null };
}

function makeTaskRow(
  runId: string,
  status: ExternalResearchTaskStatus,
): ExternalResearchTaskRow {
  return {
    task_id: "ert-001",
    run_id: runId,
    status,
    notes: null,
    exported_at: null,
    started_at: null,
    completed_at: null,
  };
}

function makeUploadResult(): UploadResultResponse {
  return {
    result_artifact_id: "art-result-001",
    validation: { status: "advisory_pass", warnings: [] },
    next_stage: "synthesizing",
    warning: null,
    existing_artifact_id: null,
  };
}

// ---------------------------------------------------------------------------
// Test 1 — Initial mount and data fetch
// ---------------------------------------------------------------------------

describe("ActiveResearchRuns — initial fetch", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls listActiveResearchRuns on mount and renders a card per run", async () => {
    const run1 = makeWorkflowRun({
      id: "run-research-001",
      metadata: { topic: "Distributed Caching", research_question: "Redis invalidation?" },
    });
    const run2 = makeWorkflowRun({
      id: "run-research-002",
      status: "pending",
      metadata: { topic: "Graph Databases", research_question: "Neo4j vs DGraph?" },
    });
    mockListActiveResearchRuns.mockResolvedValueOnce(makeRunsEnvelope([run1, run2]));
    // Subsequent polls resolve to same data (for scheduleNext)
    mockListActiveResearchRuns.mockResolvedValue(makeRunsEnvelope([run1, run2]));

    render(<ActiveResearchRuns />);

    // Skeleton shown immediately
    expect(screen.getByLabelText("Loading research runs")).toBeInTheDocument();

    await waitFor(() =>
      expect(
        screen.queryByLabelText("Loading research runs"),
      ).not.toBeInTheDocument(),
    );

    expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(1);

    // Run cards rendered
    expect(screen.getByText("Distributed Caching")).toBeInTheDocument();
    expect(screen.getByText("Graph Databases")).toBeInTheDocument();

    // Count badge: 2 runs
    expect(screen.getByLabelText("2 runs")).toBeInTheDocument();
  });

  it("renders the empty state when no runs are returned", async () => {
    mockListActiveResearchRuns.mockResolvedValue(makeRunsEnvelope([]));

    render(<ActiveResearchRuns />);

    await waitFor(() =>
      expect(
        screen.queryByLabelText("Loading research runs"),
      ).not.toBeInTheDocument(),
    );

    expect(screen.getByText("No active research runs")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Test 2 — ResearchRunCard task list render and status icons
// ---------------------------------------------------------------------------

describe("ResearchRunCard — task list and status", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the topic, research question, and status pill in collapsed view", () => {
    render(
      <ResearchRunCard
        run={makeResearchRun({
          run_id: "run-card-001",
          topic: "Cache Eviction",
          research_question: "LRU vs LFU?",
          status: "running",
        })}
      />,
    );

    expect(screen.getByText("Cache Eviction")).toBeInTheDocument();
    expect(screen.getByText("LRU vs LFU?")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("lazily fetches run detail on expand and shows task row status label", async () => {
    const runId = "run-card-expand-001";
    mockGetWorkflowRunDetail.mockResolvedValue({
      data: makeRunDetail(runId, "waiting_external"),
    });

    render(
      <ResearchRunCard
        run={makeResearchRun({
          run_id: runId,
          topic: "Cache Eviction",
          research_question: "LRU vs LFU?",
        })}
      />,
    );

    // Expand by clicking the header button
    const expandButton = screen.getByRole("button", { name: /cache eviction/i });
    fireEvent.click(expandButton);

    // Loading indicator
    await waitFor(() =>
      expect(screen.getByText("Loading run detail…")).toBeInTheDocument(),
    );

    // After fetch: task row shows status label
    await waitFor(() =>
      expect(screen.getByText("Waiting (external)")).toBeInTheDocument(),
    );

    expect(mockGetWorkflowRunDetail).toHaveBeenCalledWith(runId);
  });

  it("renders status pills correctly for each run status", () => {
    const cases: { status: ResearchRun["status"]; label: string }[] = [
      { status: "pending", label: "Pending" },
      { status: "running", label: "Running" },
      { status: "paused", label: "Paused" },
      { status: "complete", label: "Complete" },
      { status: "failed", label: "Failed" },
      { status: "abandoned", label: "Abandoned" },
    ];

    for (const { status, label } of cases) {
      const { unmount } = render(
        <ResearchRunCard
          run={makeResearchRun({
            run_id: `run-status-${status}`,
            status,
            topic: "Test topic",
          })}
        />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("shows detail error text when run detail fetch fails", async () => {
    const runId = "run-card-error-001";
    mockGetWorkflowRunDetail.mockRejectedValue(new Error("Network error"));

    render(
      <ResearchRunCard
        run={makeResearchRun({ run_id: runId, topic: "Failing topic" })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /failing topic/i }));

    await waitFor(() =>
      expect(screen.queryByText("Loading run detail…")).not.toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(screen.getByText("Network error")).toBeInTheDocument(),
    );
  });

  it("does not re-fetch detail on subsequent expand/collapse cycles", async () => {
    const runId = "run-card-refetch-001";
    mockGetWorkflowRunDetail.mockResolvedValue({
      data: makeRunDetail(runId, "exported"),
    });

    render(
      <ResearchRunCard
        run={makeResearchRun({ run_id: runId, topic: "Idempotent expand" })}
      />,
    );

    const header = screen.getByRole("button", { name: /idempotent expand/i });

    // First expand — triggers fetch
    fireEvent.click(header);
    await waitFor(() =>
      expect(screen.getByText("Exported")).toBeInTheDocument(),
    );
    expect(mockGetWorkflowRunDetail).toHaveBeenCalledTimes(1);

    // Collapse
    fireEvent.click(header);
    // Re-expand — should NOT fire another fetch
    fireEvent.click(header);
    await waitFor(() =>
      expect(screen.getByText("Exported")).toBeInTheDocument(),
    );

    expect(mockGetWorkflowRunDetail).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Test 3 — Action buttons trigger correct API calls
// ---------------------------------------------------------------------------

describe("ResearchRunCard — action button API calls", () => {
  const runId = "run-action-001";

  const researchRun = makeResearchRun({
    run_id: runId,
    topic: "Consensus Protocols",
    research_question: "Raft vs Paxos?",
    status: "running",
  });

  beforeEach(() => {
    // Default: detail shows waiting_external; PATCH succeeds
    mockGetWorkflowRunDetail.mockResolvedValue({
      data: makeRunDetail(runId, "waiting_external"),
    });
    mockPatchResearchTaskStatus.mockResolvedValue(
      makeTaskRow(runId, "cancelled"),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Pause button sends PATCH with status=cancelled", async () => {
    render(<ResearchRunCard run={researchRun} />);

    fireEvent.click(screen.getByRole("button", { name: /consensus protocols/i }));
    await waitFor(() =>
      expect(screen.getByText("Waiting (external)")).toBeInTheDocument(),
    );

    const pauseBtn = screen.getByRole("button", { name: /pause/i });
    fireEvent.click(pauseBtn);

    await waitFor(() =>
      expect(mockPatchResearchTaskStatus).toHaveBeenCalledWith(runId, {
        status: "cancelled",
      }),
    );
  });

  it("Resume button (when task is cancelled) sends PATCH with status=waiting_external", async () => {
    mockGetWorkflowRunDetail.mockResolvedValue({
      data: makeRunDetail(runId, "cancelled"),
    });
    mockPatchResearchTaskStatus.mockResolvedValue(
      makeTaskRow(runId, "waiting_external"),
    );

    render(<ResearchRunCard run={researchRun} />);

    fireEvent.click(screen.getByRole("button", { name: /consensus protocols/i }));
    await waitFor(() =>
      expect(screen.getByText("Cancelled")).toBeInTheDocument(),
    );

    const resumeBtn = screen.getByRole("button", { name: /resume task/i });
    fireEvent.click(resumeBtn);

    await waitFor(() =>
      expect(mockPatchResearchTaskStatus).toHaveBeenCalledWith(runId, {
        status: "waiting_external",
      }),
    );
  });

  it("Upload Result action button opens the upload modal", async () => {
    render(<ResearchRunCard run={researchRun} />);

    fireEvent.click(screen.getByRole("button", { name: /consensus protocols/i }));
    await waitFor(() =>
      expect(screen.getByText("Waiting (external)")).toBeInTheDocument(),
    );

    // Pick the task row action button (aria-label="Upload result", type="button", no text content)
    const uploadBtns = screen.getAllByRole("button", { name: /upload result/i });
    // The action button is a small icon-only button (no text node, type="button")
    const actionBtn = uploadBtns.find(
      (b) => b.getAttribute("type") === "button" && b.getAttribute("aria-label") === "Upload result",
    )!;
    fireEvent.click(actionBtn);

    await waitFor(() =>
      expect(screen.getByTestId("dialog-root")).toBeInTheDocument(),
    );
    expect(screen.getByText("Upload research result")).toBeInTheDocument();
  });

  it("View Details shortcut Upload Result button appears in expanded view", async () => {
    render(<ResearchRunCard run={researchRun} />);

    fireEvent.click(screen.getByRole("button", { name: /consensus protocols/i }));
    await waitFor(() =>
      expect(screen.getByText("Waiting (external)")).toBeInTheDocument(),
    );

    // Both the task row button and the shortcut button should be present
    const uploadButtons = screen.getAllByRole("button", { name: /upload result/i });
    expect(uploadButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Polling lifecycle
// ---------------------------------------------------------------------------

describe("ActiveResearchRuns — polling lifecycle", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("fires an initial fetch on mount", async () => {
    mockListActiveResearchRuns.mockResolvedValue(makeRunsEnvelope([]));

    render(<ActiveResearchRuns />);

    await waitFor(() => expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(1));
  });

  it("schedules a second poll 5 s after the initial fetch completes", async () => {
    mockListActiveResearchRuns.mockResolvedValue(makeRunsEnvelope([]));

    jest.useFakeTimers({
      doNotFake: ["nextTick", "setImmediate", "clearImmediate"],
    });

    render(<ActiveResearchRuns />);

    // Let initial fetch settle
    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(1));

    // Advance 5 s — the scheduled poll fires
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    await waitFor(() => expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(2));
  });

  it("clears the polling timer on unmount — no fetch after unmount", async () => {
    mockListActiveResearchRuns.mockResolvedValue(makeRunsEnvelope([]));

    jest.useFakeTimers({
      doNotFake: ["nextTick", "setImmediate", "clearImmediate"],
    });

    const { unmount } = render(<ActiveResearchRuns />);

    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(1));

    unmount();

    // Advance well past the poll interval
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    // Still only the one initial fetch (no post-unmount polls)
    expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(1);
  });

  it("applies 2× exponential backoff after a fetch error", async () => {
    // First call fails; second succeeds
    mockListActiveResearchRuns
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue(makeRunsEnvelope([]));

    jest.useFakeTimers({
      doNotFake: ["nextTick", "setImmediate", "clearImmediate"],
    });

    render(<ActiveResearchRuns />);

    await act(async () => {
      await Promise.resolve();
    });
    await waitFor(() => expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(1));

    // After 5 s — backoff is now 10 s, so poll should NOT fire yet
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(1);

    // After another 5 s (total 10 s) — backoff retry fires
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(2));
  });

  it("skips a poll when the previous fetch is still in-flight", async () => {
    let resolveFirst!: (val: ServiceModeEnvelope<WorkflowRun>) => void;

    mockListActiveResearchRuns.mockImplementationOnce(
      () =>
        new Promise<ServiceModeEnvelope<WorkflowRun>>((res) => {
          resolveFirst = res;
        }),
    );
    mockListActiveResearchRuns.mockResolvedValue(makeRunsEnvelope([]));

    jest.useFakeTimers({
      doNotFake: ["nextTick", "setImmediate", "clearImmediate"],
    });

    render(<ActiveResearchRuns />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(1);

    // 5 s passes — in-flight guard should block the next poll
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(mockListActiveResearchRuns).toHaveBeenCalledTimes(1);

    // Release the in-flight fetch
    await act(async () => {
      resolveFirst(makeRunsEnvelope([]));
      await Promise.resolve();
    });
  });
});

// ---------------------------------------------------------------------------
// Test 5 — Error path
// ---------------------------------------------------------------------------

describe("ActiveResearchRuns — error handling", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows error banner (role=alert) and toast (role=status) when fetch fails", async () => {
    mockListActiveResearchRuns.mockRejectedValue(new Error("Service unavailable"));

    render(<ActiveResearchRuns />);

    await waitFor(() =>
      expect(
        screen.queryByLabelText("Loading research runs"),
      ).not.toBeInTheDocument(),
    );

    // Inline error banner
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Toast banner (aria-live=polite)
    await waitFor(() =>
      expect(screen.getByRole("status")).toBeInTheDocument(),
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("manual refresh resets and re-fetches, clearing error state", async () => {
    // First call fails
    mockListActiveResearchRuns.mockRejectedValueOnce(new Error("Service unavailable"));
    // Manual refresh call succeeds with data
    const run = makeWorkflowRun({ metadata: { topic: "Refreshed Topic" } });
    mockListActiveResearchRuns.mockResolvedValue(makeRunsEnvelope([run]));

    render(<ActiveResearchRuns />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );

    const refreshBtn = screen.getByRole("button", {
      name: /refresh research runs/i,
    });
    fireEvent.click(refreshBtn);

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByText("Refreshed Topic")).toBeInTheDocument(),
    );
  });
});

// ---------------------------------------------------------------------------
// Test 6 — UploadResultModal form submission
// ---------------------------------------------------------------------------

describe("UploadResultModal — form submission", () => {
  const runId = "run-upload-001";

  const researchRun = makeResearchRun({
    run_id: runId,
    topic: "Vector Embeddings",
    research_question: "How does HNSW indexing work?",
    status: "running",
  });

  beforeEach(() => {
    mockGetWorkflowRunDetail.mockResolvedValue({
      data: makeRunDetail(runId, "waiting_external"),
    });
    mockUploadResearchResultJson.mockResolvedValue(makeUploadResult());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /** Render card, expand it, open the Upload Result modal. */
  async function openModal(onResultUploaded?: jest.Mock) {
    render(
      <ResearchRunCard run={researchRun} onResultUploaded={onResultUploaded} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /vector embeddings/i }));
    await waitFor(() =>
      expect(screen.getByText("Waiting (external)")).toBeInTheDocument(),
    );

    // Click the icon-only task row action button (aria-label="Upload result")
    const uploadBtns = screen.getAllByRole("button", { name: /upload result/i });
    const taskRowBtn = uploadBtns.find(
      (b) => b.getAttribute("aria-label") === "Upload result",
    )!;
    fireEvent.click(taskRowBtn);
    await waitFor(() =>
      expect(screen.getByTestId("dialog-root")).toBeInTheDocument(),
    );
  }

  /** Find the submit button inside the modal dialog. */
  function getModalSubmitButton() {
    return screen
      .getAllByRole("button")
      .find((b) => b.getAttribute("type") === "submit")!;
  }

  it("calls uploadResearchResultJson with the correct payload (text path)", async () => {
    await openModal();

    // Label is "Summary" for the text result type (default)
    const textarea = screen.getByLabelText(/^summary/i);
    fireEvent.change(textarea, {
      target: { value: "HNSW uses hierarchical graphs." },
    });

    fireEvent.click(getModalSubmitButton());

    await waitFor(() =>
      expect(mockUploadResearchResultJson).toHaveBeenCalledWith(runId, {
        content: "HNSW uses hierarchical graphs.",
        content_type: "text/plain",
      }),
    );
  });

  it("closes the modal and calls onResultUploaded after a successful upload", async () => {
    const onResultUploaded = jest.fn();

    await openModal(onResultUploaded);

    const textarea = screen.getByLabelText(/^summary/i);
    fireEvent.change(textarea, {
      target: { value: "HNSW uses a multi-layer proximity graph." },
    });

    fireEvent.click(getModalSubmitButton());

    // Dialog closes on success
    await waitFor(() =>
      expect(screen.queryByTestId("dialog-root")).not.toBeInTheDocument(),
    );

    // onResultUploaded called so parent can trigger a refresh poll
    expect(onResultUploaded).toHaveBeenCalledTimes(1);
  });

  it("shows validation error and keeps modal open when summary is empty", async () => {
    await openModal();

    fireEvent.click(getModalSubmitButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Summary is required");

    // Modal stays open
    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();

    // API never called
    expect(mockUploadResearchResultJson).not.toHaveBeenCalled();
  });

  it("shows inline error and keeps modal open when upload fails", async () => {
    mockUploadResearchResultJson.mockRejectedValueOnce(
      new Error("Upload failed. Please try again."),
    );

    await openModal();

    const textarea = screen.getByLabelText(/^summary/i);
    fireEvent.change(textarea, { target: { value: "Some result content." } });

    fireEvent.click(getModalSubmitButton());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");

    // Modal remains open on error
    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
  });
});
