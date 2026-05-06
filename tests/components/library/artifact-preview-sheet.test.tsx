import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { ArtifactPreviewSheet } from "@/components/library/artifact-preview-sheet";
import type { ArtifactCard as ArtifactCardType } from "@/types/artifact";

const artifact: ArtifactCardType = {
  id: "art-1",
  workspace: "library",
  type: "concept",
  title: "Dense Preview Artifact",
  status: "active",
  file_path: "wiki/concepts/dense-preview.md",
  created: "2026-05-01T10:00:00Z",
  updated: "2026-05-05T10:00:00Z",
  preview: "Enriched card preview from list payload.",
  metadata: {
    fidelity: "high",
    freshness: "current",
    verification_state: "verified",
  },
  graph_context: {
    incoming_count: 1,
    outgoing_count: 1,
    relationship_counts: { derived_from: 1, supports: 1 },
    linked_previews: [
      {
        artifact_id: "source-1",
        title: "Incoming Source",
        artifact_type: "evidence",
        relationship_type: "derived_from",
        direction: "incoming",
      },
      {
        artifact_id: "target-1",
        title: "Outgoing Target",
        artifact_type: "synthesis",
        relationship_type: "supports",
        direction: "outgoing",
      },
    ],
  },
};

describe("ArtifactCard workbench clicks", () => {
  it("lets Library intercept plain clicks while preserving modifier navigation", () => {
    const onCardClick = jest.fn((event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!event.metaKey && !event.ctrlKey) event.preventDefault();
    });

    render(
      <ArtifactCard
        artifact={artifact}
        variant="grid"
        displayVariant="workbench"
        onCardClick={onCardClick}
      />,
    );

    const link = screen.getByRole("link", { name: /view dense preview artifact/i });

    fireEvent.click(link);
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick.mock.calls[0][0].defaultPrevented).toBe(true);

    fireEvent.click(link, { ctrlKey: true });
    expect(onCardClick).toHaveBeenCalledTimes(2);
    expect(onCardClick.mock.calls[1][0].defaultPrevented).toBe(false);
    expect(link).toHaveAttribute("href", "/artifact/art-1");
  });
});

describe("ArtifactPreviewSheet", () => {
  it("renders summary, properties, grouped linked items, activity, and full-page link", () => {
    render(
      <ArtifactPreviewSheet artifact={artifact} open onClose={jest.fn()} />,
    );

    expect(screen.getByRole("dialog", { name: /dense preview artifact/i })).toBeInTheDocument();
    expect(screen.getByText("Enriched card preview from list payload.")).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText(/Derived from Incoming/i)).toBeInTheDocument();
    expect(screen.getByText(/Supports Outgoing/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /incoming source/i })).toHaveAttribute(
      "href",
      "/artifact/source-1",
    );
    expect(screen.getAllByText("Updated").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /open full page/i })).toHaveAttribute(
      "href",
      "/artifact/art-1",
    );
  });

  it("closes from the close button", () => {
    const onClose = jest.fn();
    render(<ArtifactPreviewSheet artifact={artifact} open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: /close preview/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
