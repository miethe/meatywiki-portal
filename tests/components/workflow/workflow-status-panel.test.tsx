/**
 * Unit tests for WorkflowStatusPanel (P4-08).
 *
 * Tests use the `controlled` prop to inject synthetic run data directly,
 * bypassing useWorkflowRuns / MSW so assertions are deterministic.
 *
 * Coverage:
 *   - Active and Recent sections render correctly from a synthetic runs list
 *   - Count badge reflects active count in the panel header
 *   - Empty states render when no runs exist (active or recent)
 *   - Stage Tracker slot (data-testid="stage-tracker-slot") appears per run
 *   - Responsive two-column grid container rendered in "full" variant
 *   - Loading skeleton rendered while loading (no prior data)
 *   - Error state renders with retry action
 *   - Section collapse toggles correctly
 *   - run_id short form and click-through links are present
 */

import React from "react";
import { renderWithProviders, screen, within, waitFor } from "../../utils/render";
import { userEvent } from "../../utils/render";
import { WorkflowStatusPanel } from "@/components/workflow/workflow-status-panel";
import type { WorkflowRun } from "@/types/artifact";
import type { SSEWorkflowEvent } from "@/lib/sse/types";

// ---------------------------------------------------------------------------
// Minimal mock for next/link — RTL renders as a plain anchor
// ---------------------------------------------------------------------------
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
// Mock RunSSEBridge — render-null side-effect component; tested separately.
// ---------------------------------------------------------------------------
jest.mock("@/components/workflow/run-sse-bridge", () => ({
  RunSSEBridge: () => null,
}));

// ---------------------------------------------------------------------------
// Mock useWorkflowRuns — the controlled prop bypasses it, but we mock here to
// prevent any self-contained panel from firing real fetch calls in this suite.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Synthetic run factory
// ---------------------------------------------------------------------------

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "wf-source-ingest-20260417-001",
    template_id: "source_ingest_v1",
    workspace: "inbox",
    status: "running",
    current_stage: 1,
    started_at: "2026-04-17T10:00:00Z",
    completed_at: null,
    initiator: "portal",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Controlled-props factory — passes synthetic data without the real hook
// ---------------------------------------------------------------------------

