/**
 * ReviewQueue component tests (P4-05).
 *
 * Uses jest.mock to stub `@/hooks/useReviewQueue` so tests are fully
 * deterministic without requiring a real QueryClient or MSW setup.
 * Follows the established pattern from synthesis-builder.test.tsx.
 *
 * Covers:
 *   - Empty state renders with correct message when no items
 *   - Loading state renders skeleton rows (aria-busy)
 *   - Error state renders alert with retry button; retry calls refetch
 *   - Populated list renders all items with title, type badge, gate badge
 *   - LensBadgeSet is rendered per row (via artifact metadata)
 *   - Action buttons (Promote, Archive, Link) render as disabled stubs
 *   - V1 scope note renders when items are present
 *   - Gate type labels map correctly (freshness, contradiction, unknown)
 */

import React from "react";
import { renderWithProviders, screen, waitFor, within } from "../../utils/render";
import { userEvent } from "../../utils/render";
import { ReviewQueue } from "@/components/research/review-queue";
import type { ReviewItem } from "@/hooks/useReviewQueue";
import type { ArtifactCard } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useReviewQueue", () => ({
  ...jest.requireActual("@/hooks/useReviewQueue"),
  useReviewQueue: jest.fn(),
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

import { useReviewQueue } from "@/hooks/useReviewQueue";

const mockUseReviewQueue = useReviewQueue as jest.MockedFunction<typeof useReviewQueue>;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeArtifact(overrides: Partial<ArtifactCard> = {}): ArtifactCard {
  return {
    id: "01HXYZ0000000000000000001",
    workspace: "research",
    type: "concept",
    subtype: null,
    title: "Test Artifact",
    status: "stale",
    schema_version: "1.0.0",
    created: "2026-04-01T00:00:00Z",
    updated: "2026-04-17T00:00:00Z",
    file_path: "wiki/concepts/test-artifact.md",
    metadata: {
      fidelity: "medium",
      freshness: "stale",
      verification_state: "unverified",
    },
    preview: null,
    workflow_status: null,
    ...overrides,
  };
}

function makeReviewItem(
  overrides: Partial<ReviewItem> = {},
): ReviewItem {
  return {
    artifact: makeArtifact(),
    gateType: "freshness",
    reviewedAt: "2026-04-17T10:00:00Z",
    priority: "ROUTINE",
    confidenceScore: 0.5,
    ...overrides,
  };
}

function defaultHookReturn(
  items: ReviewItem[] = [],
  overrides: {
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
  } = {},
) {
  return {
    items,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    error: overrides.error ?? null,
    refetch: jest.fn(),
    filters: {
      sort: "priority" as const,
      order: "asc" as const,
      priorityFilter: "ALL" as const,
      gateFilter: "ALL" as const,
    },
    setSort: jest.fn(),
    setPriorityFilter: jest.fn(),
    setGateFilter: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUseReviewQueue.mockReturnValue(defaultHookReturn());
});

afterEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 1. Empty state
// ===========================================================================

