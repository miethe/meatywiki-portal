import React from "react";
import { renderWithProviders, screen, waitFor } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";
import { ContextPackBuilder } from "@/components/projects/ContextPackBuilder";
import { listArtifacts } from "@/lib/api/artifacts";
import {
  createContextPack,
  getContextPack,
  listContextPackVersions,
} from "@/lib/api/projects";
import type { ArtifactCard, ServiceModeEnvelope } from "@/types/artifact";
import type { ContextPack, ContextPackVersion } from "@/types/projects";

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  listArtifacts: jest.fn(),
}));

jest.mock("@/lib/api/projects", () => ({
  createContextPack: jest.fn(),
  getContextPack: jest.fn(),
  listContextPackVersions: jest.fn(),
}));

const mockListArtifacts = listArtifacts as jest.MockedFunction<
  typeof listArtifacts
>;
const mockCreateContextPack = createContextPack as jest.MockedFunction<
  typeof createContextPack
>;
const mockGetContextPack = getContextPack as jest.MockedFunction<
  typeof getContextPack
>;
const mockListContextPackVersions =
  listContextPackVersions as jest.MockedFunction<
    typeof listContextPackVersions
  >;

function makeArtifact(overrides: Partial<ArtifactCard> = {}): ArtifactCard {
  return {
    id: "artifact-1",
    workspace: "library",
    type: "concept",
    title: "Alpha artifact",
    status: "active",
    file_path: "wiki/concepts/alpha.md",
    created: "2026-05-01T00:00:00Z",
    updated: "2026-05-04T00:00:00Z",
    ...overrides,
  };
}

function artifactEnvelope(
  artifacts: ArtifactCard[],
): ServiceModeEnvelope<ArtifactCard> {
  return { data: artifacts, cursor: null };
}

const createdPack: ContextPack = {
  pack_id: "pack-001",
  name: "Launch brief",
  description: "Scope for a briefing pack",
  artifact_ids: ["artifact-1"],
  artifact_count: 1,
  version: 1,
  created_at: "2026-05-04T00:00:00Z",
  updated_at: "2026-05-04T00:00:00Z",
};

const versions: ServiceModeEnvelope<ContextPackVersion> = {
  data: [{ version: 1, updated_at: "2026-05-04T00:00:00Z" }],
  cursor: null,
};

beforeEach(() => {
  mockListArtifacts.mockResolvedValue(
    artifactEnvelope([
      makeArtifact(),
      makeArtifact({
        id: "artifact-2",
        title: "Beta memo",
        workspace: "research",
        type: "synthesis",
      }),
    ]),
  );
  mockCreateContextPack.mockResolvedValue({ pack_id: "pack-001" });
  mockGetContextPack.mockResolvedValue(createdPack);
  mockListContextPackVersions.mockResolvedValue(versions);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("ContextPackBuilder", () => {
  it("loads discovery artifacts and supports search", async () => {
    renderWithProviders(<ContextPackBuilder />);

    expect(
      await screen.findByRole("checkbox", { name: /alpha artifact/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /beta memo/i }),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByRole("searchbox", { name: /search artifacts/i }),
      "alpha",
    );

    expect(
      screen.getByRole("checkbox", { name: /alpha artifact/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /beta memo/i }),
    ).not.toBeInTheDocument();
  });

  it("validates that at least one artifact is selected before step 2", async () => {
    renderWithProviders(<ContextPackBuilder />);

    await screen.findByRole("checkbox", { name: /alpha artifact/i });
    await userEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /select at least one/i,
    );
  });

  it("creates a pack and shows pack id plus version", async () => {
    renderWithProviders(<ContextPackBuilder />);

    await userEvent.click(
      await screen.findByRole("checkbox", { name: /alpha artifact/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    await userEvent.type(screen.getByLabelText(/^name$/i), "Launch brief");
    await userEvent.type(
      screen.getByLabelText(/^description$/i),
      "Scope for a briefing pack",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create context pack/i }),
    );

    await waitFor(() => {
      expect(mockCreateContextPack).toHaveBeenCalledWith({
        name: "Launch brief",
        description: "Scope for a briefing pack",
        artifact_ids: ["artifact-1"],
      });
    });
    expect(mockGetContextPack).toHaveBeenCalledWith("pack-001");
    expect(mockListContextPackVersions).toHaveBeenCalledWith("pack-001", {
      limit: 5,
    });

    expect(
      await screen.findByText(/context pack created/i),
    ).toBeInTheDocument();
    expect(screen.getByText("pack-001")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });
});
