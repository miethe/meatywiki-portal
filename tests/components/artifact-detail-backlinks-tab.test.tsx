/**
 * ArtifactDetailClient — Backlinks tab tests (P7-04).
 *
 * Verifies:
 *   - Backlinks tab is always visible (regardless of artifact type)
 *   - Switching to Backlinks tab activates it and shows the tab panel
 *   - Loading skeleton renders while backlinks are fetching
 *   - Populated state: items list renders with correct peer titles + edge type chips
 *   - Empty state when no backlinks exist
 *   - Error state with retry button when fallback also fails
 *   - Filter dropdown is present and has "All types" default option
 *   - Fallback (client-side) indicator note shown when isFallback=true
 *
 * Mocking strategy:
 *   - Mock getArtifact at module boundary (same pattern as artifact-detail.test.tsx)
 *   - Mock useArtifactBacklinks at module boundary to control data
 *   - Mock useArtifactWorkflowRuns, useArtifactEdges, useArtifactActivity,
 *     useContradictionCount to suppress real network requests in jsdom
 *   - Mock next/navigation (useSearchParams + useRouter)
 *   - Mock next/link to plain anchor
 */

import React from "react";
import { renderWithProviders, screen, waitFor, fireEvent } from "../utils/render";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArtifactDetailClient } from "@/app/(main)/artifact/[id]/ArtifactDetailClient";
import type { ArtifactDetail } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  getArtifact: jest.fn(),
  getDerivatives: jest.fn(),
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
    data: { artifact_id: "test", incoming: [], outgoing: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("@/hooks/useArtifactBacklinks", () => ({
  ...jest.requireActual("@/hooks/useArtifactBacklinks"),
  useArtifactBacklinks: jest.fn(),
}));

// Suppress activity timeline network calls (ActivityTimeline uses this)
jest.mock("@/hooks/useArtifactActivity", () => ({
  useArtifactActivity: jest.fn(() => ({
    activity: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

// Suppress contradiction flag network calls
jest.mock("@/hooks/useContradictionCount", () => ({
  useContradictionCount: jest.fn(() => ({
    count: 0,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

// Suppress quality-gate-context calls if present
jest.mock("@/hooks/useQualityGates", () => ({
  useQualityGates: jest.fn(() => ({
    gates: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: jest.fn(() => new URLSearchParams()),
  redirect: jest.fn(),
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

import { getArtifact } from "@/lib/api/artifacts";
import { useArtifactBacklinks } from "@/hooks/useArtifactBacklinks";

const mockGetArtifact = getArtifact as jest.MockedFunction<typeof getArtifact>;
const mockUseArtifactBacklinks = useArtifactBacklinks as jest.MockedFunction<
  typeof useArtifactBacklinks
>;

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const TEST_ID = "01HXYZ0000000000000000001";

const stubDetail: ArtifactDetail = {
  id: TEST_ID,
  workspace: "library",
  type: "concept",
  subtype: null,
  title: "Backlinks Test Artifact",
  status: "active",
  schema_version: "1.0.0",
  created: "2026-04-01T00:00:00Z",
  updated: "2026-04-20T00:00:00Z",
  file_path: "wiki/concepts/backlinks-test.md",
  metadata: null,
  summary: null,
  slug: "backlinks-test",
  content_hash: "abc123",
  frontmatter_jsonb: {},
  raw_content: "# Backlinks Test",
  compiled_content: null,
  draft_content: null,
  artifact_edges: null,
};

function defaultBacklinksHook(
  overrides: Partial<ReturnType<typeof useArtifactBacklinks>> = {},
): ReturnType<typeof useArtifactBacklinks> {
  return {
    incoming: [],
    outgoing: [],
    items: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isFallback: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderDetail(id = TEST_ID) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderWithProviders(
    <QueryClientProvider client={queryClient}>
      <ArtifactDetailClient id={id} />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetArtifact.mockResolvedValue(stubDetail);
  mockUseArtifactBacklinks.mockReturnValue(defaultBacklinksHook());
});

afterEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 1. Tab visibility
// ===========================================================================

describe("ArtifactDetailClient — Backlinks tab visibility", () => {
  it("renders Backlinks tab for non-source artifact types", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /backlinks/i })).toBeInTheDocument();
  });

  it("renders Backlinks tab for source-type artifacts too", async () => {
    mockGetArtifact.mockResolvedValue({ ...stubDetail, type: "raw_note" });
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /backlinks/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Tab activation
// ===========================================================================

describe("ArtifactDetailClient — Backlinks tab activation", () => {
  it("activates Backlinks tab when clicked", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    const tab = screen.getByRole("tab", { name: /backlinks/i });
    fireEvent.click(tab);

    expect(tab).toHaveAttribute("aria-selected", "true");
  });

  it("shows the filter dropdown after clicking Backlinks tab", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    // Filter dropdown is only rendered when the panel is active
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /filter backlinks by edge type/i }),
      ).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 3. Loading state
// ===========================================================================

describe("ArtifactDetailClient — Backlinks tab loading state", () => {
  it("renders aria-busy skeleton while backlinks are loading", async () => {
    mockUseArtifactBacklinks.mockReturnValue(
      defaultBacklinksHook({ isLoading: true }),
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      const busy = document.querySelector("[aria-busy='true'][aria-label='Backlinks loading']");
      expect(busy).toBeTruthy();
    });
  });
});

// ===========================================================================
// 4. Empty state
// ===========================================================================

describe("ArtifactDetailClient — Backlinks tab empty state", () => {
  it("renders 'no backlinks found' empty state when items list is empty", async () => {
    mockUseArtifactBacklinks.mockReturnValue(
      defaultBacklinksHook({ items: [], incoming: [], outgoing: [] }),
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: /no backlinks found/i }),
      ).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 5. Populated state
// ===========================================================================

describe("ArtifactDetailClient — Backlinks tab populated state", () => {
  it("renders backlink items with peer title links", async () => {
    const items = [
      { artifact_id: "01AAA", type: "relates_to" as const, title: "Peer Article", subtype: "concept" },
      { artifact_id: "01BBB", type: "supports" as const, title: "Evidence Base", subtype: "evidence" },
    ];
    mockUseArtifactBacklinks.mockReturnValue(
      defaultBacklinksHook({ items, outgoing: items, isFallback: false }),
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /peer article/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /evidence base/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /peer article/i })).toHaveAttribute(
      "href",
      "/artifact/01AAA",
    );
  });

  it("renders edge type chips on backlink items", async () => {
    const items = [
      { artifact_id: "01CCC", type: "contradicts" as const, title: "Contrarian", subtype: null },
    ];
    mockUseArtifactBacklinks.mockReturnValue(
      defaultBacklinksHook({ items, outgoing: items, isFallback: false }),
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/edge type: contradicts/i)).toBeInTheDocument();
    });
  });

  it("renders split Incoming/Outgoing sections when isFallback=true", async () => {
    const incoming = [
      { artifact_id: "01DDD", type: "derived_from" as const, title: "Incoming Ref", subtype: null },
    ];
    const outgoing = [
      { artifact_id: "01EEE", type: "supports" as const, title: "Outgoing Ref", subtype: null },
    ];
    mockUseArtifactBacklinks.mockReturnValue(
      defaultBacklinksHook({
        incoming,
        outgoing,
        items: [...incoming, ...outgoing],
        isFallback: true,
      }),
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /incoming edges/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("list", { name: /outgoing edges/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// 6. Error state
// ===========================================================================

describe("ArtifactDetailClient — Backlinks tab error state", () => {
  it("renders an alert with error message when both paths fail", async () => {
    mockUseArtifactBacklinks.mockReturnValue(
      defaultBacklinksHook({
        isError: true,
        error: new Error("Both backlinks paths failed"),
        isFallback: true,
      }),
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/both backlinks paths failed/i);
    });
  });

  it("renders a retry button in error state", async () => {
    mockUseArtifactBacklinks.mockReturnValue(
      defaultBacklinksHook({
        isError: true,
        error: new Error("Timeout"),
        isFallback: true,
      }),
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// 7. Filter dropdown
// ===========================================================================

describe("ArtifactDetailClient — Backlinks tab filter dropdown", () => {
  it("renders the edge type filter dropdown with 'All types' default", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      const select = screen.getByRole("combobox", {
        name: /filter backlinks by edge type/i,
      });
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue("");
    });
  });

  it("filter dropdown contains known edge type options", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      const select = screen.getByRole("combobox", {
        name: /filter backlinks by edge type/i,
      });
      const options = Array.from(select.querySelectorAll("option")).map((o) => o.value);
      expect(options).toContain("derived_from");
      expect(options).toContain("contradicts");
      expect(options).toContain("supports");
      expect(options).toContain(""); // "All types"
    });
  });
});

// ===========================================================================
// 8. Fallback indicator
// ===========================================================================

describe("ArtifactDetailClient — Backlinks tab fallback indicator", () => {
  it("shows client data note when isFallback=true", async () => {
    mockUseArtifactBacklinks.mockReturnValue(
      defaultBacklinksHook({ isFallback: true }),
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      expect(screen.getByRole("note")).toBeInTheDocument();
    });
  });

  it("does not show client data note when isFallback=false", async () => {
    mockUseArtifactBacklinks.mockReturnValue(
      defaultBacklinksHook({ isFallback: false }),
    );

    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /backlinks/i }));

    await waitFor(() => {
      // Filter dropdown confirms panel is mounted
      expect(
        screen.getByRole("combobox", { name: /filter backlinks by edge type/i }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
