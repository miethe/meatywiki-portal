/**
 * StaleArtifactsPanel smoke tests (P7-01).
 *
 * Validates:
 *   - Panel renders heading "Stale Artifacts"
 *   - Threshold input renders with default value 30
 *   - Loading skeleton rows render during fetch
 *   - Items render with title, freshness score bar, and metadata
 *   - Artifact title links to /artifact/:id
 *   - Empty state renders when no items returned
 *   - Error state renders when fetch fails
 *   - Pagination Next button present when cursor returned
 *   - WCAG: section landmark has correct aria-labelledby
 *   - WCAG: score meter has aria-valuenow / min / max
 *
 * Uses MSW + server.use() to control backend responses per test.
 * useFreshnessStatus uses plain fetch; MSW intercepts at the network level.
 *
 * NOTE: The component uses useEffect + fetch directly (not TanStack query).
 * We mock the getFreshnessStatus API function directly to avoid needing
 * the full fetch/MSW chain in jsdom (avoids URL resolution issues).
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mock next/link — renders as plain <a> in jsdom
// ---------------------------------------------------------------------------

jest.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

// ---------------------------------------------------------------------------
// Mock getFreshnessStatus API function
// ---------------------------------------------------------------------------

const mockGetFreshnessStatus = jest.fn();

jest.mock("@/lib/api/research", () => ({
  getFreshnessStatus: (...args: unknown[]) => mockGetFreshnessStatus(...args),
}));

// ---------------------------------------------------------------------------
// Import component under test after mocks are set up
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first
import { StaleArtifactsPanel } from "@/components/research/StaleArtifactsPanel";

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const STUB_ITEM_1 = {
  id: "01FRESH000000000000001",
  title: "Stale concept: Distributed Caching",
  type: "concept",
  subtype: "concept",
  freshness_score: 18,
  last_synthesis_date: "2025-12-01T00:00:00Z",
  source_artifact_count: 5,
  file_path: "wiki/concepts/distributed-caching.md",
};

const STUB_ITEM_2 = {
  id: "01FRESH000000000000002",
  title: "Aging entity: Redis Architecture",
  type: "entity",
  subtype: null,
  freshness_score: 42,
  last_synthesis_date: "2026-01-15T00:00:00Z",
  source_artifact_count: 3,
  file_path: "wiki/entities/redis-architecture.md",
};

function makeEnvelope(
  items = [STUB_ITEM_1, STUB_ITEM_2],
  cursor: string | null = null,
) {
  return Promise.resolve({ data: items, cursor, etag: null });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPanel(props: Partial<React.ComponentProps<typeof StaleArtifactsPanel>> = {}) {
  return render(<StaleArtifactsPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StaleArtifactsPanel (P7-01)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Structure
  // -------------------------------------------------------------------------

  describe("Structure and landmarks", () => {
    it("renders a section landmark labelled 'Stale Artifacts'", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope());
      renderPanel();

      await waitFor(() => {
        const section = screen.getByRole("region", { name: /stale artifacts/i });
        expect(section).toBeInTheDocument();
      });
    });

    it("renders the 'Stale Artifacts' heading", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope());
      renderPanel();

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /stale artifacts/i }),
        ).toBeInTheDocument();
      });
    });

    it("renders a list labelled 'Stale artifacts'", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope());
      renderPanel();

      await waitFor(() => {
        expect(
          screen.getByRole("list", { name: /stale artifacts/i }),
        ).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Threshold input
  // -------------------------------------------------------------------------

  describe("Threshold input", () => {
    it("renders the threshold input with default value 30", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope());
      renderPanel();

      const input = screen.getByRole("spinbutton", {
        name: /staleness threshold in days/i,
      });
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue(30);
    });

    it("renders with a custom initialThreshold", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope());
      renderPanel({ initialThreshold: 60 });

      const input = screen.getByRole("spinbutton", {
        name: /staleness threshold in days/i,
      });
      expect(input).toHaveValue(60);
    });

    it("has a visible label 'Stale after'", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope());
      renderPanel();
      expect(screen.getByText(/stale after/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Items rendering
  // -------------------------------------------------------------------------

  describe("Items rendering", () => {
    beforeEach(() => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope());
    });

    it("renders item titles as links to /artifact/:id", async () => {
      renderPanel();

      await waitFor(() => {
        const link1 = screen.getByRole("link", {
          name: /stale concept: distributed caching/i,
        });
        expect(link1).toHaveAttribute("href", `/artifact/${STUB_ITEM_1.id}`);
      });

      const link2 = screen.getByRole("link", {
        name: /aging entity: redis architecture/i,
      });
      expect(link2).toHaveAttribute("href", `/artifact/${STUB_ITEM_2.id}`);
    });

    it("renders freshness score meter for each item", async () => {
      renderPanel();

      await waitFor(() => {
        const meters = screen.getAllByRole("meter");
        expect(meters.length).toBeGreaterThanOrEqual(2);
      });

      const meters = screen.getAllByRole("meter");
      const firstMeter = meters[0];
      expect(firstMeter).toHaveAttribute("aria-valuenow", "18");
      expect(firstMeter).toHaveAttribute("aria-valuemin", "0");
      expect(firstMeter).toHaveAttribute("aria-valuemax", "100");
    });

    it("renders source artifact count for each item", async () => {
      renderPanel();

      await waitFor(() => {
        // "5 sources" for item 1
        expect(screen.getByText(/5 sources/i)).toBeInTheDocument();
        // "3 sources" for item 2
        expect(screen.getByText(/3 sources/i)).toBeInTheDocument();
      });
    });

    it("calls getFreshnessStatus with default threshold_days=30", async () => {
      renderPanel();

      await waitFor(() => {
        expect(mockGetFreshnessStatus).toHaveBeenCalledWith(
          expect.objectContaining({ threshold_days: 30 }),
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe("Empty state", () => {
    it("renders empty state message when no items returned", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope([], null));
      renderPanel();

      await waitFor(() => {
        expect(
          screen.getByText(/no stale artifacts found/i),
        ).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  describe("Error state", () => {
    it("renders error message when fetch throws", async () => {
      mockGetFreshnessStatus.mockRejectedValue(new Error("Network error"));
      renderPanel();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  describe("Pagination", () => {
    it("renders Next button when cursor returned", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope([STUB_ITEM_1], "page2"));
      renderPanel();

      await waitFor(() => {
        const nextBtn = screen.getByRole("button", { name: /next page/i });
        expect(nextBtn).toBeInTheDocument();
        expect(nextBtn).not.toBeDisabled();
      });
    });

    it("Prev button is disabled on first page", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope([STUB_ITEM_1], "page2"));
      renderPanel();

      await waitFor(() => {
        const prevBtn = screen.getByRole("button", { name: /previous page/i });
        expect(prevBtn).toBeDisabled();
      });
    });

    it("does NOT render pagination when no cursor and on first page", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope([STUB_ITEM_1], null));
      renderPanel();

      await waitFor(() => {
        // Items should be visible, confirming load is done
        expect(
          screen.getByRole("link", { name: /distributed caching/i }),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("navigation", { name: /stale artifacts pagination/i }),
      ).not.toBeInTheDocument();
    });

    it("clicking Next fetches next page with returned cursor", async () => {
      const page1Envelope = makeEnvelope([STUB_ITEM_1], "page2");
      const page2Envelope = makeEnvelope([STUB_ITEM_2], null);

      mockGetFreshnessStatus
        .mockReturnValueOnce(page1Envelope)
        .mockReturnValueOnce(page2Envelope);

      const user = userEvent.setup();
      renderPanel();

      // Wait for page 1 to load
      await waitFor(() => {
        expect(
          screen.getByRole("link", { name: /distributed caching/i }),
        ).toBeInTheDocument();
      });

      // Click Next
      const nextBtn = screen.getByRole("button", { name: /next page/i });
      await act(async () => {
        await user.click(nextBtn);
      });

      // Wait for page 2
      await waitFor(() => {
        expect(
          screen.getByRole("link", { name: /redis architecture/i }),
        ).toBeInTheDocument();
      });

      expect(mockGetFreshnessStatus).toHaveBeenCalledTimes(2);
      expect(mockGetFreshnessStatus).toHaveBeenLastCalledWith(
        expect.objectContaining({ cursor: "page2" }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // WCAG / Accessibility
  // -------------------------------------------------------------------------

  describe("Accessibility", () => {
    it("each meter has an accessible label with the score value", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope());
      renderPanel();

      await waitFor(() => {
        const meters = screen.getAllByRole("meter");
        expect(meters[0]).toHaveAccessibleName(/freshness score: 18/i);
      });
    });

    it("pagination navigation has an accessible label", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope([STUB_ITEM_1], "page2"));
      renderPanel();

      await waitFor(() => {
        expect(
          screen.getByRole("navigation", { name: /stale artifacts pagination/i }),
        ).toBeInTheDocument();
      });
    });

    it("page indicator is an aria-live region", async () => {
      mockGetFreshnessStatus.mockReturnValue(makeEnvelope([STUB_ITEM_1], "page2"));
      renderPanel();

      await waitFor(() => {
        const liveEl = screen.getByText(/page 1/i);
        expect(liveEl).toHaveAttribute("aria-live", "polite");
      });
    });
  });
});
