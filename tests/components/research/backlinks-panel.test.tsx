/**
 * BacklinksPanel component tests (P4-03).
 *
 * Uses jest.mock to stub `@/hooks/useArtifactEdges` so tests are fully
 * deterministic. Follows the pattern from review-queue.test.tsx.
 *
 * Covers:
 *   - Incoming + outgoing rows render with correct edge type chips
 *   - Empty state (no edges on either side)
 *   - Loading state (aria-busy skeleton)
 *   - Error state with retry button; retry calls refetch
 *   - Edge with null peer title renders monospace ID + "(not indexed)" hint
 *   - No-artifact-selected idle state
 */

import React from "react";
import { renderWithProviders, screen, waitFor, within } from "../../utils/render";
import { userEvent } from "../../utils/render";
import { BacklinksPanel } from "@/components/research/backlinks-panel";
import type { ArtifactEdgesResponse, ArtifactEdgeItem } from "@/hooks/useArtifactEdges";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useArtifactEdges", () => ({
  ...jest.requireActual("@/hooks/useArtifactEdges"),
  useArtifactEdges: jest.fn(),
}));

// Mock next/link — renders as a plain anchor in RTL
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

function makeEdge(overrides: Partial<ArtifactEdgeItem> = {}): ArtifactEdgeItem {
  return {
    artifact_id: "01HXYZ0000000000000000001",
    type: "relates_to",
    title: "Related Concept",
    subtype: "concept",
    ...overrides,
  };
}

function makeEdgesResponse(
  overrides: Partial<ArtifactEdgesResponse> = {},
): ArtifactEdgesResponse {
  return {
    artifact_id: "01HXYZ_SOURCE",
    incoming: [],
    outgoing: [],
    ...overrides,
  };
}