function makeControlled(
  activeRuns: WorkflowRun[],
  recentRuns: WorkflowRun[],
  overrides: {
    isLoading?: boolean;
    error?: string | null;
  } = {},
) {
  return {
    activeRuns,
    recentRuns,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    refetch: jest.fn().mockResolvedValue(undefined) as () => Promise<void>,
    applyEvent: jest.fn() as unknown as (runId: string, event: SSEWorkflowEvent) => void,
    notifySSEError: jest.fn() as (runId: string) => void,
  };
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPanel(
  variant: "full" | "compact",
  activeRuns: WorkflowRun[],
  recentRuns: WorkflowRun[] = [],
  overrides?: { isLoading?: boolean; error?: string | null },
) {
  const controlled = makeControlled(activeRuns, recentRuns, overrides);
  renderWithProviders(
    <WorkflowStatusPanel
      variant={variant}
      controlled={controlled}
    />,
  );
  return { controlled };
}

// ===========================================================================
// 1. Active section rendering
// ===========================================================================

describe("Active section", () => {
  it("renders all active run rows from the supplied list", () => {
    const runs = [
      makeRun({ id: "wf-001", status: "running" }),
      makeRun({ id: "wf-002", status: "pending", template_id: "compile_v1" }),
    ];
    renderPanel("full", runs);

    const rows = screen.getAllByTestId("workflow-run-row");
    expect(rows).toHaveLength(2);
  });

  it("renders the 'Active' section header with highlighted count badge", () => {
    const runs = [makeRun({ status: "running" })];
    renderPanel("full", runs);

    expect(screen.getByText("Active")).toBeInTheDocument();
    const countBadge = screen.getByTestId("active-count-badge");
    expect(countBadge).toHaveTextContent("1");
  });

  it("shows the prominent panel-level active count badge", () => {
    const runs = [
      makeRun({ id: "wf-001", status: "running" }),
      makeRun({ id: "wf-002", status: "running" }),
    ];
    renderPanel("full", runs);

    const badge = screen.getByTestId("panel-active-count-badge");
    expect(badge).toHaveTextContent("2");
  });

  it("does not render panel-level badge when there are no active runs", () => {
    renderPanel("full", []);
    expect(screen.queryByTestId("panel-active-count-badge")).not.toBeInTheDocument();
  });

  it("compact variant caps at 3 rows and shows overflow count", () => {
    const runs = [
      makeRun({ id: "wf-001" }),
      makeRun({ id: "wf-002" }),
      makeRun({ id: "wf-003" }),
      makeRun({ id: "wf-004" }),
    ];
    renderPanel("compact", runs);

    const rows = screen.getAllByTestId("workflow-run-row");
    expect(rows).toHaveLength(3);
    expect(screen.getByText("+1 more active")).toBeInTheDocument();
  });

  it("compact variant shows all rows when count <= 3", () => {
    const runs = [makeRun({ id: "wf-001" }), makeRun({ id: "wf-002" })];
    renderPanel("compact", runs);

    expect(screen.getAllByTestId("workflow-run-row")).toHaveLength(2);
    expect(screen.queryByText(/more active/)).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Recent section rendering
// ===========================================================================

describe("Recent section", () => {
  it("renders recent runs in the full variant with '7 days' label", () => {
    const recentRuns = [
      makeRun({ id: "wf-r01", status: "complete" }),
      makeRun({ id: "wf-r02", status: "failed" }),
    ];
    renderPanel("full", [], recentRuns);

    expect(screen.getByText(/Recent \(7 days\)/i)).toBeInTheDocument();
    const rows = screen.getAllByTestId("workflow-run-row");
    expect(rows).toHaveLength(2);
  });

  it("does not render Recent section in compact variant", () => {
    const recentRuns = [makeRun({ id: "wf-r01", status: "complete" })];
    renderPanel("compact", [], recentRuns);

    expect(screen.queryByText(/Recent/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("workflow-run-row")).not.toBeInTheDocument();
  });

  it("shows empty recent message in full variant when no recent runs and not loading", () => {
    renderPanel("full", [], []);

    expect(screen.getByTestId("empty-recent")).toHaveTextContent(
      "No recent runs in the last 7 days.",
    );
  });
});

// ===========================================================================
// 3. Count badge reflects active count
// ===========================================================================

describe("Count badge accuracy", () => {
  it("badge shows correct count for 1 active run", () => {
    renderPanel("full", [makeRun({ status: "pending" })]);
    expect(screen.getByTestId("panel-active-count-badge")).toHaveTextContent("1");
  });

  it("badge caps display at 99+ when count exceeds 99", () => {
    const runs = Array.from({ length: 100 }, (_, i) =>
      makeRun({ id: `wf-${String(i).padStart(3, "0")}`, status: "running" }),
    );
    renderPanel("full", runs);

    expect(screen.getByTestId("panel-active-count-badge")).toHaveTextContent("99+");
    expect(screen.getByTestId("active-count-badge")).toHaveTextContent("99+");
  });
});

// ===========================================================================
// 4. Empty states
// ===========================================================================

describe("Empty states", () => {
  it("shows 'No active workflows' when active list is empty", () => {
    renderPanel("full", []);
    expect(screen.getByTestId("empty-active")).toHaveTextContent(
      "No active workflows.",
    );
  });

  it("shows 'No active workflows' in compact variant when empty", () => {
    renderPanel("compact", []);
    expect(screen.getByTestId("empty-active")).toBeInTheDocument();
  });

  it("does not show empty-active when there are active runs", () => {
    renderPanel("full", [makeRun({ status: "running" })]);
    expect(screen.queryByTestId("empty-active")).not.toBeInTheDocument();
  });

  it("does not show empty states while loading", () => {
    renderPanel("full", [], [], { isLoading: true });
    expect(screen.queryByTestId("empty-active")).not.toBeInTheDocument();
    expect(screen.queryByTestId("empty-recent")).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 5. Stage Tracker slot visible for each run
// ===========================================================================

describe("Stage Tracker slot", () => {
  it("renders a stage-tracker-slot for each active run row", () => {
    const runs = [
      makeRun({ id: "wf-001", status: "running" }),
      makeRun({ id: "wf-002", status: "pending" }),
    ];
    renderPanel("full", runs);

    const rows = screen.getAllByTestId("workflow-run-row");
    rows.forEach((row) => {
      expect(within(row).getByTestId("stage-tracker-slot")).toBeInTheDocument();
    });
  });

  it("renders a stage-tracker-slot for each recent run row", () => {
    const recentRuns = [makeRun({ id: "wf-r01", status: "complete" })];
    renderPanel("full", [], recentRuns);

    const rows = screen.getAllByTestId("workflow-run-row");
    rows.forEach((row) => {
      expect(within(row).getByTestId("stage-tracker-slot")).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 6. Loading skeleton
// ===========================================================================

describe("Loading state", () => {
  it("renders loading skeleton when loading before first data load", () => {
    renderPanel("full", [], [], { isLoading: true });
    expect(screen.getByLabelText("Loading workflow runs")).toBeInTheDocument();
  });

  it("does not render loading skeleton when data is already present", () => {
    renderPanel("full", [makeRun()], [], { isLoading: true });
    expect(screen.queryByLabelText("Loading workflow runs")).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 7. Error state
// ===========================================================================

describe("Error state", () => {
  it("renders error message and retry button", () => {
    renderPanel("full", [], [], { error: "Network timeout" });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("calls refetch when Retry is clicked", async () => {
    const user = userEvent.setup();
    const { controlled } = renderPanel("full", [], [], {
      error: "Connection failed",
    });

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(controlled.refetch).toHaveBeenCalledTimes(1);
    });
  });
});

// ===========================================================================
// 8. Section collapse / expand toggle
// ===========================================================================

describe("Section collapse / expand", () => {
  it("collapses Active section when the header is clicked", async () => {
    const user = userEvent.setup();
    const runs = [makeRun({ status: "running" })];
    renderPanel("full", runs);

    // Rows visible before collapse
    expect(screen.getAllByTestId("workflow-run-row")).toHaveLength(1);

    const activeHeader = screen.getByRole("button", { name: /^Active/ });
    await user.click(activeHeader);

    await waitFor(() => {
      expect(screen.queryAllByTestId("workflow-run-row")).toHaveLength(0);
    });
  });

  it("collapses Recent section when the header is clicked", async () => {
    const user = userEvent.setup();
    const recentRuns = [makeRun({ id: "wf-r01", status: "complete" })];
    renderPanel("full", [], recentRuns);

    expect(screen.getAllByTestId("workflow-run-row")).toHaveLength(1);

    const recentHeader = screen.getByRole("button", { name: /^Recent/ });
    await user.click(recentHeader);

    await waitFor(() => {
      expect(screen.queryAllByTestId("workflow-run-row")).toHaveLength(0);
    });
  });
});

// ===========================================================================
// 9. Run row details: short run ID, template label, click-through link
// ===========================================================================

describe("Run row details", () => {
  it("renders a short run ID (…<tail>) in each row header", () => {
    const run = makeRun({ id: "wf-source-ingest-20260417-003" });
    renderPanel("full", [run]);

    // The title attribute on the <code> carries the full ID
    expect(screen.getByTitle("wf-source-ingest-20260417-003")).toBeInTheDocument();
    // The short display is the last segment prefixed with …
    expect(screen.getByTitle("wf-source-ingest-20260417-003")).toHaveTextContent("…003");
  });

  it("renders the template label for a run", () => {
    const run = makeRun({ template_id: "research_synthesis_v1" });
    renderPanel("full", [run]);
    expect(screen.getByText("Research Synthesis")).toBeInTheDocument();
  });

  it("shows a 'View run' link with correct href in expanded detail", async () => {
    const user = userEvent.setup();
    const run = makeRun({ id: "wf-source-ingest-20260417-007" });
    renderPanel("full", [run]);

    // Expand the row by clicking the expand button
    const expandButton = screen.getByRole("button", {
      name: /Source Ingest.*Expand details/i,
    });
    await user.click(expandButton);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /view full details/i });
      expect(link).toHaveAttribute(
        "href",
        "/workflows/wf-source-ingest-20260417-007",
      );
    });
  });
});

// ===========================================================================
// 10. Responsive grid container (full variant)
// ===========================================================================

describe("Responsive grid", () => {
  it("renders the active runs inside a grid container in full variant", () => {
    const runs = [makeRun({ id: "wf-001" }), makeRun({ id: "wf-002" })];
    renderPanel("full", runs);

    const grid = screen.getByTestId("active-runs-grid");
    expect(grid).toBeInTheDocument();
  });

  it("renders the recent runs inside a grid container in full variant", () => {
    const recentRuns = [makeRun({ id: "wf-r01", status: "complete" })];
    renderPanel("full", [], recentRuns);

    const grid = screen.getByTestId("recent-runs-grid");
    expect(grid).toBeInTheDocument();
  });

  it("does NOT render a grid container in compact variant", () => {
    renderPanel("compact", [makeRun({ id: "wf-001" })]);
    expect(screen.queryByTestId("active-runs-grid")).not.toBeInTheDocument();
  });
});
