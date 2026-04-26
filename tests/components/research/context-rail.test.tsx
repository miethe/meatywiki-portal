/**
 * ContextRail component tests (DP4-02b).
 *
 * Tests the shared inline context rail primitive (ADR-DPI-002 Option A.1).
 *
 * Covers:
 *   - Generic variant renders Properties / Connections / History tabs
 *   - Research variant renders Evidence / Contradictions / Lineage / Metadata tabs
 *   - Tab switching changes active panel
 *   - Action column renders when `actions` prop is provided
 *   - Action column omitted when `actions` prop is absent
 *   - ConnectionsPanel loading state
 *   - ConnectionsPanel error state with retry
 *   - ConnectionsPanel populated with incoming + outgoing edges
 *   - PropertiesPanel renders artifact fields
 *   - Coming-soon panels render with "coming in v1.6" copy
 *   - ARIA tablist/tab/tabpanel semantics are correct
 *   - Custom tab set via `customTabs` prop
 */

import React from "react";
import { renderWithProviders, screen, waitFor, within } from "../../utils/render";
import { userEvent } from "../../utils/render";
import { ContextRail } from "@/components/layout/ContextRail";
import type { ArtifactDetail } from "@/types/artifact";
import type { ArtifactEdgesResponse } from "@/hooks/useArtifactEdges";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useArtifactEdges", () => ({
  ...jest.requireActual("@/hooks/useArtifactEdges"),
  useArtifactEdges: jest.fn(),
}));

