/**
 * ContextRail — Lineage panel tests (P3-06).
 *
 * Covers the ResearchLineagePanel rendered inside the ContextRail "research"
 * variant's Lineage tab. This focuses on the useLineage integration added in
 * P3-09/P3-10 (synthesis-lineage endpoint wiring).
 *
 * Covers:
 *   - Lineage tab renders inside the research variant rail
 *   - Loading skeleton appears while useLineage is in-flight
 *   - Populated state: lineage tree rendered with root artifact title
 *   - Populated state: child nodes rendered with edge type
 *   - Empty state: "No lineage data" when found=false or root=null
 *   - Error state: alert + retry button; retry calls refetch
 *   - No artifact selected: shows "No artifact selected"
 *
 * Mocking strategy:
 *   Mock useLineage at the hook boundary.
 *   Mock useArtifactEdges (used by ConnectionsPanel in the same rail) to
 *   prevent MSW calls during Lineage tab tests.
 */

import React from "react";
import { renderWithProviders, screen, waitFor } from "../../utils/render";
import { userEvent } from "../../utils/render";
import { ContextRail } from "@/components/layout/ContextRail";
import type { ArtifactDetail } from "@/types/artifact";
import type { SynthesisLineage, SynthesisLineageNode } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useLineage", () => ({
  useLineage: jest.fn(),
}));

