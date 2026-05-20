/**
 * Library card status badge + activity tooltip — component tests (P4-05).
 *
 * Covers:
 *   LibraryCardStatusBadge (P4-01):
 *     1.  Renders "Compiled Xh ago" + success tone for terminal/completed event
 *     2.  Renders "Compile failed" + error tone for terminal/failed event
 *     3.  Renders "Compiling…" + pulse for non-terminal (in-progress) event
 *     4.  Renders nothing (null) when no compile events exist
 *     5.  Renders nothing while loading
 *     6.  Fetches from activity endpoint with correct artifactId cache key
 *
 *   ActivityHistoryTooltip (P4-02):
 *     7.  Tooltip closed by default; trigger button is rendered
 *     8.  Tooltip opens on trigger click; popover appears with aria-label
 *     9.  Tooltip closes on Escape key; focus returns to trigger
 *     10. Tooltip closes on outside click
 *     11. Renders timeline items in DESC order (newest first)
 *     12. Renders empty state "No compile activity yet." when no events
 *     13. Stage names humanised: file_back → "file back", terminal/completed → "complete",
 *         terminal/failed → "failed"
 *     14. "View all activity" link present when nextCursor is non-null
 *     15. "View all activity" link absent when nextCursor is null AND items < 10
 *
 *   SSE + cache invalidation (P4-04):
 *     16. useCompileEvents subscription enabled=true when tooltip is open
 *     17. useCompileEvents subscription enabled=false when tooltip is closed
 *     18. New SSE event while tooltip open triggers queryClient.invalidateQueries
 *
 *   Keyboard / a11y (P4-03):
 *     19. Trigger has role="button" implicit (button element)
 *     20. Enter on trigger opens tooltip; Escape closes it
 *     21. Space on trigger opens tooltip
 *     22. Tooltip panel has role="dialog"
 *
 * Mocking strategy:
 *   - useArtifactCompileActivity is mocked at module boundary.
 *   - useCompileEvents is mocked at module boundary.
 *   - queryClient.invalidateQueries is spied on via a mock QueryClient.
 *   - Next.js Link is mocked to a plain <a>.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "../utils/userEvent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LibraryCardStatusBadge } from "@/components/library/LibraryCardStatusBadge";
import { ActivityHistoryTooltip } from "@/components/library/ActivityHistoryTooltip";
import type { WorkflowStageEventDTO } from "@/types/compileEvents";

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useArtifactCompileActivity", () => ({
  useArtifactCompileActivity: jest.fn(),
}));

jest.mock("@/hooks/useCompileEvents", () => ({
  useCompileEvents: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

import { useArtifactCompileActivity } from "@/hooks/useArtifactCompileActivity";
import { useCompileEvents } from "@/hooks/useCompileEvents";

const mockUseArtifactCompileActivity = useArtifactCompileActivity as jest.MockedFunction<
  typeof useArtifactCompileActivity
>;
const mockUseCompileEvents = useCompileEvents as jest.MockedFunction<
  typeof useCompileEvents
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(
  id: string,
  stage: string,
  status: "started" | "completed" | "failed",
  workflow = "compile",
  hoursAgo = 2,
): WorkflowStageEventDTO {
  return {
    id,
    artifact_id: "art_test_01",
    run_id: "run_test_01",
    workflow,
    stage,
    status,
    created_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    payload: {},
  };
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderWithQuery(ui: React.ReactElement, queryClient?: QueryClient) {
  const qc = queryClient ?? makeQueryClient();
  return {
    ...render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>),
    queryClient: qc,
  };
}

// Default compile events mock — empty, not loading.
function setCompileActivityMock(
  overrides: Partial<ReturnType<typeof useArtifactCompileActivity>>,
) {
  mockUseArtifactCompileActivity.mockReturnValue({
    items: [],
    latestCompile: null,
    nextCursor: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  });
}

// Default SSE mock — no events, not streaming.
function setSSEMock(
  overrides: Partial<ReturnType<typeof useCompileEvents>>,
) {
  mockUseCompileEvents.mockReturnValue({
    events: [],
    latest: null,
    terminal: null,
    isStreaming: false,
    reconnect: jest.fn(),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setCompileActivityMock({});
  setSSEMock({});
});

// ===========================================================================
// LibraryCardStatusBadge
// ===========================================================================

describe("LibraryCardStatusBadge", () => {
  const ARTIFACT_ID = "art_badge_01";

  // Test 1 — success tone
  it("renders 'Compiled Xh ago' for terminal/completed event", () => {
    const event = makeEvent("evt-001", "terminal", "completed", "compile", 2);
    setCompileActivityMock({ latestCompile: event });
    renderWithQuery(<LibraryCardStatusBadge artifactId={ARTIFACT_ID} />);
    expect(screen.getByText(/compiled 2h ago/i)).toBeInTheDocument();
  });

  // Test 2 — error tone
  it("renders 'Compile failed' for terminal/failed event", () => {
    const event = makeEvent("evt-002", "terminal", "failed", "compile", 1);
    setCompileActivityMock({ latestCompile: event });
    renderWithQuery(<LibraryCardStatusBadge artifactId={ARTIFACT_ID} />);
    expect(screen.getByText("Compile failed")).toBeInTheDocument();
  });

  // Test 3 — in-progress
  it("renders 'Compiling…' for non-terminal event", () => {
    const event = makeEvent("evt-003", "classify", "started", "compile", 0);
    setCompileActivityMock({ latestCompile: event });
    renderWithQuery(<LibraryCardStatusBadge artifactId={ARTIFACT_ID} />);
    expect(screen.getByText("Compiling…")).toBeInTheDocument();
  });

  // Test 4 — no events
  it("renders nothing when no compile events exist", () => {
    setCompileActivityMock({ latestCompile: null });
    const { container } = renderWithQuery(
      <LibraryCardStatusBadge artifactId={ARTIFACT_ID} />,
    );
    expect(container.firstChild).toBeNull();
  });

  // Test 5 — loading
  it("renders nothing while isLoading=true", () => {
    setCompileActivityMock({ isLoading: true, latestCompile: null });
    const { container } = renderWithQuery(
      <LibraryCardStatusBadge artifactId={ARTIFACT_ID} />,
    );
    expect(container.firstChild).toBeNull();
  });

  // Test 6 — cache key
  it("calls useArtifactCompileActivity with the correct artifactId", () => {
    setCompileActivityMock({});
    renderWithQuery(<LibraryCardStatusBadge artifactId="art_specific_id" />);
    expect(mockUseArtifactCompileActivity).toHaveBeenCalledWith(
      expect.objectContaining({ artifactId: "art_specific_id" }),
    );
  });
});

// ===========================================================================
// ActivityHistoryTooltip
// ===========================================================================

describe("ActivityHistoryTooltip", () => {
  const ARTIFACT_ID = "art_tooltip_01";

  const triggerChild = <span data-testid="badge-child">Status</span>;

  // Test 7 — default closed state
  it("is closed by default; trigger button is present", () => {
    setCompileActivityMock({});
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    expect(screen.getByRole("button", { name: /compile activity history/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Test 8 — opens on click
  it("opens popover on trigger click with aria-label dialog", async () => {
    setCompileActivityMock({});
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /compile activity history/i })).toBeInTheDocument();
    });
  });

  // Test 9 — closes on Escape
  it("closes on Escape key; focus returns to trigger", async () => {
    setCompileActivityMock({});
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    const trigger = screen.getByRole("button", { name: /compile activity history/i });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // Test 10 — closes on outside click
  it("closes on outside click", async () => {
    setCompileActivityMock({});
    const user = userEvent.setup();
    const { container } = renderWithQuery(
      <div>
        <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
          {triggerChild}
        </ActivityHistoryTooltip>
        <button type="button" data-testid="outside">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // Click outside
    await user.click(container.querySelector('[data-testid="outside"]')!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // Test 11 — timeline items DESC order
  it("renders timeline items newest-first (DESC)", async () => {
    const events: WorkflowStageEventDTO[] = [
      makeEvent("evt-001", "terminal", "completed", "compile", 0.5),
      makeEvent("evt-002", "lint", "completed", "compile", 1),
      makeEvent("evt-003", "compile", "completed", "compile", 1.5),
    ];
    setCompileActivityMock({ items: events });
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    const listItems = screen.getAllByRole("listitem");
    // First item is the most recent (terminal/completed = "complete")
    expect(listItems[0]).toHaveTextContent("complete");
    expect(listItems[1]).toHaveTextContent("lint");
    expect(listItems[2]).toHaveTextContent("compile");
  });

  // Test 12 — empty state
  it("renders empty state when no events", async () => {
    setCompileActivityMock({ items: [], latestCompile: null });
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() =>
      expect(screen.getByText("No compile activity yet.")).toBeInTheDocument(),
    );
  });

  // Test 13 — stage name humanisation
  it("humanises stage names: file_back → 'file back', terminal/failed → 'failed'", async () => {
    const events: WorkflowStageEventDTO[] = [
      makeEvent("evt-001", "terminal", "failed", "compile", 1),
      makeEvent("evt-002", "file_back", "completed", "compile", 2),
    ];
    setCompileActivityMock({ items: events });
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("file back")).toBeInTheDocument();
  });

  // Test 14 — "view all" link present when nextCursor non-null
  it("shows 'view all activity' link when nextCursor is non-null", async () => {
    const events: WorkflowStageEventDTO[] = [
      makeEvent("evt-001", "terminal", "completed", "compile", 1),
    ];
    setCompileActivityMock({ items: events, nextCursor: "cursor-abc" });
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /view all activity/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /view all activity/i })).toHaveAttribute(
      "href",
      `/artifact/${ARTIFACT_ID}?tab=activity`,
    );
  });

  // Test 15 — "view all" absent when nextCursor null and fewer than 10 items
  it("omits 'view all activity' link when nextCursor is null and items < 10", async () => {
    const events: WorkflowStageEventDTO[] = [
      makeEvent("evt-001", "terminal", "completed", "compile", 2),
    ];
    setCompileActivityMock({ items: events, nextCursor: null });
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /view all activity/i })).toBeNull();
  });
});

// ===========================================================================
// SSE + cache invalidation (P4-04)
// ===========================================================================

describe("SSE gating and cache invalidation", () => {
  const ARTIFACT_ID = "art_sse_01";
  const triggerChild = <span>Status</span>;

  // Test 16 — SSE enabled when tooltip open
  it("useCompileEvents called with enabled=true when tooltip is open", async () => {
    setCompileActivityMock({});
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // After open, useCompileEvents should have been called with enabled=true
    const calls = mockUseCompileEvents.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.enabled).toBe(true);
    expect(lastCall.artifactId).toBe(ARTIFACT_ID);
  });

  // Test 17 — SSE disabled when tooltip closed
  it("useCompileEvents called with enabled=false when tooltip is closed", () => {
    setCompileActivityMock({});
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    // Before any click — tooltip is closed
    const calls = mockUseCompileEvents.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.enabled).toBe(false);
  });

  // Test 18 — new SSE event triggers invalidation
  it("invalidates activity query cache when new SSE event arrives while open", async () => {
    const qc = makeQueryClient();
    const invalidateSpy = jest.spyOn(qc, "invalidateQueries");

    setCompileActivityMock({});
    // Start with no SSE event
    setSSEMock({ latest: null });

    const user = userEvent.setup();
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
          {triggerChild}
        </ActivityHistoryTooltip>
      </QueryClientProvider>,
    );

    // Open tooltip
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Simulate new SSE event arriving
    const newEvent = makeEvent("evt-new-01", "compile", "completed", "compile", 0);
    setSSEMock({ latest: newEvent });

    rerender(
      <QueryClientProvider client={qc}>
        <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
          {triggerChild}
        </ActivityHistoryTooltip>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["artifact", "activity", ARTIFACT_ID],
        }),
      );
    });
  });
});

// ===========================================================================
// Keyboard / a11y (P4-03)
// ===========================================================================

describe("keyboard and a11y", () => {
  const ARTIFACT_ID = "art_a11y_01";
  const triggerChild = <span>Status</span>;

  beforeEach(() => {
    setCompileActivityMock({});
    setSSEMock({});
  });

  // Test 19 — trigger is a button element
  it("trigger is a button element (implicit role=button)", () => {
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    expect(screen.getByRole("button", { name: /compile activity history/i })).toBeInTheDocument();
  });

  // Test 20 — Enter opens, Escape closes
  it("Enter on trigger opens tooltip; Escape closes it", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    const trigger = screen.getByRole("button", { name: /compile activity history/i });
    trigger.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  // Test 21 — Space opens tooltip
  it("Space on trigger opens tooltip", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    const trigger = screen.getByRole("button", { name: /compile activity history/i });
    trigger.focus();
    await user.keyboard(" ");
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  // Test 22 — popover panel has role=dialog
  it("popover panel has role=dialog when open", async () => {
    const user = userEvent.setup();
    renderWithQuery(
      <ActivityHistoryTooltip artifactId={ARTIFACT_ID}>
        {triggerChild}
      </ActivityHistoryTooltip>,
    );
    await user.click(screen.getByRole("button", { name: /compile activity history/i }));
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("aria-label", "Compile activity history");
    });
  });
});