// Mock useRecentSyntheses — research variant Syntheses tab (P4-01).
jest.mock("@/hooks/useRecentSyntheses", () => ({
  useRecentSyntheses: jest.fn(() => ({
    syntheses: [],
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

// Mock useLineage — research variant Lineage tab.
jest.mock("@/hooks/useLineage", () => ({
  useLineage: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
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

import { useArtifactEdges } from "@/hooks/useArtifactEdges";

const mockUseArtifactEdges = useArtifactEdges as jest.MockedFunction<
  typeof useArtifactEdges
>;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeEdgesResult(
  overrides: Partial<ReturnType<typeof useArtifactEdges>> = {},
): ReturnType<typeof useArtifactEdges> {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  };
}

function makeEdgesData(
  partial: Partial<ArtifactEdgesResponse> = {},
): ArtifactEdgesResponse {
  return {
    artifact_id: "test-artifact-id",
    incoming: [],
    outgoing: [],
    ...partial,
  };
}

function makeArtifact(partial: Partial<ArtifactDetail> = {}): ArtifactDetail {
  return {
    id: "test-id",
    title: "Test Artifact",
    type: "concept",
    workspace: "library",
    status: "active",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-03-01T00:00:00Z",
    slug: "test-artifact",
    file_path: "wiki/concepts/test.md",
    raw_content: null,
    compiled_content: null,
    draft_content: null,
    summary: "A brief summary",
    frontmatter_jsonb: {
      tags: ["alpha", "beta"],
    },
    artifact_edges: [],
    artifact_metadata: null,
    active_run: null,
    research_origin: null,
    ...partial,
  } as ArtifactDetail;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUseArtifactEdges.mockReturnValue(makeEdgesResult());
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("ContextRail — generic variant", () => {
  it("renders Properties, Connections, History tabs", () => {
    renderWithProviders(<ContextRail variant="generic" />);

    const tablist = screen.getByRole("tablist");
    expect(within(tablist).getByRole("tab", { name: "Properties" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Connections" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "History" })).toBeInTheDocument();
  });

  it("Properties tab is selected by default", () => {
    renderWithProviders(<ContextRail variant="generic" />);
    expect(screen.getByRole("tab", { name: "Properties" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("switches to Connections tab on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ContextRail variant="generic" artifactId="abc123" />,
    );
    await user.click(screen.getByRole("tab", { name: "Connections" }));
    expect(screen.getByRole("tab", { name: "Connections" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Connections" })).not.toHaveAttribute(
      "hidden",
    );
  });

  it("History tab renders graceful empty state (activity endpoint not yet shipped)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ContextRail variant="generic" />);
    await user.click(screen.getByRole("tab", { name: "History" }));
    // HistoryPanel renders an empty state until GET /api/artifacts/:id/activity ships.
    // OQ-P3-03-C: no mock fixture data — graceful "No activity yet" message.
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });
});

describe("ContextRail — research variant", () => {
  it("renders Evidence, Contradictions, Lineage, Syntheses, Metadata tabs", () => {
    renderWithProviders(<ContextRail variant="research" />);

    const tablist = screen.getByRole("tablist");
    expect(within(tablist).getByRole("tab", { name: "Evidence" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Contradictions" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Lineage" })).toBeInTheDocument();
    // Syntheses tab added in P4-01 (backed by useRecentSyntheses)
    expect(within(tablist).getByRole("tab", { name: "Syntheses" })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: "Metadata" })).toBeInTheDocument();
  });

  it("Evidence tab renders coming-soon placeholder (endpoint deferred)", () => {
    renderWithProviders(<ContextRail variant="research" />);
    // EvidencePanel renders a ComingSoonPanel with "Coming soon" copy
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });

  it("switches to Lineage tab and shows edges loading", async () => {
    // useLineage mock is set at module level; override to isLoading for this test
    const { useLineage } = jest.requireMock("@/hooks/useLineage") as {
      useLineage: jest.MockedFunction<() => { data: undefined; isLoading: boolean; isError: boolean; error: null; refetch: jest.Mock }>;
    };
    useLineage.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    const user = userEvent.setup();
    renderWithProviders(
      <ContextRail variant="research" artifactId="abc" />,
    );
    await user.click(screen.getByRole("tab", { name: "Lineage" }));
    // Loading state is rendered as aria-busy="true" (not role="status")
    expect(screen.getByLabelText(/loading lineage/i)).toBeInTheDocument();
  });
});

describe("ContextRail — action column", () => {
  it("renders action buttons when actions prop is provided", () => {
    const actions = [
      { label: "Promote", ariaLabel: "Promote artifact", hasEndpoint: true, description: "Promote" },
      { label: "Compile", ariaLabel: "Compile artifact", hasEndpoint: false, description: "Compile" },
    ];
    renderWithProviders(<ContextRail variant="generic" actions={actions} />);

    const group = screen.getByRole("group", { name: "Artifact actions" });
    expect(within(group).getByRole("button", { name: "Promote artifact" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Compile artifact" })).toBeInTheDocument();
  });

  it("does not render action group when actions prop is absent", () => {
    renderWithProviders(<ContextRail variant="generic" />);
    expect(screen.queryByRole("group", { name: "Artifact actions" })).not.toBeInTheDocument();
  });

  it("action without onClick renders as aria-disabled", () => {
    const actions = [
      { label: "Promote", ariaLabel: "Promote artifact", hasEndpoint: true, description: "Promote" },
    ];
    renderWithProviders(<ContextRail variant="generic" actions={actions} />);
    const btn = screen.getByRole("button", { name: "Promote artifact" });
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("action with onClick fires handler", async () => {
    const handler = jest.fn();
    const actions = [
      { label: "Go", ariaLabel: "Go action", hasEndpoint: true, description: "Go", onClick: handler },
    ];
    const user = userEvent.setup();
    renderWithProviders(<ContextRail variant="generic" actions={actions} />);
    await user.click(screen.getByRole("button", { name: "Go action" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("ContextRail — ConnectionsPanel", () => {
  it("shows loading skeleton after switching to Connections tab", async () => {
    mockUseArtifactEdges.mockReturnValue(makeEdgesResult({ isLoading: true }));
    const user = userEvent.setup();
    renderWithProviders(<ContextRail variant="generic" artifactId="abc" />);
    await user.click(screen.getByRole("tab", { name: "Connections" }));
    // Loading skeleton renders as aria-busy on the container
    expect(screen.getByLabelText(/loading connections/i)).toBeInTheDocument();
  });

  it("shows error state with retry button", async () => {
    const refetch = jest.fn();
    mockUseArtifactEdges.mockReturnValue(
      makeEdgesResult({ isError: true, error: new Error("Network error"), refetch }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ContextRail variant="generic" artifactId="abc" />);
    await user.click(screen.getByRole("tab", { name: "Connections" }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders incoming and outgoing edge sections", async () => {
    mockUseArtifactEdges.mockReturnValue(
      makeEdgesResult({
        data: makeEdgesData({
          incoming: [
            { artifact_id: "in-01", type: "supports", title: "Supporting Note", subtype: "evidence" },
          ],
          outgoing: [
            { artifact_id: "out-01", type: "derived_from", title: "Source Concept", subtype: "concept" },
          ],
        }),
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ContextRail variant="generic" artifactId="abc" />);
    await user.click(screen.getByRole("tab", { name: "Connections" }));

    await waitFor(() => {
      expect(screen.getByText("Supporting Note")).toBeInTheDocument();
      expect(screen.getByText("Source Concept")).toBeInTheDocument();
    });
  });
});

describe("ContextRail — PropertiesPanel", () => {
  it("renders artifact properties when artifact is provided", () => {
    const artifact = makeArtifact();
    renderWithProviders(<ContextRail variant="generic" artifact={artifact} artifactId={artifact.id} />);
    // Properties tab is active by default
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("concept")).toBeInTheDocument();
  });

  it("shows empty state when no artifact provided", () => {
    renderWithProviders(<ContextRail variant="generic" />);
    expect(screen.getByText("No artifact selected")).toBeInTheDocument();
  });
});

describe("ContextRail — custom tabs", () => {
  it("renders custom tab set from customTabs prop", () => {
    const customTabs = [
      {
        id: "custom-one",
        label: "Custom One",
        renderContent: () => <div>Custom panel content</div>,
      },
    ];
    renderWithProviders(<ContextRail customTabs={customTabs} />);
    expect(screen.getByRole("tab", { name: "Custom One" })).toBeInTheDocument();
    expect(screen.getByText("Custom panel content")).toBeInTheDocument();
  });
});

describe("ContextRail — accessibility", () => {
  it("tablist has aria-label", () => {
    renderWithProviders(<ContextRail variant="generic" ariaLabel="Test context" />);
    expect(screen.getAllByRole("tablist")[0]).toHaveAttribute("aria-label", "Test context");
  });

  it("each tab has aria-controls pointing to its panel", () => {
    renderWithProviders(<ContextRail variant="generic" />);
    const propertiesTab = screen.getByRole("tab", { name: "Properties" });
    const panelId = propertiesTab.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toBeInTheDocument();
  });
});