describe("ReviewQueue — empty state", () => {
  it("renders the empty-state message when there are no items", () => {
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([]));
    renderWithProviders(<ReviewQueue />);

    expect(
      screen.getByRole("status", { name: /review queue is empty/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no artifacts in review/i)).toBeInTheDocument();
  });

  it("includes helpful copy about Freshness and Contradiction gates", () => {
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([]));
    renderWithProviders(<ReviewQueue />);

    expect(
      screen.getByText(/freshness or contradiction gate/i),
    ).toBeInTheDocument();
  });

  it("does not render the review list when empty", () => {
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([]));
    renderWithProviders(<ReviewQueue />);

    expect(screen.queryByRole("list", { name: /review queue/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Loading state
// ===========================================================================

describe("ReviewQueue — loading state", () => {
  it("renders skeleton rows with aria-busy when loading", () => {
    mockUseReviewQueue.mockReturnValue(
      defaultHookReturn([], { isLoading: true }),
    );
    renderWithProviders(<ReviewQueue />);

    const loadingList = screen.getByRole("list", { name: /review queue loading/i });
    expect(loadingList).toHaveAttribute("aria-busy", "true");
  });

  it("does not render the empty state while loading", () => {
    mockUseReviewQueue.mockReturnValue(
      defaultHookReturn([], { isLoading: true }),
    );
    renderWithProviders(<ReviewQueue />);

    expect(
      screen.queryByRole("status", { name: /review queue is empty/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render review items while loading", () => {
    mockUseReviewQueue.mockReturnValue(
      defaultHookReturn([], { isLoading: true }),
    );
    renderWithProviders(<ReviewQueue />);

    expect(screen.queryByRole("list", { name: /^Review queue$/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 3. Error state
// ===========================================================================

describe("ReviewQueue — error state", () => {
  it("renders an alert with the error message", () => {
    mockUseReviewQueue.mockReturnValue(
      defaultHookReturn([], {
        isError: true,
        error: new Error("Network error"),
      }),
    );
    renderWithProviders(<ReviewQueue />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/network error/i);
  });

  it("renders a retry button in the error state", () => {
    mockUseReviewQueue.mockReturnValue(
      defaultHookReturn([], {
        isError: true,
        error: new Error("Fetch failed"),
      }),
    );
    renderWithProviders(<ReviewQueue />);

    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it("calls refetch when the retry button is clicked", async () => {
    const user = userEvent.setup();
    const mockRefetch = jest.fn();
    mockUseReviewQueue.mockReturnValue({
      items: [],
      isLoading: false,
      isError: true,
      error: new Error("Timeout"),
      refetch: mockRefetch,
      filters: {
        sort: "priority" as const,
        order: "asc" as const,
        priorityFilter: "ALL" as const,
        gateFilter: "ALL" as const,
      },
      setSort: jest.fn(),
      setPriorityFilter: jest.fn(),
      setGateFilter: jest.fn(),
    });
    renderWithProviders(<ReviewQueue />);

    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  it("does not render the review list in the error state", () => {
    mockUseReviewQueue.mockReturnValue(
      defaultHookReturn([], {
        isError: true,
        error: new Error("Error"),
      }),
    );
    renderWithProviders(<ReviewQueue />);

    expect(screen.queryByRole("list", { name: /review queue/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 4. Populated list
// ===========================================================================

describe("ReviewQueue — populated list", () => {
  it("renders all items in the list", () => {
    const items = [
      makeReviewItem({
        artifact: makeArtifact({ id: "01AAA", title: "Alpha Concept" }),
      }),
      makeReviewItem({
        artifact: makeArtifact({ id: "01BBB", title: "Beta Topic" }),
        gateType: "contradiction",
      }),
    ];
    mockUseReviewQueue.mockReturnValue(defaultHookReturn(items));
    renderWithProviders(<ReviewQueue />);

    const list = screen.getByRole("list", { name: /review queue/i });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
  });

  it("renders each artifact title as a link to its detail page", () => {
    const item = makeReviewItem({
      artifact: makeArtifact({ id: "01HXYZ0001", title: "Quantum Mechanics" }),
    });
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([item]));
    renderWithProviders(<ReviewQueue />);

    const link = screen.getByRole("link", { name: /quantum mechanics/i });
    expect(link).toHaveAttribute("href", "/artifact/01HXYZ0001");
  });

  it("renders the type badge for each artifact", () => {
    const item = makeReviewItem({
      // Use a title that does NOT contain the type word to avoid getByText ambiguity.
      artifact: makeArtifact({ type: "concept", title: "Stellar Nebula" }),
    });
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([item]));
    renderWithProviders(<ReviewQueue />);

    // TypeBadge has aria-label="Type: Concept" — use getByLabelText for precision.
    expect(screen.getByLabelText(/type: concept/i)).toBeInTheDocument();
  });

  it("renders the count summary line", () => {
    const items = [makeReviewItem(), makeReviewItem({
      artifact: makeArtifact({ id: "01BBB" }),
    })];
    mockUseReviewQueue.mockReturnValue(defaultHookReturn(items));
    renderWithProviders(<ReviewQueue />);

    expect(screen.getByText(/2 artifacts flagged for review/i)).toBeInTheDocument();
  });

  it("renders singular count when only one item", () => {
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([makeReviewItem()]));
    renderWithProviders(<ReviewQueue />);

    expect(screen.getByText(/1 artifact flagged for review/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// 5. Gate type badges
// ===========================================================================

describe("ReviewQueue — gate type badges", () => {
  it("renders 'Freshness' gate badge for freshness gate type", () => {
    const item = makeReviewItem({ gateType: "freshness" });
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([item]));
    renderWithProviders(<ReviewQueue />);

    // GateBadge has aria-label "Triggered by: Freshness gate"
    expect(
      screen.getByLabelText(/triggered by: freshness gate/i),
    ).toBeInTheDocument();
  });

  it("renders 'Contradiction' gate badge for contradiction gate type", () => {
    const item = makeReviewItem({ gateType: "contradiction" });
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([item]));
    renderWithProviders(<ReviewQueue />);

    // Use aria-label to target the gate badge specifically (filter dropdown
    // also shows "Contradiction" in its options after DP4-02e).
    expect(
      screen.getByLabelText(/triggered by: contradiction gate/i),
    ).toBeInTheDocument();
  });

  it("renders unknown gate type string as-is for forward compatibility", () => {
    const item = makeReviewItem({ gateType: "coverage" });
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([item]));
    renderWithProviders(<ReviewQueue />);

    // Use aria-label to target the gate badge specifically (filter dropdown
    // also shows "Coverage" in its options after DP4-02e).
    expect(
      screen.getByLabelText(/triggered by: coverage gate/i),
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// 6. LensBadgeSet rendered per row
// ===========================================================================

describe("ReviewQueue — LensBadgeSet", () => {
  it("renders lens badges when artifact has metadata", () => {
    const item = makeReviewItem({
      artifact: makeArtifact({
        title: "Artifact With Badges",
        metadata: {
          fidelity: "high",
          freshness: "stale",
          verification_state: "verified",
        },
      }),
    });
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([item]));
    renderWithProviders(<ReviewQueue />);

    const lensBadgeContainer = screen.getByRole("generic", {
      name: /lens badges/i,
    });
    expect(lensBadgeContainer).toBeInTheDocument();
    expect(screen.getByLabelText(/fidelity: high/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/freshness: stale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/verification: verified/i)).toBeInTheDocument();
  });

  it("renders no lens badge container when artifact has null metadata", () => {
    const item = makeReviewItem({
      artifact: makeArtifact({ metadata: null, title: "No Metadata" }),
    });
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([item]));
    renderWithProviders(<ReviewQueue />);

    // LensBadgeSet returns null when all fields are absent
    expect(screen.queryByRole("generic", { name: /lens badges/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 7. Action buttons — disabled stubs
// ===========================================================================

describe("ReviewQueue — action button stubs", () => {
  beforeEach(() => {
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([makeReviewItem()]));
    renderWithProviders(<ReviewQueue />);
  });

  it("renders a disabled Promote button", () => {
    const btn = screen.getByRole("button", { name: /promote/i });
    expect(btn).toBeDisabled();
  });

  it("renders a disabled Archive button", () => {
    const btn = screen.getByRole("button", { name: /archive/i });
    expect(btn).toBeDisabled();
  });

  it("renders a disabled Link button", () => {
    const btn = screen.getByRole("button", { name: /link/i });
    expect(btn).toBeDisabled();
  });

  it("each stub button has a tooltip explaining v1.5 availability", () => {
    const promoteBtn = screen.getByRole("button", { name: /promote/i });
    expect(promoteBtn).toHaveAttribute("title");
    expect(promoteBtn.getAttribute("title")).toMatch(/v1\.5/i);
  });
});

// ===========================================================================
// 8. V1 scope note
// ===========================================================================

describe("ReviewQueue — V1 scope note", () => {
  it("renders a note about actions being available in v1.5 when items present", () => {
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([makeReviewItem()]));
    renderWithProviders(<ReviewQueue />);

    expect(screen.getByRole("note")).toHaveTextContent(/v1\.5/i);
  });

  it("does not render the scope note in the empty state", () => {
    mockUseReviewQueue.mockReturnValue(defaultHookReturn([]));
    renderWithProviders(<ReviewQueue />);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
