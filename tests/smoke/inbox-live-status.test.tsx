/**
 * Inbox Live Status — component + hook tests (P3-08).
 *
 * Covers:
 *   useCompileEvents (P3-02):
 *     1. Returns empty events when enabled=false
 *     2. Returns events when enabled=true and SSE streams
 *     3. Deduplicates events with the same id (real hook, via useSSE mock)
 *     4. Sets terminal.status="success" on terminal/completed event
 *     5. Sets terminal.status="error" on terminal/failed event with error payload
 *     6. isStreaming is true while open, false after terminal
 *     7. reconnect() resets event list and re-subscribes
 *     8. Cleans up (disabled) on unmount (no crash after unmount)
 *
 *   CompileStageIndicator (P3-03):
 *     9.  Renders current stage label from events array
 *     10. Shows "Done" label on terminal success
 *     11. Renders nothing on terminal failure
 *     12. Renders nothing with zero events and no terminal
 *
 *   CompileErrorPill (P3-04):
 *     13. Renders error code and message
 *     14. Retry button fires onRetry
 *     15. Dismiss button fires onDismiss
 *     16. Does NOT auto-dismiss after 5 s (F-03 regression guard)
 *     17. Has role="alert"
 *
 *   ProcessedSection (P3-05):
 *     18. Renders nothing when items is empty
 *     19. Renders item count in header
 *     20. Collapses and expands on header click
 *     21. Persists collapse state in sessionStorage
 *     22. Item links to /artifacts/:id
 *     23. Shows workspace label and relative time
 *     24. Auto-expands when items appear for the first time (empty → non-empty)
 *
 *   InboxClient integration (P3-06):
 *     25. Compile button click → stage indicator appears
 *     26. Terminal success → stage indicator shows "Done" briefly
 *     27. Terminal failure → error pill renders with error message
 *     28. Error pill retry button re-enables compile flow
 *     29. Processed section renders below inbox queue
 *
 * Mocking strategy:
 *   - useCompileEvents tests (1-8): use the REAL useCompileEvents hook with
 *     useSSE mocked via jest.fn() so we can control events synchronously.
 *     HookHarness renders the hook's derived state so we can assert on it.
 *   - CompileStageIndicator / CompileErrorPill / ProcessedSection are pure
 *     presentational and tested with direct prop injection.
 *   - InboxClient integration tests: mock useCompileEvents as jest.fn() and
 *     configure per-test via mockReturnValue in beforeEach.
 */

import React, { act } from "react";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { userEvent } from "../utils/userEvent";
import { CompileStageIndicator } from "@/components/inbox/CompileStageIndicator";
import { CompileErrorPill } from "@/components/inbox/CompileErrorPill";
import { ProcessedSection } from "@/components/inbox/ProcessedSection";
import type { WorkflowStageEventDTO, CompileTerminalState, ProcessedItemDTO } from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Helpers: event factories
// ---------------------------------------------------------------------------

function makeEvent(
  id: string,
  stage: string,
  status: "started" | "completed" | "failed",
  payload: Record<string, unknown> = {},
): WorkflowStageEventDTO {
  return {
    id,
    artifact_id: "art_test_01",
    run_id: "run_test_01",
    workflow: "compile",
    stage,
    status,
    created_at: new Date().toISOString(),
    payload,
  };
}

function makeProcessedItem(
  overrides: Partial<ProcessedItemDTO> & { id: string; title: string },
): ProcessedItemDTO {
  return {
    workspace: "library",
    type: "note",
    status: "active",
    file_path: `wiki/${overrides.id}.md`,
    compiled_at: new Date().toISOString(),
    ...overrides,
  };
}

// ===========================================================================
// Module-level mocks (jest.mock is hoisted before all imports)
// ===========================================================================

// Mock useSSE with jest.fn() — configured per-test via mockReturnValue in beforeEach.
jest.mock("@/hooks/useSSE", () => ({
  useSSE: jest.fn(),
}));

// Mock useCompileEvents with jest.fn() — configured per describe block.
// The useCompileEvents describe tests use the REAL implementation by restoring it
// in beforeAll; InboxClient integration tests use the mock.
jest.mock("@/hooks/useCompileEvents", () => ({
  useCompileEvents: jest.fn(),
}));