function defaultHookReturn(
  data?: ArtifactEdgesResponse,
  overrides: {
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
  } = {},
) {
  return {
    data,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
    refetch: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUseArtifactEdges.mockReturnValue(
    defaultHookReturn(makeEdgesResponse()),
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 1. No artifact selected (idle)
// ===========================================================================

describe("BacklinksPanel — no artifact selected", () => {
  it("renders an idle prompt when artifactId is null", () => {
    // Override hook — should not be called when no id
    mockUseArtifactEdges.mockReturnValue(defaultHookReturn(undefined));
    renderWithProviders(<BacklinksPanel artifactId={null} />);

    expect(
      screen.getByRole("status", { name: /no artifact selected/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/select an artifact to view its backlinks/i),
    ).toBeInTheDocument();
  });

  it("renders an idle prompt when artifactId is undefined", () => {
    mockUseArtifactEdges.mockReturnValue(defaultHookReturn(undefined));
    renderWithProviders(<BacklinksPanel artifactId={undefined} />);

    expect(
      screen.getByRole("status", { name: /no artifact selected/i }),
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Loading state
// ===========================================================================

describe("BacklinksPanel — loading state", () => {
  it("renders an aria-busy loading skeleton when loading", () => {
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(undefined, { isLoading: true }),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(
      screen.getByRole("generic", { name: /backlinks loading/i }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("does not render edge lists while loading", () => {
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(undefined, { isLoading: true }),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(screen.queryByRole("list", { name: /incoming edges/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /outgoing edges/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 3. Error state
// ===========================================================================

describe("BacklinksPanel — error state", () => {
  it("renders an alert with the error message", () => {
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(undefined, {
        isError: true,
        error: new Error("Network timeout"),
      }),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/network timeout/i);
  });

  it("renders a retry button in the error state", () => {
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(undefined, {
        isError: true,
        error: new Error("Fetch failed"),
      }),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("calls refetch when the retry button is clicked", async () => {
    const user = userEvent.setup();
    const mockRefetch = jest.fn();
    mockUseArtifactEdges.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Timeout"),
      refetch: mockRefetch,
    });
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  it("does not render edge sections in the error state", () => {
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(undefined, {
        isError: true,
        error: new Error("Error"),
      }),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(screen.queryByRole("list", { name: /incoming/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 4. Empty state (no edges on either side)
// ===========================================================================

describe("BacklinksPanel — empty state", () => {
  it("renders the empty state when both incoming and outgoing are empty", () => {
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming: [], outgoing: [] })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(
      screen.getByRole("status", { name: /no edges found/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no incoming or outgoing edges/i)).toBeInTheDocument();
  });

  it("does not render edge lists in the empty state", () => {
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse()),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(screen.queryByRole("list", { name: /incoming edges/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /outgoing edges/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 5. Incoming + outgoing rows with correct edge type chips
// ===========================================================================

describe("BacklinksPanel — populated lists", () => {
  it("renders Incoming section with edge rows", () => {
    const incoming = [
      makeEdge({ artifact_id: "01AAA", title: "Alpha", type: "derived_from", subtype: "concept" }),
      makeEdge({ artifact_id: "01BBB", title: "Beta", type: "supports", subtype: "evidence" }),
    ];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming, outgoing: [] })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    const list = screen.getByRole("list", { name: /incoming edges/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders Outgoing section with edge rows", () => {
    const outgoing = [
      makeEdge({ artifact_id: "01CCC", title: "Gamma", type: "relates_to", subtype: "topic" }),
    ];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming: [], outgoing })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    const list = screen.getByRole("list", { name: /outgoing edges/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("renders edge type chip with correct label for 'contradicts' (rose)", () => {
    const incoming = [
      makeEdge({ artifact_id: "01DDD", title: "Contrarian", type: "contradicts", subtype: null }),
    ];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming, outgoing: [] })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(
      screen.getByLabelText(/edge type: contradicts/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Contradicts")).toBeInTheDocument();
  });

  it("renders 'derived_from' edge type chip", () => {
    const outgoing = [
      makeEdge({ type: "derived_from", title: "Source Doc" }),
    ];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming: [], outgoing })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(screen.getByLabelText(/edge type: derived from/i)).toBeInTheDocument();
  });

  it("renders peer title as a link to /artifact/:id", () => {
    const incoming = [
      makeEdge({ artifact_id: "01HXYZ999", title: "Quantum Mechanics" }),
    ];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming, outgoing: [] })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    const link = screen.getByRole("link", { name: /quantum mechanics/i });
    expect(link).toHaveAttribute("href", "/artifact/01HXYZ999");
  });

  it("renders TypeBadge for subtype when present", () => {
    const incoming = [
      makeEdge({ artifact_id: "01EEE", title: "Subtype Test", subtype: "concept" }),
    ];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming, outgoing: [] })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(screen.getByLabelText(/type: concept/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// 6. Null peer title — "not indexed" hint
// ===========================================================================

describe("BacklinksPanel — null peer title", () => {
  it("renders the artifact ID in monospace when title is null", () => {
    const incoming = [
      makeEdge({ artifact_id: "01NOTINDEXED", title: null, subtype: null }),
    ];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming, outgoing: [] })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    // Artifact ID should appear as a link
    const link = screen.getByRole("link", { name: "01NOTINDEXED" });
    expect(link).toHaveAttribute("href", "/artifact/01NOTINDEXED");
  });

  it("shows '(not indexed)' hint when title is null", () => {
    const incoming = [
      makeEdge({ artifact_id: "01GHOST", title: null, subtype: null }),
    ];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming, outgoing: [] })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(screen.getByText("(not indexed)")).toBeInTheDocument();
  });

  it("does not render a named link when title is null", () => {
    const incoming = [
      makeEdge({ artifact_id: "01GHOST2", title: null, subtype: null }),
    ];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming, outgoing: [] })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    // Should not render a link with text that looks like a real title
    expect(screen.queryByRole("link", { name: /related concept/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 7. Section empty hints when one side is empty
// ===========================================================================

describe("BacklinksPanel — per-section empty hints", () => {
  it("shows 'no artifacts reference this one' hint for empty incoming", () => {
    const outgoing = [makeEdge({ type: "supports" })];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming: [], outgoing })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(
      screen.getByText(/no artifacts reference this one/i),
    ).toBeInTheDocument();
  });

  it("shows 'does not reference others' hint for empty outgoing", () => {
    const incoming = [makeEdge({ type: "derived_from" })];
    mockUseArtifactEdges.mockReturnValue(
      defaultHookReturn(makeEdgesResponse({ incoming, outgoing: [] })),
    );
    renderWithProviders(<BacklinksPanel artifactId="01HXYZ_SOURCE" />);

    expect(
      screen.getByText(/does not reference others/i),
    ).toBeInTheDocument();
  });
});
