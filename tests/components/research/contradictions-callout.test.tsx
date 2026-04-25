/**
 * ContradictionsCallout component tests (P3-06).
 *
 * Covers:
 *   - Loading skeleton renders with aria-busy while fetch is in-flight
 *   - Error state renders "Unable to load contradictions" alert
 *   - Empty state renders role="status" with "No contradictions detected"
 *   - Success state renders badge count + pair list
 *   - Count badge shows correct aria-label
 *   - Each pair renders both artifact titles
 *
 * Mocking strategy:
 *   Mock fetchContradictions at the API module boundary.
 *   TanStack Query is provided via QueryClientProvider in the render wrapper.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ContradictionsCallout } from "@/components/research/ContradictionsCallout";
import * as researchApi from "@/lib/api/research";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/research", () => ({
  ...jest.requireActual("@/lib/api/research"),
  fetchContradictions: jest.fn(),
}));

const mockFetchContradictions = researchApi.fetchContradictions as jest.Mock;

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeContradictionPair(id: string) {
  return {
    id,
    artifact_a: {
      id: `${id}-a`,
      title: `Artifact A for ${id}`,
      excerpt: null,
      file_path: `wiki/concepts/a-${id}.md`,
    },
    artifact_b: {
      id: `${id}-b`,
      title: `Artifact B for ${id}`,
      excerpt: null,
      file_path: `wiki/concepts/b-${id}.md`,
    },
    shared_topic: "Test Topic",
    flagged_at: "2026-04-20T10:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCallout() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ContradictionsCallout />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// 1. Loading state
// ===========================================================================

describe("ContradictionsCallout — loading state", () => {
  it("renders the loading skeleton with aria-busy while fetch is in-flight", () => {
    // Never-resolving promise keeps the component in loading state.
    mockFetchContradictions.mockReturnValue(new Promise(() => undefined));
    renderCallout();

    expect(
      document.querySelector("[aria-busy='true'][aria-label='Contradictions loading']"),
    ).toBeTruthy();
  });

  it("does not render the error state while loading", () => {
    mockFetchContradictions.mockReturnValue(new Promise(() => undefined));
    renderCallout();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not render the empty status region while loading", () => {
    mockFetchContradictions.mockReturnValue(new Promise(() => undefined));
    renderCallout();

    expect(
      screen.queryByRole("status", { name: /no contradictions detected/i }),
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 2. Error state
// ===========================================================================

describe("ContradictionsCallout — error state", () => {
  it("renders an alert with 'Unable to load contradictions' on fetch error", async () => {
    mockFetchContradictions.mockRejectedValue(new Error("Network failure"));
    renderCallout();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /unable to load contradictions/i,
    );
  });

  it("does not render the item list in the error state", async () => {
    mockFetchContradictions.mockRejectedValue(new Error("Timeout"));
    renderCallout();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 3. Empty state
// ===========================================================================

describe("ContradictionsCallout — empty state", () => {
  it("renders the no-contradictions status message when the list is empty", async () => {
    mockFetchContradictions.mockResolvedValue({ data: [] });
    renderCallout();

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: /no contradictions detected/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/no contradictions detected/i)).toBeInTheDocument();
  });

  it("does not render the item list when empty", async () => {
    mockFetchContradictions.mockResolvedValue({ data: [] });
    renderCallout();

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: /no contradictions detected/i }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("does not render the count badge when empty", async () => {
    mockFetchContradictions.mockResolvedValue({ data: [] });
    renderCallout();

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: /no contradictions detected/i }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/contradiction pair/i)).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 4. Success state — data present
// ===========================================================================

describe("ContradictionsCallout — success state", () => {
  it("renders the item list with each pair's artifact titles", async () => {
    const pairs = [
      makeContradictionPair("contra-001"),
      makeContradictionPair("contra-002"),
    ];
    mockFetchContradictions.mockResolvedValue({ data: pairs });
    renderCallout();

    await waitFor(() => {
      expect(screen.getByText("Artifact A for contra-001")).toBeInTheDocument();
    });

    expect(screen.getByText("Artifact B for contra-001")).toBeInTheDocument();
    expect(screen.getByText("Artifact A for contra-002")).toBeInTheDocument();
    expect(screen.getByText("Artifact B for contra-002")).toBeInTheDocument();
  });

  it("renders the count badge with the correct number of pairs", async () => {
    const pairs = [
      makeContradictionPair("contra-001"),
      makeContradictionPair("contra-002"),
    ];
    mockFetchContradictions.mockResolvedValue({ data: pairs });
    renderCallout();

    await waitFor(() => {
      // Both the list and the badge share the aria-label — use getAllByLabelText
      const elements = screen.getAllByLabelText(/2 contradiction pairs/i);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("uses singular label when exactly one pair", async () => {
    mockFetchContradictions.mockResolvedValue({
      data: [makeContradictionPair("contra-001")],
    });
    renderCallout();

    await waitFor(() => {
      // Two elements carry the aria-label (list + badge)
      const labels = screen.getAllByLabelText(/1 contradiction pair/i);
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders the 'Contradictions' section heading", async () => {
    mockFetchContradictions.mockResolvedValue({
      data: [makeContradictionPair("contra-001")],
    });
    renderCallout();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /contradictions/i }),
      ).toBeInTheDocument();
    });
  });
});
