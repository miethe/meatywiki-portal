import React from "react";
import { renderWithProviders, screen, waitFor } from "../../../utils/render";
import { WorkflowViewerScreen } from "@/components/workflow/viewer/workflow-viewer-screen";
import { useWorkflowRun } from "@/hooks/useWorkflowRun";
import { useWorkflowTimeline } from "@/hooks/useWorkflowTimeline";
import { useRunHistory } from "@/hooks/useRunHistory";
import type { WorkflowRun } from "@/types/artifact";
import type { WorkflowEvent, TimelineStage } from "@/types/workflow-viewer";

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

jest.mock("@/hooks/useWorkflowRun");
jest.mock("@/hooks/useWorkflowTimeline");
jest.mock("@/hooks/useRunHistory");
jest.mock("@/components/workflow/viewer/operator-actions-block", () => ({
  OperatorActionsBlock: () => <div data-testid="operator-actions-block" />,
}));
jest.mock("@/components/workflow/viewer/audit-log-panel", () => ({
  AuditLogPanel: () => null,
}));

const mockUseWorkflowRun = useWorkflowRun as jest.MockedFunction<typeof useWorkflowRun>;
const mockUseWorkflowTimeline = useWorkflowTimeline as jest.MockedFunction<
  typeof useWorkflowTimeline
>;
const mockUseRunHistory = useRunHistory as jest.MockedFunction<typeof useRunHistory>;

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run-detail-01",
    template_id: "research_synthesis_v1",
    workspace: "research",
    status: "complete",
    current_stage: null,
    started_at: "2026-04-18T10:00:00Z",
    completed_at: "2026-04-18T10:05:00Z",
    created_at: "2026-04-18T09:59:00Z",
    initiator: "portal",
    artifact_id: "artifact-source-01",
    artifact_title: "Legacy Research Capture",
    source_artifacts: [
      { artifact_id: "artifact-source-01", title: "Original Research Capture" },
    ],
    created_artifacts: [
      { artifact_id: "artifact-created-01", title: "Resolved Created Artifact" },
      { artifact_id: "artifact-created-untitled", title: null },
    ],
    metadata: { route: "research" },
    ...overrides,
  };
}

const EVENTS: WorkflowEvent[] = [
  {
    id: "evt-01",
    run_id: "run-detail-01",
    stage: "compile",
    event_type: "stage_completed",
    event_payload: {
      inputs: { artifact_id: "artifact-input-01" },
      artifact_id: "artifact-output-01",
      summary_artifact_id: "artifact-summary-01",
      summary_artifact_title: "Summary Artifact",
      outputs: {
        artifact_id: "artifact-output-02",
        artifact_title: "Compiled Brief",
        compiled: true,
      },
      output_summary: "Created compiled brief and handoff notes.",
    },
    created_at: "2026-04-18T10:03:00Z",
  },
  {
    id: "evt-02",
    run_id: "run-detail-01",
    stage: "synthesise",
    event_type: "workflow_completed",
    event_payload: {
      artifact_ids: ["artifact-output-03"],
      outputs: [{ artifact_id: "artifact-output-04", title: "Synthesis Draft" }],
    },
    created_at: "2026-04-18T10:05:00Z",
  },
];

const STAGES: TimelineStage[] = [
  {
    name: "compile",
    label: "Compile",
    status: "success",
    startedAt: "2026-04-18T10:00:00Z",
    completedAt: "2026-04-18T10:03:00Z",
    durationS: 180,
    events: [EVENTS[0]!],
  },
];

describe("WorkflowViewerScreen", () => {
  beforeEach(() => {
    mockUseWorkflowRun.mockReturnValue({
      run: makeRun(),
      isLoading: false,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockUseWorkflowTimeline.mockReturnValue({
      events: EVENTS,
      stages: STAGES,
      isLoading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
    mockUseRunHistory.mockReturnValue({
      runs: [makeRun()],
      isLoading: false,
      isReRunning: false,
      error: null,
      reRunError: null,
      refetch: jest.fn().mockResolvedValue(undefined),
      reRun: jest.fn().mockResolvedValue(undefined),
    });
  });

  it("renders source artifact metadata in the detail header", async () => {
    renderWithProviders(<WorkflowViewerScreen runId="run-detail-01" />);

    const sourceLink = await screen.findByRole("link", {
      name: "Original Research Capture",
    });
    expect(sourceLink).toHaveAttribute("href", "/artifact/artifact-source-01");
    expect(screen.getByText("artifact-source-01")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open artifact" })).not.toBeInTheDocument();
    expect(screen.queryByText("Source artifact unavailable")).not.toBeInTheDocument();
  });

  it("renders authoritative created artifacts and output details", async () => {
    renderWithProviders(<WorkflowViewerScreen runId="run-detail-01" />);

    await waitFor(() => {
      expect(screen.getByTestId("workflow-outputs-panel")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "Resolved Created Artifact" })).toHaveAttribute(
      "href",
      "/artifact/artifact-created-01",
    );
    expect(screen.getByText("artifact-created-01")).toBeInTheDocument();
    expect(screen.getByText("Untitled artifact")).toBeInTheDocument();
    expect(screen.getByText("artifact-created-untitled")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "artifact-created-01" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "artifact-created-untitled" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "artifact-output-01" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "artifact-input-01" })).not.toBeInTheDocument();
    expect(screen.getByText("Created compiled brief and handoff notes.")).toBeInTheDocument();
  });
});
