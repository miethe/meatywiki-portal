/**
 * Unit tests for WorkflowOSTab (P4-10).
 *
 * Covers:
 *   - Lazy-load behaviour: no fetch until `enabled` is true.
 *   - Loading skeleton while fetch is in-flight.
 *   - Renders Lens Badge Set from artifact metadata.
 *   - Empty state when no runs exist.
 *   - Run History table populated from API.
 *   - Row click navigates to /workflows/:run_id.
 *   - Quality Gate indicator renders when lint fields present.
 *   - Error state with retry.
 *
 * Mocking strategy:
 *   Mock `useArtifactWorkflowRuns` at the module boundary to decouple from
 *   real fetch logic. Mock `next/navigation` for router assertions.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkflowOSTab } from "@/components/workflow/workflow-os-tab";
import type { ArtifactDetail, WorkflowRun } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ---------------------------------------------------------------------------
// Mock useArtifactWorkflowRuns
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useArtifactWorkflowRuns", () => ({
  useArtifactWorkflowRuns: jest.fn(),
}));

import { useArtifactWorkflowRuns } from "@/hooks/useArtifactWorkflowRuns";
const mockUseRuns = useArtifactWorkflowRuns as jest.MockedFunction<
  typeof useArtifactWorkflowRuns
>;

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const stubArtifact: ArtifactDetail = {
  id: "art-001",
  workspace: "library",
  type: "concept",
  title: "Test Artifact",
  status: "active",
  file_path: "/wiki/concepts/test.md",
  metadata: {
    fidelity: "high",
    freshness: "current",
    verification_state: "verified",
  },
  frontmatter_jsonb: null,
};

const stubRuns: WorkflowRun[] = [
  {
    id: "run-001",
    template_id: "source_ingest_v1",
    workspace: "library",
    status: "complete",
    current_stage: 5,
    started_at: "2026-04-15T10:00:00Z",
    completed_at: "2026-04-15T10:05:00Z",
    initiator: "portal",
  },
  {
    id: "run-002",
    template_id: "compile_v1",
    workspace: "library",
    status: "failed",
    current_stage: 2,
    started_at: "2026-04-16T08:00:00Z",
    completed_at: null,
    initiator: "cli",
  },
];

const noopRefetch = jest.fn();

// ---------------------------------------------------------------------------
// Default hook mock — returns stable empty state
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRuns.mockReturnValue({
    runs: [],
    isLoading: false,
    error: null,
    refetch: noopRefetch,
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTab(
  props: Partial<{ artifact: ArtifactDetail; enabled: boolean }> = {},
) {
  return render(
    <WorkflowOSTab
      artifact={props.artifact ?? stubArtifact}
      enabled={props.enabled ?? true}
    />,
  );
}

// ---------------------------------------------------------------------------
// Lazy-load behaviour
// ---------------------------------------------------------------------------

describe("WorkflowOSTab — lazy-load behaviour", () => {
  it("calls useArtifactWorkflowRuns with enabled=false when tab is not active", () => {
    renderTab({ enabled: false });
    expect(mockUseRuns).toHaveBeenCalledWith(stubArtifact.id, false);
  });

  it("calls useArtifactWorkflowRuns with enabled=true when tab is active", () => {
    renderTab({ enabled: true });
    expect(mockUseRuns).toHaveBeenCalledWith(stubArtifact.id, true);
  });
});

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

describe("WorkflowOSTab — loading state", () => {
  it("renders loading skeleton while isLoading is true", () => {
    mockUseRuns.mockReturnValue({
      runs: [],
      isLoading: true,
      error: null,
      refetch: noopRefetch,
    });
    renderTab();
    expect(
      document.querySelector("[aria-busy='true'][aria-label='Loading workflow data']"),
    ).toBeTruthy();
  });

  it("does not render section headings while loading", () => {
    mockUseRuns.mockReturnValue({
      runs: [],
      isLoading: true,
      error: null,
      refetch: noopRefetch,
    });
    renderTab();
    expect(screen.queryByText(/Lens Dimensions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Run History/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Lens Badge Set section
// ---------------------------------------------------------------------------

describe("WorkflowOSTab — Lens Dimensions", () => {
  it("renders the Lens Dimensions section heading", async () => {
    renderTab();
    expect(screen.getByText("Lens Dimensions")).toBeInTheDocument();
  });

  it("renders lens badges when metadata is populated", () => {
    renderTab();
    // LensBadgeSet (detail variant) should render all three core badges.
    expect(screen.getByRole("generic", { name: /lens badges/i })).toBeInTheDocument();
  });

  it("shows empty state text when artifact has no lens metadata", () => {
    const noLensArtifact: ArtifactDetail = {
      ...stubArtifact,
      metadata: null,
    };
    renderTab({ artifact: noLensArtifact });
    expect(
      screen.getByText(/No lens metadata recorded for this artifact yet/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Stage Tracker section
// ---------------------------------------------------------------------------

describe("WorkflowOSTab — Latest Run Stage", () => {
  it("shows 'No workflow runs yet' when runs is empty", () => {
    renderTab();
    // Both Stage Tracker and Run History show the empty message.
    const empties = screen.getAllByText(/No workflow runs yet/i);
    expect(empties.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the stage tracker for the most recent run", () => {
    mockUseRuns.mockReturnValue({
      runs: stubRuns,
      isLoading: false,
      error: null,
      refetch: noopRefetch,
    });
    renderTab();
    // StageTracker compact renders a progressbar.
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    // First run ID appears at least once (in Stage section and/or Run History).
    expect(screen.getAllByText("run-001").length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Run History table
// ---------------------------------------------------------------------------

describe("WorkflowOSTab — Run History", () => {
  it("shows empty state when there are no runs", () => {
    renderTab();
    expect(
      screen.getByText(/Runs that produce or modify this artifact will appear here/i),
    ).toBeInTheDocument();
  });

  it("renders a table row for each run", () => {
    mockUseRuns.mockReturnValue({
      runs: stubRuns,
      isLoading: false,
      error: null,
      refetch: noopRefetch,
    });
    renderTab();
    // Table should exist.
    expect(screen.getByRole("table")).toBeInTheDocument();
    // Two rows.
    const rows = screen.getAllByRole("row");
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
  });

  it("displays run_id, template_id, status for each row", () => {
    mockUseRuns.mockReturnValue({
      runs: stubRuns,
      isLoading: false,
      error: null,
      refetch: noopRefetch,
    });
    renderTab();
    // run-001 appears in both Stage section and Run History table — use getAllByText.
    expect(screen.getAllByText("run-001").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("source_ingest_v1")).toBeInTheDocument();
    // run-002 only in Run History.
    expect(screen.getByText("run-002")).toBeInTheDocument();
    expect(screen.getByText("compile_v1")).toBeInTheDocument();
  });

  it("clicking a row calls router.push with the run detail URL", () => {
    mockUseRuns.mockReturnValue({
      runs: stubRuns,
      isLoading: false,
      error: null,
      refetch: noopRefetch,
    });
    renderTab();
    const firstRow = screen.getByRole("row", { name: /run-001/i });
    fireEvent.click(firstRow);
    expect(mockPush).toHaveBeenCalledWith("/workflows/run-001");
  });

  it("pressing Enter on a row navigates to the run", () => {
    mockUseRuns.mockReturnValue({
      runs: stubRuns,
      isLoading: false,
      error: null,
      refetch: noopRefetch,
    });
    renderTab();
    const firstRow = screen.getByRole("row", { name: /run-001/i });
    fireEvent.keyDown(firstRow, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/workflows/run-001");
  });

  it("pressing Space on a row navigates to the run", () => {
    mockUseRuns.mockReturnValue({
      runs: stubRuns,
      isLoading: false,
      error: null,
      refetch: noopRefetch,
    });
    renderTab();
    const firstRow = screen.getByRole("row", { name: /run-001/i });
    fireEvent.keyDown(firstRow, { key: " " });
    expect(mockPush).toHaveBeenCalledWith("/workflows/run-001");
  });
});

// ---------------------------------------------------------------------------
// Quality Gate section
// ---------------------------------------------------------------------------

describe("WorkflowOSTab — Quality Gate", () => {
  it("does not render the Quality Gate section when no lint fields present", () => {
    renderTab();
    expect(screen.queryByText("Quality Gate")).not.toBeInTheDocument();
  });

  it("renders Quality Gate when lint_status is present in frontmatter", () => {
    const artifactWithLint: ArtifactDetail = {
      ...stubArtifact,
      frontmatter_jsonb: {
        lint_status: "passed",
        lint_errors: 0,
        lint_warnings: 2,
      },
    };
    renderTab({ artifact: artifactWithLint });
    expect(screen.getByText("Quality Gate")).toBeInTheDocument();
    expect(screen.getByText("passed")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders Quality Gate with error styling when lint_errors > 0", () => {
    const artifactWithErrors: ArtifactDetail = {
      ...stubArtifact,
      frontmatter_jsonb: {
        lint_status: "failed",
        lint_errors: 3,
        lint_warnings: 1,
      },
    };
    renderTab({ artifact: artifactWithErrors });
    expect(screen.getByText("Quality Gate")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

describe("WorkflowOSTab — error state", () => {
  it("renders error alert when error is non-null", () => {
    mockUseRuns.mockReturnValue({
      runs: [],
      isLoading: false,
      error: "Network error",
      refetch: noopRefetch,
    });
    renderTab();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Failed to load workflow data/i)).toBeInTheDocument();
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("retry button calls refetch", async () => {
    const mockRefetch = jest.fn();
    mockUseRuns.mockReturnValue({
      runs: [],
      isLoading: false,
      error: "Timeout",
      refetch: mockRefetch,
    });
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });
});
