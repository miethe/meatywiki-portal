import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArtifactDetailClient } from "@/app/(main)/artifact/[id]/ArtifactDetailClient";
import { getArtifact } from "@/lib/api/artifacts";
import { getContextPack, listContextPackVersions } from "@/lib/api/projects";
import { ApiError } from "@/lib/api/client";
import type { ArtifactDetail, ServiceModeEnvelope } from "@/types/artifact";
import type { ContextPack, ContextPackVersion } from "@/types/projects";
import { renderWithProviders, screen, waitFor } from "../utils/render";

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  getArtifact: jest.fn(),
  fetchArtifactEtag: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/api/projects", () => ({
  getContextPack: jest.fn(),
  listContextPackVersions: jest.fn(),
}));

jest.mock("@miethe/ui", () => ({
  ArticleViewer: ({ content }: { content: string | null | undefined }) => (
    <article>{content}</article>
  ),
}));

jest.mock("@/hooks/useArtifactWorkflowRuns", () => ({
  useArtifactWorkflowRuns: jest.fn(() => ({
    runs: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/useArtifactEdges", () => ({
  ...jest.requireActual("@/hooks/useArtifactEdges"),
  useArtifactEdges: jest.fn(() => ({
    data: { artifact_id: "pack-ctx-001", incoming: [], outgoing: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/components/artifact/activity-timeline", () => ({
  ActivityTimeline: () => <section aria-label="Activity timeline" />,
}));

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

const mockGetArtifact = getArtifact as jest.MockedFunction<typeof getArtifact>;
const mockGetContextPack = getContextPack as jest.MockedFunction<
  typeof getContextPack
>;
const mockListContextPackVersions =
  listContextPackVersions as jest.MockedFunction<
    typeof listContextPackVersions
  >;

const packArtifact: ArtifactDetail = {
  id: "pack-ctx-001",
  workspace: "projects",
  type: "context_pack",
  subtype: null,
  title: "Launch context pack",
  status: "active",
  schema_version: "1.0.0",
  created: "2026-05-01T00:00:00Z",
  updated: "2026-05-04T00:00:00Z",
  file_path: "projects/launch-context-pack.md",
  metadata: {
    fidelity: "high",
    freshness: "current",
    verification_state: "verified",
  },
  summary: "Pack shell artifact",
  slug: "launch-context-pack",
  content_hash: "hash-ctx",
  frontmatter_jsonb: { tags: ["project"] },
  raw_content: "# Should not render as source",
  compiled_content: "<p>Should not render as knowledge</p>",
  draft_content: "Should not render as draft",
  artifact_edges: null,
};

const contextPack: ContextPack = {
  pack_id: "pack-ctx-001",
  name: "Launch brief",
  description: "Artifacts for the launch brief.",
  artifact_ids: ["artifact-alpha", "artifact-beta"],
  artifact_count: 2,
  version: 3,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-04T00:00:00Z",
};

const versions: ServiceModeEnvelope<ContextPackVersion> = {
  data: [
    {
      version: 3,
      updated_at: "2026-05-04T00:00:00Z",
      description: "Added beta artifact.",
    },
    {
      version: 2,
      updated_at: "2026-05-03T00:00:00Z",
      description: "Refined launch scope.",
    },
  ],
  cursor: null,
};

function renderDetail(id = "pack-ctx-001") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithProviders(
    <QueryClientProvider client={queryClient}>
      <ArtifactDetailClient id={id} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGetArtifact.mockResolvedValue(packArtifact);
  mockGetContextPack.mockResolvedValue(contextPack);
  mockListContextPackVersions.mockResolvedValue(versions);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("ArtifactDetailClient context-pack rendering", () => {
  it("renders the overlay context pack view instead of normal reader tabs", async () => {
    renderDetail();

    expect(
      await screen.findByLabelText("Context pack detail"),
    ).toBeInTheDocument();

    expect(mockGetContextPack).toHaveBeenCalledWith("pack-ctx-001");
    expect(mockListContextPackVersions).toHaveBeenCalledWith("pack-ctx-001", {
      limit: 20,
    });

    expect(
      screen.getAllByRole("heading", { name: "Launch brief" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Artifacts for the launch brief."),
    ).toBeInTheDocument();
    expect(screen.getByText("pack-ctx-001")).toBeInTheDocument();
    expect(screen.getAllByText("v3")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "artifact-alpha" }),
    ).toHaveAttribute("href", "/artifact/artifact-alpha");
    expect(screen.getByRole("link", { name: "artifact-beta" })).toHaveAttribute(
      "href",
      "/artifact/artifact-beta",
    );
    expect(
      screen.getByRole("heading", { name: "Version history" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Added beta artifact.")).toBeInTheDocument();
    expect(screen.getByText("Refined launch scope.")).toBeInTheDocument();

    expect(
      screen.queryByRole("tab", { name: /source/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Should not render as source/i),
    ).not.toBeInTheDocument();
  });

  it("uses artifact_type when the detail type field is stale", async () => {
    mockGetArtifact.mockResolvedValue({
      ...packArtifact,
      type: "note",
      artifact_type: "context_pack",
    } as ArtifactDetail & { artifact_type: string });

    renderDetail();

    await waitFor(() => {
      expect(mockGetContextPack).toHaveBeenCalledWith("pack-ctx-001");
    });
    expect(
      await screen.findByLabelText("Context pack detail"),
    ).toBeInTheDocument();
  });

  it("renders a context pack when the artifact row is missing but the Projects overlay has the pack", async () => {
    mockGetArtifact.mockRejectedValue(
      new ApiError(404, { detail: "not_found" }, "API error 404"),
    );

    renderDetail();

    expect(
      await screen.findByLabelText("Context pack detail"),
    ).toBeInTheDocument();
    expect(mockGetContextPack).toHaveBeenCalledWith("pack-ctx-001");
    expect(mockListContextPackVersions).toHaveBeenCalledWith("pack-ctx-001", {
      limit: 20,
    });
    expect(
      screen.getAllByRole("heading", { name: "Launch brief" }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Artifact not found/i)).not.toBeInTheDocument();
  });

  it("keeps the normal not-found state when both artifact and context pack are missing", async () => {
    mockGetArtifact.mockRejectedValue(
      new ApiError(404, { detail: "not_found" }, "API error 404"),
    );
    mockGetContextPack.mockRejectedValue(
      new ApiError(404, { detail: "not_found" }, "API error 404"),
    );

    renderDetail("missing-pack");

    expect(await screen.findByText(/Artifact not found/i)).toBeInTheDocument();
    expect(mockGetContextPack).toHaveBeenCalledWith("missing-pack");
    expect(mockListContextPackVersions).not.toHaveBeenCalled();
  });
});