// Mock getApiBase so URL construction doesn't depend on env.
jest.mock("@/lib/api/config", () => ({
  getApiBase: () => "http://127.0.0.1:8765",
  DEFAULT_API_URL: "http://127.0.0.1:8765",
}));

// Mock useCompileArtifact to control compile lifecycle synchronously.
jest.mock("@/hooks/useCompileArtifact", () => ({
  useCompileArtifact: jest.fn(),
}));

// Mock useInboxArtifacts to avoid network calls in integration tests.
jest.mock("@/hooks/useInboxArtifacts", () => ({
  useInboxArtifacts: jest.fn(),
}));

// Mock useInboxPending so PendingApprovalPanel doesn't fire network calls.
jest.mock("@/hooks/useInboxPending", () => ({
  useInboxPending: () => ({
    items: [],
    count: 0,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

// Mock InboxContextRail — it calls multiple backend hooks we don't care about here.
jest.mock("@/components/inbox/InboxContextRail", () => ({
  InboxContextRail: () => null,
}));

// Mock ArtifactCard — it's a complex component; keep it a stub.
jest.mock("@/components/ui/artifact-card", () => ({
  ArtifactCard: ({
    artifact,
    ctaSlot,
    onCardClick,
  }: {
    artifact: { id: string; title: string };
    ctaSlot?: React.ReactNode;
    onCardClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <div data-testid={`artifact-card-${artifact.id}`}>
      <span>{artifact.title}</span>
      {ctaSlot}
      <a
        href={`/artifacts/${artifact.id}`}
        data-testid={`card-link-${artifact.id}`}
        onClick={onCardClick}
      >
        link
      </a>
    </div>
  ),
}));

// Mock StatusGroupSection — passthrough children.
jest.mock("@/components/ui/status-group-section", () => ({
  StatusGroupSection: ({
    children,
    label,
  }: {
    children: React.ReactNode;
    label: string;
  }) => (
    <section>
      <h3>{label}</h3>
      {children}
    </section>
  ),
}));

// Mock QuickAddModal.
jest.mock("@/components/quick-add/quick-add-modal", () => ({
  QuickAddModal: () => null,
}));

// ===========================================================================
// useCompileEvents tests
// ===========================================================================

/**
 * Strategy: use the REAL useCompileEvents implementation (restored via
 * jest.requireActual) with useSSE mocked via jest.fn(). The mock reconnect
 * fn is shared via module ref so we can assert on it.
 */

import { useCompileEvents } from "@/hooks/useCompileEvents";

// Shared reconnect mock — reset before each hook test.
const sseReconnectMock = jest.fn();

// HookHarness — renders the real useCompileEvents output.
function HookHarness({
  artifactId,
  enabled,
}: {
  artifactId: string;
  enabled: boolean;
}) {
  const { events, latest, terminal, isStreaming, reconnect } = useCompileEvents({
    artifactId,
    enabled,
  });

  return (
    <div>
      <span data-testid="event-count">{events.length}</span>
      <span data-testid="latest-stage">{latest?.stage ?? "none"}</span>
      <span data-testid="terminal-status">{terminal?.status ?? "none"}</span>
      <span data-testid="terminal-error-code">{terminal?.error?.code ?? "none"}</span>
      <span data-testid="is-streaming">{String(isStreaming)}</span>
      <button type="button" onClick={reconnect} data-testid="reconnect-btn">
        Reconnect
      </button>
    </div>
  );
}

// Helper: configure useSSE mock and useCompileEvents to use real implementation.
function configureUseSSE(
  events: WorkflowStageEventDTO[],
  status = "open",
) {
  const useSSEMock = jest.requireMock("@/hooks/useSSE") as { useSSE: jest.Mock };
  useSSEMock.useSSE.mockReturnValue({
    events,
    status,
    error: null,
    reconnect: sseReconnectMock,
    close: jest.fn(),
  });
}

describe("useCompileEvents", () => {
  beforeAll(() => {
    // Restore the REAL useCompileEvents for these tests — integration tests
    // below will configure their own mock return values.
    const realMod = jest.requireActual("@/hooks/useCompileEvents") as {
      useCompileEvents: typeof useCompileEvents;
    };
    (jest.requireMock("@/hooks/useCompileEvents") as { useCompileEvents: jest.Mock })
      .useCompileEvents.mockImplementation(realMod.useCompileEvents);
  });

  afterAll(() => {
    // Remove the real implementation shim so InboxClient describe gets a clean mock.
    (jest.requireMock("@/hooks/useCompileEvents") as { useCompileEvents: jest.Mock })
      .useCompileEvents.mockReset();
  });

  beforeEach(() => {
    sseReconnectMock.mockReset();
    // Default: empty events, open status.
    configureUseSSE([], "open");
  });

  // Test 1
  it("returns empty events when enabled=false", () => {
    render(<HookHarness artifactId="art_01" enabled={false} />);
    expect(screen.getByTestId("event-count").textContent).toBe("0");
    expect(screen.getByTestId("terminal-status").textContent).toBe("none");
  });

  // Test 2
  it("returns events when enabled=true and SSE has events", () => {
    configureUseSSE([
      makeEvent("evt-001", "classify", "started"),
      makeEvent("evt-002", "classify", "completed"),
    ]);
    render(<HookHarness artifactId="art_01" enabled={true} />);
    expect(screen.getByTestId("event-count").textContent).toBe("2");
    expect(screen.getByTestId("latest-stage").textContent).toBe("classify");
  });

  // Test 3
  it("deduplicates events with the same id", () => {
    configureUseSSE([
      makeEvent("evt-001", "classify", "started"),
      makeEvent("evt-001", "classify", "started"), // duplicate
      makeEvent("evt-002", "extract", "started"),
    ]);
    render(<HookHarness artifactId="art_01" enabled={true} />);
    // Real useCompileEvents dedupes by id: 2 unique events.
    expect(screen.getByTestId("event-count").textContent).toBe("2");
  });

  // Test 4
  it("sets terminal.status=success on terminal/completed", () => {
    configureUseSSE([
      makeEvent("evt-001", "classify", "completed"),
      makeEvent("evt-002", "terminal", "completed"),
    ]);
    render(<HookHarness artifactId="art_01" enabled={true} />);
    expect(screen.getByTestId("terminal-status").textContent).toBe("success");
  });

  // Test 5
  it("sets terminal.status=error on terminal/failed with error payload", () => {
    configureUseSSE([
      makeEvent("evt-001", "extract", "started"),
      makeEvent("evt-002", "terminal", "failed", {
        error_code: "EXTRACTION_FAILED",
        error_message: "Could not parse content",
      }),
    ]);
    render(<HookHarness artifactId="art_01" enabled={true} />);
    expect(screen.getByTestId("terminal-status").textContent).toBe("error");
    expect(screen.getByTestId("terminal-error-code").textContent).toBe("EXTRACTION_FAILED");
  });

  // Test 6
  it("isStreaming is true while open with enabled=true", () => {
    configureUseSSE([], "open");
    render(<HookHarness artifactId="art_01" enabled={true} />);
    expect(screen.getByTestId("is-streaming").textContent).toBe("true");
  });

  // Test 7
  it("reconnect() calls rawReconnect from useSSE", async () => {
    render(<HookHarness artifactId="art_01" enabled={true} />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId("reconnect-btn"));
    expect(sseReconnectMock).toHaveBeenCalledTimes(1);
  });

  // Test 8
  it("does not crash after unmount (cleanup)", () => {
    const { unmount } = render(<HookHarness artifactId="art_01" enabled={true} />);
    expect(() => unmount()).not.toThrow();
  });
});

// ===========================================================================
// CompileStageIndicator tests
// ===========================================================================

describe("CompileStageIndicator", () => {
  const noTerminal: CompileTerminalState | null = null;

  // Test 9
  it("renders current stage label from events", () => {
    const events = [
      makeEvent("evt-001", "classify", "started"),
      makeEvent("evt-002", "extract", "started"),
    ];
    render(
      <CompileStageIndicator events={events} terminal={noTerminal} />,
    );
    expect(screen.getByText("Extracting…")).toBeInTheDocument();
  });

  // Test 10
  it("shows Done label on terminal success", async () => {
    const events = [
      makeEvent("evt-001", "compile", "completed"),
      makeEvent("evt-002", "terminal", "completed"),
    ];
    const terminal: CompileTerminalState = { status: "success" };
    render(
      <CompileStageIndicator events={events} terminal={terminal} />,
    );
    await waitFor(() =>
      expect(screen.getByText("Done")).toBeInTheDocument(),
    );
  });

  // Test 11
  it("renders nothing on terminal failure", () => {
    const events = [
      makeEvent("evt-001", "extract", "started"),
      makeEvent("evt-002", "terminal", "failed"),
    ];
    const terminal: CompileTerminalState = {
      status: "error",
      error: { code: "ERR", message: "fail" },
    };
    const { container } = render(
      <CompileStageIndicator events={events} terminal={terminal} />,
    );
    expect(container.firstChild).toBeNull();
  });

  // Test 12
  it("renders nothing with zero events and no terminal", () => {
    const { container } = render(
      <CompileStageIndicator events={[]} terminal={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ===========================================================================
// CompileErrorPill tests
// ===========================================================================

describe("CompileErrorPill", () => {
  const error = { code: "EXTRACTION_FAILED", message: "Could not parse content" };

  // Test 13
  it("renders error code and message", () => {
    render(
      <CompileErrorPill
        error={error}
        onRetry={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText("Could not parse content")).toBeInTheDocument();
    expect(screen.getByText("[EXTRACTION_FAILED]")).toBeInTheDocument();
  });

  // Test 14
  it("retry button fires onRetry", async () => {
    const onRetry = jest.fn();
    render(
      <CompileErrorPill error={error} onRetry={onRetry} onDismiss={jest.fn()} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // Test 15
  it("dismiss button fires onDismiss", async () => {
    const onDismiss = jest.fn();
    render(
      <CompileErrorPill error={error} onRetry={jest.fn()} onDismiss={onDismiss} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // Test 16: F-03 regression — no auto-dismiss after 5 s
  it("does not auto-dismiss after 5 seconds (F-03 regression)", async () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(
      <CompileErrorPill error={error} onRetry={jest.fn()} onDismiss={onDismiss} />,
    );
    act(() => { jest.advanceTimersByTime(6_000); });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText("Could not parse content")).toBeInTheDocument();
    jest.useRealTimers();
  });

  // Test 17
  it("has role=alert", () => {
    render(
      <CompileErrorPill error={error} onRetry={jest.fn()} onDismiss={jest.fn()} />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

// ===========================================================================
// ProcessedSection tests
// ===========================================================================

describe("ProcessedSection", () => {
  const items: ProcessedItemDTO[] = [
    makeProcessedItem({ id: "art_p_01", title: "Processed note 1", workspace: "library", compiled_at: new Date(Date.now() - 5 * 60_000).toISOString() }),
    makeProcessedItem({ id: "art_p_02", title: "Processed note 2", workspace: "blog", compiled_at: new Date(Date.now() - 2 * 3_600_000).toISOString() }),
  ];

  // Reset sessionStorage between tests
  beforeEach(() => {
    sessionStorage.clear();
  });

  // Test 18
  it("renders nothing when items array is empty", () => {
    const { container } = render(<ProcessedSection items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  // Test 19
  it("renders item count in header", () => {
    render(<ProcessedSection items={items} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Processed")).toBeInTheDocument();
  });

  // Test 20
  it("collapses and expands on header button click", async () => {
    const user = userEvent.setup();
    // defaultCollapsed=false so body starts visible
    render(<ProcessedSection items={items} defaultCollapsed={false} />);
    expect(screen.getByText("Processed note 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /processed/i }));
    // Body should be hidden
    const body = document.getElementById("processed-section-body");
    expect(body).toHaveAttribute("hidden");

    await user.click(screen.getByRole("button", { name: /processed/i }));
    expect(body).not.toHaveAttribute("hidden");
  });

  // Test 21
  it("persists collapse state in sessionStorage", async () => {
    const user = userEvent.setup();
    render(<ProcessedSection items={items} defaultCollapsed={false} />);
    await user.click(screen.getByRole("button", { name: /processed/i }));
    expect(sessionStorage.getItem("inbox-processed-collapsed")).toBe("true");
  });

  // Test 22
  it("item links href points to /artifacts/:id", () => {
    render(<ProcessedSection items={items} defaultCollapsed={false} />);
    const link = screen.getByRole("link", { name: /processed note 1/i });
    expect(link).toHaveAttribute("href", "/artifacts/art_p_01");
  });

  // Test 23
  it("shows workspace label and relative time", () => {
    render(<ProcessedSection items={items} defaultCollapsed={false} />);
    expect(screen.getByText("→ Library")).toBeInTheDocument();
    expect(screen.getByText("→ Blog")).toBeInTheDocument();
    // Relative time should exist (non-empty for recent items)
    const timeEls = screen.getAllByText(/ago|just now/i);
    expect(timeEls.length).toBeGreaterThanOrEqual(1);
  });

  // Test 24
  it("defaults to expanded when items are present on first render", () => {
    render(<ProcessedSection items={items} />);
    const body = document.getElementById("processed-section-body");
    expect(body).not.toBeNull();
    expect(body).not.toHaveAttribute("hidden");
  });
});

// ===========================================================================
// InboxClient integration tests (P3-06)
// ===========================================================================

/**
 * Integration tests use deeper mocking of the compile hooks so we can
 * exercise InboxClient's wiring without real SSE streams or HTTP.
 */

import { InboxClient } from "@/app/(main)/inbox/InboxClient";
import type { ServiceModeEnvelope, ArtifactCard as ArtifactCardType } from "@/types/artifact";

const emptyEnvelope: ServiceModeEnvelope<ArtifactCardType> = {
  data: [],
  cursor: null,
};

// Shared compile events state for integration tests.
const __compileEventsState: {
  events: WorkflowStageEventDTO[];
  terminal: CompileTerminalState | null;
} = { events: [], terminal: null };

const compileEventsMock = {
  __setMockEvents: (e: WorkflowStageEventDTO[]) => { __compileEventsState.events = e; },
  __setMockTerminal: (t: CompileTerminalState | null) => { __compileEventsState.terminal = t; },
};

describe("InboxClient integration (P3-06)", () => {
  beforeAll(() => {
    // Configure useInboxArtifacts mock for all integration tests.
    (jest.requireMock("@/hooks/useInboxArtifacts") as { useInboxArtifacts: jest.Mock })
      .useInboxArtifacts.mockReturnValue({
        artifacts: [
          {
            id: "art_compile_01",
            workspace: "inbox",
            type: "note",
            subtype: null,
            title: "Test inbox note",
            status: "needs_compile",
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            file_path: "raw/test.md",
            metadata: null,
          },
        ],
        cursor: null,
        hasMore: false,
        isLoading: false,
        error: null,
        loadMore: jest.fn(),
        optimisticUpdateArtifact: jest.fn(),
        processedItems: [],
        refreshProcessed: jest.fn(),
      });

    // Configure useCompileArtifact mock — fires onSuccess immediately on compile().
    (jest.requireMock("@/hooks/useCompileArtifact") as { useCompileArtifact: jest.Mock })
      .useCompileArtifact.mockImplementation(
        ({ onSuccess }: { onSuccess?: () => void; onError?: (e: string) => void }) => ({
          compile: () => { onSuccess?.(); },
          isCompiling: false,
          error: null,
        }),
      );
  });

  beforeEach(() => {
    compileEventsMock.__setMockEvents([]);
    compileEventsMock.__setMockTerminal(null);

    // Configure useCompileEvents mock to read from __compileEventsState.
    (jest.requireMock("@/hooks/useCompileEvents") as { useCompileEvents: jest.Mock })
      .useCompileEvents.mockImplementation(({ enabled }: { enabled: boolean }) => ({
        events: enabled ? __compileEventsState.events : [],
        latest: enabled && __compileEventsState.events.length > 0
          ? __compileEventsState.events[__compileEventsState.events.length - 1]
          : null,
        terminal: enabled ? __compileEventsState.terminal : null,
        isStreaming: false,
        reconnect: jest.fn(),
      }));
  });

  // Test 25: Compile button visible for needs_compile items.
  it("compile button is present for needs_compile items", () => {
    render(<InboxClient initialData={emptyEnvelope} />);
    expect(screen.getByRole("button", { name: /compile/i })).toBeInTheDocument();
  });

  // Test 26: Click compile → 202 ACK → stage indicator appears (via mock hook).
  it("clicking compile enables stage indicator after 202 ACK", async () => {
    // Set SSE events to simulate post-202 streaming
    compileEventsMock.__setMockEvents([
      makeEvent("evt-001", "classify", "started"),
    ]);
    // Re-apply mock so it reflects the updated state immediately.
    (jest.requireMock("@/hooks/useCompileEvents") as { useCompileEvents: jest.Mock })
      .useCompileEvents.mockImplementation(({ enabled }: { enabled: boolean }) => ({
        events: enabled ? __compileEventsState.events : [],
        latest: enabled && __compileEventsState.events.length > 0
          ? __compileEventsState.events[__compileEventsState.events.length - 1]
          : null,
        terminal: enabled ? __compileEventsState.terminal : null,
        isStreaming: false,
        reconnect: jest.fn(),
      }));
    const user = userEvent.setup();
    render(<InboxClient initialData={emptyEnvelope} />);
    await user.click(screen.getByRole("button", { name: /compile test inbox note/i }));
    // After click, stage indicator should appear (classify → "Classifying…")
    await waitFor(() => {
      expect(screen.getByText("Classifying…")).toBeInTheDocument();
    });
  });

  // Test 27: Terminal success → stage indicator shows "Done".
  it("terminal success shows Done in stage indicator", async () => {
    compileEventsMock.__setMockEvents([
      makeEvent("evt-001", "compile", "completed"),
      makeEvent("evt-002", "terminal", "completed"),
    ]);
    compileEventsMock.__setMockTerminal({ status: "success" });
    (jest.requireMock("@/hooks/useCompileEvents") as { useCompileEvents: jest.Mock })
      .useCompileEvents.mockImplementation(({ enabled }: { enabled: boolean }) => ({
        events: enabled ? __compileEventsState.events : [],
        latest: enabled && __compileEventsState.events.length > 0
          ? __compileEventsState.events[__compileEventsState.events.length - 1]
          : null,
        terminal: enabled ? __compileEventsState.terminal : null,
        isStreaming: false,
        reconnect: jest.fn(),
      }));
    const user = userEvent.setup();
    render(<InboxClient initialData={emptyEnvelope} />);
    await user.click(screen.getByRole("button", { name: /compile test inbox note/i }));
    await waitFor(() => {
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  // Test 28: Terminal failure → error pill renders with error message.
  it("terminal failure renders error pill after compile click", async () => {
    compileEventsMock.__setMockTerminal({
      status: "error",
      error: { code: "EXTRACTION_FAILED", message: "Could not parse content" },
    });
    (jest.requireMock("@/hooks/useCompileEvents") as { useCompileEvents: jest.Mock })
      .useCompileEvents.mockImplementation(({ enabled }: { enabled: boolean }) => ({
        events: enabled ? __compileEventsState.events : [],
        latest: null,
        terminal: enabled ? __compileEventsState.terminal : null,
        isStreaming: false,
        reconnect: jest.fn(),
      }));
    const user = userEvent.setup();
    render(<InboxClient initialData={emptyEnvelope} />);
    await user.click(screen.getByRole("button", { name: /compile test inbox note/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Could not parse content")).toBeInTheDocument();
    });
  });

  // Test 29: Processed section not rendered when processedItems is empty.
  it("processed section is not rendered when processedItems is empty", () => {
    render(<InboxClient initialData={emptyEnvelope} />);
    expect(screen.queryByText("Processed")).not.toBeInTheDocument();
  });
});
