import React from "react";
import { renderWithProviders, screen } from "../utils/render";
import WorkflowsPage from "@/app/(main)/workflows/page";
import { useWorkflowRuns } from "@/hooks/useWorkflowRuns";
import type { WorkflowRun } from "@/types/artifact";

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

jest.mock("@/hooks/useWorkflowRuns");
jest.mock("@/components/workflow/run-sse-pool-bridge", () => ({
  RunSSEPoolBridge: () => null,
}));
jest.mock("@/components/workflow/initiation-wizard", () => ({
  InitiationWizardDialog: () => <button type="button">Create Workflow</button>,
}));
jest.mock("@/components/workflow/active-workflow-card", () => ({
  ActiveWorkflowCard: ({ run }: { run: WorkflowRun }) => (
    <article>
      <a href={`/artifact/${run.source_artifacts?.[0]?.artifact_id}`}>
        {run.source_artifacts?.[0]?.title}
      </a>
    </article>
  ),
}));

const mockUseWorkflowRuns = useWorkflowRuns as jest.MockedFunction<typeof useWorkflowRuns>;

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run-page-01",
    template_id: "research_synthesis_v1",
    workspace: "research",
    status: "complete",
    current_stage: null,
    started_at: "2026-04-18T10:00:00Z",
    completed_at: "2026-04-18T10:05:00Z",
    initiator: "portal",
    artifact_id: "artifact-source-page-01",
    artifact_title: "artifact-source-page-01",
    source_artifacts: [
      { artifact_id: "artifact-source-page-01", title: "Page Source Artifact" },
    ],
    ...overrides,
  };
}

describe("WorkflowsPage source artifact rendering", () => {
  beforeEach(() => {
    mockUseWorkflowRuns.mockReturnValue({
      activeRuns: [
        makeRun({
          id: "run-page-active",
          status: "running",
          completed_at: null,
          artifact_id: "artifact-active-01",
          artifact_title: "artifact-active-01",
          source_artifacts: [
            { artifact_id: "artifact-active-01", title: "Active Source Artifact" },
          ],
        }),
      ],
      recentRuns: [
        makeRun(),
        makeRun({
          id: "run-page-missing-source",
          artifact_id: null,
          artifact_title: null,
          source_artifacts: [],
        }),
      ],
      activeCount: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined),
      applyEvent: jest.fn(),
      notifySSEError: jest.fn(),
    });
  });

  it("renders source artifact links for active cards and historical rows", () => {
    renderWithProviders(<WorkflowsPage />);

    expect(screen.getByRole("link", { name: "Active Source Artifact" })).toHaveAttribute(
      "href",
      "/artifact/artifact-active-01",
    );
    expect(screen.getByRole("link", { name: "Page Source Artifact" })).toHaveAttribute(
      "href",
      "/artifact/artifact-source-page-01",
    );
    expect(
      screen.queryByRole("link", { name: "artifact-source-page-01" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No linked source artifact")).toBeInTheDocument();
    expect(screen.queryByText("Source artifact unavailable")).not.toBeInTheDocument();
  });
});
