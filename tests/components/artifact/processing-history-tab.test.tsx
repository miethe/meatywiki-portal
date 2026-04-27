/**
 * Tests for ProcessingHistoryTab (P2-02).
 *
 * Covers:
 *   - Renders timeline rows from MSW fixture data
 *   - Correct number of timeline items
 *   - Amber "Degraded" badge present on stage_degraded events
 *   - Red "Failed" badge present on compile_failed events
 *   - No status badge on stage_completed events
 *   - Empty state when endpoint returns empty array
 *   - Error state with retry button when endpoint errors
 *
 * Mocking strategy:
 *   - apiFetch is mocked at module boundary to avoid HTTP in unit tests.
 *   - Each describe block overrides the mock to the scenario under test.
 *   - TanStack QueryClient is reset per-test (retry: 0 to surface errors fast).
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Module mock — apiFetch controlled per test
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/client", () => ({
  ...jest.requireActual("@/lib/api/client"),
  apiFetch: jest.fn(),
}));

import { apiFetch } from "@/lib/api/client";
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

import { ProcessingHistoryTab } from "@/components/artifact/processing-history-tab";
import type { StageEventItem } from "@/hooks/use-processing-history";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ARTIFACT_ID = "01HXYZ0000000000000000001";

function makeEvent(overrides: Partial<StageEventItem> = {}): StageEventItem {
  return {
    event_id: "01HWXYZ0000000000000001",
    event_type: "stage_completed",
    stage_name: "extract",
    created_at: "2026-04-27T10:00:00Z",
    duration_ms: 1250.5,
    output_summary: "extracted 3 entities, 2 concepts",
    error_detail: null,
    degraded_reason: null,
    run_id: "01HWXYZ0000000000000000",
    template_id: "default",
    ...overrides,
  };
}

/** A realistic mixed-type fixture covering all badge scenarios. */
const MIXED_FIXTURE: StageEventItem[] = [
  makeEvent({
    event_id: "evt-001",
    event_type: "stage_started",
    stage_name: "classify",
    created_at: "2026-04-27T09:58:00Z",
    duration_ms: null,
    output_summary: null,
  }),
  makeEvent({
    event_id: "evt-002",
    event_type: "stage_completed",
    stage_name: "classify",
    created_at: "2026-04-27T09:59:00Z",
    duration_ms: 820.0,
    output_summary: "classified as concept",
  }),
  makeEvent({
    event_id: "evt-003",
    event_type: "stage_degraded",
    stage_name: "compile",
    created_at: "2026-04-27T10:00:00Z",
    duration_ms: 2100.0,
    output_summary: null,
    degraded_reason: "LLM response truncated at token limit",
  }),
  makeEvent({
    event_id: "evt-004",
    event_type: "compile_failed",
    stage_name: "lint",
    created_at: "2026-04-27T10:01:00Z",
    duration_ms: null,
    error_detail: "schema validation error: missing required field 'title'",
    degraded_reason: null,
  }),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderTab(artifactId = ARTIFACT_ID) {
  return render(<ProcessingHistoryTab artifactId={artifactId} />, {
    wrapper: makeWrapper(),
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

// ===========================================================================
// 1. Populated state
// ===========================================================================

describe("ProcessingHistoryTab — populated state", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ data: MIXED_FIXTURE });
  });

  it("renders a timeline item for each event in the fixture", async () => {
    renderTab();

    // Wait for the section to appear (populated state — not the loading skeleton)
    await waitFor(
      () => {
        expect(
          screen.getByRole("region", { name: /processing history/i }),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(MIXED_FIXTURE.length);
  });

  it("renders stage names in the timeline", async () => {
    renderTab();

    await waitFor(
      () => {
        // classify appears twice (stage_started + stage_completed rows)
        expect(screen.getAllByText("classify").length).toBeGreaterThanOrEqual(1);
        // compile appears in the stage_degraded row
        expect(screen.getAllByText("compile").length).toBeGreaterThanOrEqual(1);
        // lint appears in the compile_failed row
        expect(screen.getAllByText("lint").length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 },
    );
  });

  it("renders amber 'Degraded' badge on stage_degraded events", async () => {
    renderTab();

    // Wait until the populated region is visible (data loaded)
    await waitFor(
      () => expect(screen.getByRole("region", { name: /processing history/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // The pill badge has role="img" with aria-label; find it by that label
    const degradedBadge = screen.getByRole("img", {
      name: /^Degraded:/i,
    });
    expect(degradedBadge).toBeInTheDocument();
    // Badge carries amber colour classes
    expect(degradedBadge.className).toMatch(/amber/);
  });

  it("renders red 'Failed' badge on compile_failed events", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getByRole("region", { name: /processing history/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // The pill badge has role="img" with aria-label starting with "Failed:"
    const failedBadge = screen.getByRole("img", {
      name: /^Failed:/i,
    });
    expect(failedBadge).toBeInTheDocument();
    expect(failedBadge.className).toMatch(/red/);
  });

  it("does not render a status badge on stage_completed events", async () => {
    // stage_completed rows do NOT get a pill badge (Degraded/Failed badge pills use role="img").
    // Only stage_degraded and compile_failed/stage_failed rows get pill badges.
    renderTab();

    await waitFor(
      () => expect(screen.getByRole("region", { name: /processing history/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // Exactly one Degraded pill badge (from stage_degraded) and one Failed pill badge
    // (from compile_failed). No badge on stage_completed or stage_started rows.
    const degradedBadges = screen.getAllByRole("img", { name: /^Degraded:/i });
    const failedBadges = screen.getAllByRole("img", { name: /^Failed:/i });
    expect(degradedBadges).toHaveLength(1);
    expect(failedBadges).toHaveLength(1);
  });

  it("shows duration for events with duration_ms", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getByRole("region", { name: /processing history/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );

    // evt-002: 820ms
    expect(screen.getByText("820ms")).toBeInTheDocument();
    // evt-003: 2100ms → 2.1s
    expect(screen.getByText("2.1s")).toBeInTheDocument();
  });

  it("shows the output_summary expand button for events with output_summary", async () => {
    renderTab();

    await waitFor(
      () => {
        const btns = screen.getAllByText("Show detail");
        expect(btns.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it("reveals degraded_reason content when 'Show detail' is expanded on a degraded row", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getAllByText("Show detail").length).toBeGreaterThan(0),
      { timeout: 3000 },
    );

    // Click through all Show detail buttons; the degraded one has degraded_reason
    for (const btn of screen.getAllByText("Show detail")) {
      fireEvent.click(btn);
    }

    // The degraded_reason text appears in the tooltip (aria-hidden, opacity-0) and
    // also in the expanded detail panel. After clicking Show detail, it appears in
    // the <p> element with "Reason: " prefix — verify via the button aria-expanded state.
    await waitFor(
      () => {
        // At least one expand button should now show "Hide detail" (expanded state)
        expect(screen.getAllByText("Hide detail").length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    // The degraded_reason text should now appear (tooltip was already there + detail panel)
    const reasonMatches = screen.getAllByText("LLM response truncated at token limit");
    expect(reasonMatches.length).toBeGreaterThanOrEqual(2);
  });
});

// ===========================================================================
// 2. Empty state
// ===========================================================================

describe("ProcessingHistoryTab — empty state", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ data: [] });
  });

  it("renders the empty-state element when endpoint returns an empty array", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getByRole("status", { name: /no processing history/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });

  it("does not render any list items in the empty state", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getByRole("status", { name: /no processing history/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows the friendly 'No processing history yet' copy", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getByText(/no processing history yet/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});

// ===========================================================================
// 3. Error state
// ===========================================================================

describe("ProcessingHistoryTab — error state", () => {
  beforeEach(() => {
    mockApiFetch.mockRejectedValue(new Error("Internal server error"));
  });

  it("renders error alert when the endpoint throws a non-404 error", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getByRole("alert")).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it("shows 'Failed to load processing history' heading", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getByText(/failed to load processing history/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it("shows the error message from the thrown error", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getByText("Internal server error")).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it("renders a 'Try again' retry button in the error state", async () => {
    renderTab();

    await waitFor(
      () => expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it("calls apiFetch again when the retry button is clicked", async () => {
    // Set up the mock with an initial error followed by success with empty data.
    // The hook has retry: 1, so TanStack Query will retry once before surfacing the error.
    // Using mockRejectedValue for all calls until we explicitly reset.
    mockApiFetch.mockRejectedValue(new Error("Internal server error"));

    renderTab();

    // Wait for the error state (may take longer due to retry: 1 in the hook)
    await waitFor(
      () => expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument(),
      { timeout: 8000 },
    );

    // Switch mock to return empty data for the retry
    mockApiFetch.mockResolvedValue({ data: [] });

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(
      () => expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
      { timeout: 5000 },
    );
  });
});

// ===========================================================================
// 4. 404 graceful degradation (empty list, no error)
// ===========================================================================

describe("ProcessingHistoryTab — 404 graceful degradation", () => {
  it("shows empty state (not error) when endpoint returns 404", async () => {
    const { ApiError } = jest.requireActual("@/lib/api/client") as {
      ApiError: new (status: number, body: unknown, message: string) => Error;
    };
    mockApiFetch.mockRejectedValue(new ApiError(404, {}, "Not Found"));

    renderTab();

    await waitFor(
      () => expect(screen.getByRole("status", { name: /no processing history/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
