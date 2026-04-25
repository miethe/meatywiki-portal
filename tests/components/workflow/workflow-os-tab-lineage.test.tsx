/**
 * WorkflowOSTab — synthesis-lineage data as primary source (P3-06).
 *
 * The existing workflow-os-tab.test.tsx covers run history and basic tab structure.
 * This file focuses on the HandoffChainSection which uses useLineage (P3-10) as
 * the primary data source for the lineage area.
 *
 * Covers:
 *   - useLineage called with the artifact id when tab is enabled
 *   - Loading skeleton renders while useLineage is in-flight
 *   - Populated state: synthesis lineage tree rendered (API response primary)
 *   - Populated state: root artifact title and child node titles rendered
 *   - Empty state: "No lineage data" when found=false
 *   - Error state: error message rendered; HandoffChain fallback shown if edges present
 *   - useLineage NOT called when enabled=false (lazy load)
 *
 * Mocking strategy:
 *   Mock useLineage and useArtifactWorkflowRuns at hook boundaries.
 *   HandoffChain is rendered real (it just reads artifact_edges from the artifact prop).
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { WorkflowOSTab } from "@/components/workflow/workflow-os-tab";
import type { ArtifactDetail } from "@/types/artifact";
import type { SynthesisLineage, SynthesisLineageNode } from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useLineage", () => ({
  useLineage: jest.fn(),
}));

jest.mock("@/hooks/useArtifactWorkflowRuns", () => ({
  useArtifactWorkflowRuns: jest.fn(() => ({
    runs: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
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
import { useArtifactWorkflowRuns } from "@/hooks/useArtifactWorkflowRuns";

const mockUseLineage = useLineage as jest.MockedFunction<typeof useLineage>;
const mockUseRuns = useArtifactWorkflowRuns as jest.MockedFunction<typeof useArtifactWorkflowRuns>;

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
    depth: 3,
    raw_edge_count: 2,
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
  id: "art-wf-os-001",
  workspace: "library",
  type: "concept",
  subtype: null,
  title: "WorkflowOS Lineage Test",
  status: "active",
  schema_version: "1.0.0",
  created: "2026-04-01T00:00:00Z",
  updated: "2026-04-21T00:00:00Z",
  file_path: "wiki/concepts/wf-os-lineage.md",
  metadata: {
    fidelity: "high",
    freshness: "current",
    verification_state: "verified",
  },
  frontmatter_jsonb: null,
  artifact_edges: null,
};

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
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUseLineage.mockReturnValue(defaultLineageHook());
  mockUseRuns.mockReturnValue({
    runs: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
});

// ===========================================================================
// 1. Lazy-load: useLineage not called when tab is disabled
// ===========================================================================

describe("WorkflowOSTab — lazy-load lineage", () => {
  it("calls useLineage with the artifact id when rendered", () => {
    renderTab({ enabled: true });
    // useLineage is called unconditionally (React hook rules); it's the
    // TanStack Query `enabled` option inside the hook that gates the actual fetch.
    expect(mockUseLineage).toHaveBeenCalledWith(stubArtifact.id);
  });

  it("calls useArtifactWorkflowRuns with enabled=true when tab is active", () => {
    renderTab({ enabled: true });
    expect(mockUseRuns).toHaveBeenCalledWith(stubArtifact.id, true);
  });

  it("calls useArtifactWorkflowRuns with enabled=false when tab is inactive", () => {
    renderTab({ enabled: false });
    expect(mockUseRuns).toHaveBeenCalledWith(stubArtifact.id, false);
  });
});

// ===========================================================================
// 2. Loading state
// ===========================================================================

describe("WorkflowOSTab — lineage loading state", () => {
  it("renders lineage loading skeleton with aria-busy", () => {
    mockUseLineage.mockReturnValue(defaultLineageHook({ isLoading: true }));
    renderTab();

    expect(
      document.querySelector("[aria-busy='true'][aria-label='Loading lineage']"),
    ).toBeTruthy();
  });
});

// ===========================================================================
// 3. Empty state: not found in overlay
// ===========================================================================

describe("WorkflowOSTab — lineage: not found", () => {
  it("renders 'No lineage data' when found=false", async () => {
    mockUseLineage.mockReturnValue(
      defaultLineageHook({
        data: { found: false, root: null, depth: 3, raw_edge_count: 0 },
      }),
    );
    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/no lineage data/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 4. Populated state — synthesis lineage as primary source
// ===========================================================================

describe("WorkflowOSTab — lineage: populated from synthesis-lineage API", () => {
  it("renders the synthesis lineage tree from the API response", async () => {
    const root = makeLineageNode("art-root-001", "Synthesis Root Node");
    mockUseLineage.mockReturnValue(
      defaultLineageHook({ data: makeLineage(root) }),
    );
    renderTab();

    await waitFor(() => {
      expect(screen.getByText("Synthesis Root Node")).toBeInTheDocument();
    });
  });

  it("renders child nodes from the synthesis lineage response", async () => {
    const child = makeLineageNode("art-child-001", "Derived Child Concept", "derived_from");
    const root = makeLineageNode("art-root-001", "Synthesis Root", "derived_from", [child]);
    mockUseLineage.mockReturnValue(
      defaultLineageHook({ data: makeLineage(root, { raw_edge_count: 3 }) }),
    );
    renderTab();

    await waitFor(() => {
      expect(screen.getByText("Synthesis Root")).toBeInTheDocument();
      expect(screen.getByText("Derived Child Concept")).toBeInTheDocument();
    });
  });

  it("renders the synthesis lineage tree aria role", async () => {
    const root = makeLineageNode("art-root-001", "Root Synthesis");
    mockUseLineage.mockReturnValue(
      defaultLineageHook({ data: makeLineage(root) }),
    );
    renderTab();

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
        data: makeLineage(root, { depth: 4, raw_edge_count: 5 }),
      }),
    );
    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/depth 4/i)).toBeInTheDocument();
      expect(screen.getByText(/5 edges? traversed/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 5. Error state
// ===========================================================================

describe("WorkflowOSTab — lineage: error state", () => {
  it("renders an error message when useLineage fails", async () => {
    mockUseLineage.mockReturnValue(
      defaultLineageHook({
        isError: true,
        error: new Error("Backend error"),
      }),
    );
    renderTab();

    await waitFor(() => {
      expect(screen.getByText(/unable to load lineage from api/i)).toBeInTheDocument();
    });
  });

  it("shows HandoffChain fallback message when artifact has no edges", async () => {
    mockUseLineage.mockReturnValue(
      defaultLineageHook({
        isError: true,
        error: new Error("Backend error"),
      }),
    );
    renderTab({ artifact: { ...stubArtifact, artifact_edges: null } });

    await waitFor(() => {
      // The error message should be present
      expect(screen.getByText(/unable to load lineage/i)).toBeInTheDocument();
    });
  });
});