jest.mock("@/hooks/useArtifactEdges", () => ({
  ...jest.requireActual("@/hooks/useArtifactEdges"),
  useArtifactEdges: jest.fn(() => ({
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

import { useLineage } from "@/hooks/useLineage";

const mockUseLineage = useLineage as jest.MockedFunction<typeof useLineage>;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLineageNode(
  id: string,
  title: string,
  edgeType = "derived_from",
  children: SynthesisLineageNode[] = [],
): SynthesisLineageNode {
  return {
    artifact_id: id,
    title,
    artifact_type: "concept",
    depth: 0,
    edge_type: edgeType,
    children,
    next_sibling_cursor: null,
  };
}

function makeLineage(
  root: SynthesisLineageNode,
  overrides: Partial<SynthesisLineage> = {},
): SynthesisLineage {
  return {
    found: true,
    root,
    depth: 5,
    raw_edge_count: 1,
    ...overrides,
  };
}

function defaultLineageHook(
  overrides: Partial<ReturnType<typeof useLineage>> = {},
): ReturnType<typeof useLineage> {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stub artifact
// ---------------------------------------------------------------------------

const stubArtifact: ArtifactDetail = {
  id: "art-lineage-001",
  workspace: "library",
  type: "concept",
  subtype: null,
  title: "Lineage Root Artifact",
  status: "active",
  schema_version: "1.0.0",
  created: "2026-04-01T00:00:00Z",
  updated: "2026-04-21T00:00:00Z",
  file_path: "wiki/concepts/lineage-root.md",
  metadata: null,
  frontmatter_jsonb: {},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderResearchRail(artifactId?: string, artifact?: ArtifactDetail) {
  return renderWithProviders(
    <ContextRail
      variant="research"
      artifactId={artifactId}
      artifact={artifact}
      ariaLabel="Research context"
    />,
  );
}

async function switchToLineageTab() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: /lineage/i }));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLineage.mockReturnValue(defaultLineageHook());
});

// ===========================================================================
// 1. Tab structure
// ===========================================================================

describe("ContextRail — Lineage tab present", () => {
  it("renders the Lineage tab in the research variant", () => {
    renderResearchRail("art-lineage-001", stubArtifact);
    expect(screen.getByRole("tab", { name: /lineage/i })).toBeInTheDocument();
  });

  it("activating Lineage tab makes the panel visible", async () => {
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    const panel = screen.getByRole("tabpanel", { name: /lineage/i });
    expect(panel).not.toHaveAttribute("hidden");
  });
});

// ===========================================================================
// 2. No artifact selected
// ===========================================================================

describe("ContextRail — Lineage: no artifact selected", () => {
  it("shows 'No artifact selected' when artifactId is undefined", async () => {
    renderResearchRail(undefined, undefined);
    await switchToLineageTab();

    expect(screen.getByText(/no artifact selected/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// 3. Loading state
// ===========================================================================

describe("ContextRail — Lineage: loading state", () => {
  it("renders loading skeleton with aria-busy while useLineage is loading", async () => {
    mockUseLineage.mockReturnValue(defaultLineageHook({ isLoading: true }));
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    expect(
      document.querySelector("[aria-busy='true'][aria-label='Loading lineage']"),
    ).toBeTruthy();
  });
});

// ===========================================================================
// 4. Empty / not-found state
// ===========================================================================

describe("ContextRail — Lineage: empty state", () => {
  it("renders 'No lineage data' when found=false", async () => {
    mockUseLineage.mockReturnValue(
      defaultLineageHook({
        data: { found: false, root: null, depth: 5, raw_edge_count: 0 },
      }),
    );
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    await waitFor(() => {
      expect(screen.getByText(/no lineage data/i)).toBeInTheDocument();
    });
  });

  it("renders 'No lineage data' when root is null despite found=true", async () => {
    mockUseLineage.mockReturnValue(
      defaultLineageHook({
        data: { found: true, root: null, depth: 5, raw_edge_count: 0 },
      }),
    );
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    await waitFor(() => {
      expect(screen.getByText(/no lineage data/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 5. Populated state — lineage tree rendered
// ===========================================================================

describe("ContextRail — Lineage: populated state", () => {
  it("renders the root artifact title", async () => {
    const root = makeLineageNode("art-root-001", "Root Synthesis Artifact");
    mockUseLineage.mockReturnValue(
      defaultLineageHook({ data: makeLineage(root) }),
    );
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    await waitFor(() => {
      expect(screen.getByText("Root Synthesis Artifact")).toBeInTheDocument();
    });
  });

  it("renders child nodes with their titles", async () => {
    const child = makeLineageNode("art-child-001", "Child Concept", "derived_from");
    const root = makeLineageNode("art-root-001", "Root Article", "derived_from", [child]);
    mockUseLineage.mockReturnValue(
      defaultLineageHook({ data: makeLineage(root) }),
    );
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    await waitFor(() => {
      expect(screen.getByText("Root Article")).toBeInTheDocument();
      expect(screen.getByText("Child Concept")).toBeInTheDocument();
    });
  });

  it("renders the synthesis lineage tree role", async () => {
    const root = makeLineageNode("art-root-001", "Root Article");
    mockUseLineage.mockReturnValue(
      defaultLineageHook({ data: makeLineage(root) }),
    );
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    await waitFor(() => {
      expect(
        screen.getByRole("tree", { name: /synthesis lineage tree/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders depth and edge count in diagnostic footer", async () => {
    const root = makeLineageNode("art-root-001", "Root");
    mockUseLineage.mockReturnValue(
      defaultLineageHook({
        data: makeLineage(root, { depth: 3, raw_edge_count: 7 }),
      }),
    );
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    await waitFor(() => {
      expect(screen.getByText(/depth 3/i)).toBeInTheDocument();
      expect(screen.getByText(/7 edges? traversed/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 6. Error state
// ===========================================================================

describe("ContextRail — Lineage: error state", () => {
  it("renders an alert when useLineage returns an error", async () => {
    mockUseLineage.mockReturnValue(
      defaultLineageHook({
        isError: true,
        error: new Error("Network timeout"),
      }),
    );
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByText(/unable to load lineage/i)).toBeInTheDocument();
    expect(screen.getByText(/network timeout/i)).toBeInTheDocument();
  });

  it("renders a Retry button in the error state", async () => {
    mockUseLineage.mockReturnValue(
      defaultLineageHook({
        isError: true,
        error: new Error("Network timeout"),
      }),
    );
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  it("calls refetch when Retry is clicked", async () => {
    const mockRefetch = jest.fn();
    mockUseLineage.mockReturnValue(
      defaultLineageHook({
        isError: true,
        error: new Error("Timeout"),
        refetch: mockRefetch,
      }),
    );
    renderResearchRail("art-lineage-001", stubArtifact);
    await switchToLineageTab();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });
});
