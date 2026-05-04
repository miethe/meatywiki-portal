import React from "react";
import { renderWithProviders, screen } from "../../utils/render";
import { ActiveWorkflowCard } from "@/components/workflow/active-workflow-card";
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

jest.mock("@/components/workflow/stage-tracker", () => ({
  StageTracker: () => <div data-testid="stage-tracker" />,
}));

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run-active-01",
    template_id: "research_synthesis_v1",
    workspace: "research",
    status: "running",
    current_stage: 2,
    started_at: "2026-04-18T10:00:00Z",
    completed_at: null,
    initiator: "portal",
    artifact_id: "artifact-source-01",
    artifact_title: "Legacy Source Artifact Title",
    source_artifacts: [
      { artifact_id: "artifact-source-01", title: "Resolved Source Artifact Title" },
    ],
    ...overrides,
  };
}

describe("ActiveWorkflowCard", () => {
  it("renders the authoritative source artifact title with an artifact link", () => {
    renderWithProviders(<ActiveWorkflowCard run={makeRun()} />);

    const sourceLink = screen.getByRole("link", {
      name: "Resolved Source Artifact Title",
    });
    expect(sourceLink).toHaveAttribute("href", "/artifact/artifact-source-01");
    expect(
      screen.queryByRole("link", { name: "artifact-source-01" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy Source Artifact Title")).not.toBeInTheDocument();
  });

  it("keeps legacy artifact_title as an older API fallback", () => {
    renderWithProviders(
      <ActiveWorkflowCard
        run={makeRun({
          source_artifacts: undefined,
          artifact_title: "Legacy Source Artifact Title",
        })}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Legacy Source Artifact Title" }),
    ).toHaveAttribute("href", "/artifact/artifact-source-01");
  });

  it("renders clear non-link fallback when no titled source is linked", () => {
    renderWithProviders(
      <ActiveWorkflowCard
        run={makeRun({
          source_artifacts: [],
          artifact_id: null,
          artifact_title: null,
        })}
      />,
    );

    expect(screen.getByText("No linked source artifact")).toBeInTheDocument();
    expect(screen.queryByText("Source artifact unavailable")).not.toBeInTheDocument();
  });
});
