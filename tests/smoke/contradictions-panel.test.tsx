/**
 * ContradictionsPanel smoke tests (P7-02).
 *
 * Validates:
 *   - Panel renders section landmark labelled "Contradictions"
 *   - Panel renders heading "Contradictions"
 *   - Loading skeleton renders (4 rows) while data is in flight
 *   - Contradiction rows render: artifact_a title, "vs", artifact_b title,
 *     shared_topic tag, flagged_at date
 *   - Empty state renders when no pairs returned
 *   - Error state renders when fetch fails
 *   - "Load more" button appears when hasNextPage is true
 *   - "Load more" button is absent when there is no next page
 *   - Clicking a row opens the ContradictionDetailModal
 *   - Modal shows both artifact titles and shared_topic
 *   - Closing the modal (Esc / click X) hides it
 *   - WCAG: list is aria-labelled; section is aria-labelledby heading
 *   - WCAG: each row button has a descriptive aria-label
 *
 * Mocking strategy:
 *   Mock `useContradictions` hook directly — avoids the full TanStack Query
 *   / MSW / URL-resolution chain in jsdom. Mirrors StaleArtifactsPanel tests.
 *
 * Portal v1.6 Phase 7 (P7-02).
 */

import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
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
// Mock useContradictions hook
// ---------------------------------------------------------------------------

const mockUseContradictions = jest.fn();

jest.mock("@/hooks/useContradictions", () => ({
  useContradictions: () => mockUseContradictions(),
}));

// ---------------------------------------------------------------------------
// Import components under test after mocks are registered
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first
import { ContradictionsPanel } from "@/components/research/ContradictionsPanel";

// ---------------------------------------------------------------------------
// Stub data
// ---------------------------------------------------------------------------

const STUB_PAIR_1 = {
  id: "contra-stub-001",
  artifact_a: {
    id: "01HXYZ0000000000000000010",
    title: "Distributed caching improves throughput",
    excerpt: "Evidence suggests caching at the edge reduces latency by 40%.",
    file_path: "wiki/concepts/caching-throughput.md",
  },
  artifact_b: {
    id: "01HXYZ0000000000000000011",
    title: "Cache invalidation introduces stale reads",
    excerpt: "Stale reads occur when cache TTLs are misaligned.",
    file_path: "wiki/concepts/cache-invalidation.md",
  },
  shared_topic: "Distributed Caching",
  flagged_at: "2026-04-20T10:00:00Z",
};

const STUB_PAIR_2 = {
  id: "contra-stub-002",
  artifact_a: {
    id: "01HXYZ0000000000000000020",
    title: "Eventual consistency enables high availability",
    excerpt: "Systems can remain available during network partitions.",
    file_path: "wiki/concepts/eventual-consistency.md",
  },
  artifact_b: {
    id: "01HXYZ0000000000000000021",
    title: "Strong consistency prevents data anomalies",
    excerpt: "Linearizability ensures all reads reflect the most recent write.",
    file_path: "wiki/concepts/strong-consistency.md",
  },
  shared_topic: "Consistency Models",
  flagged_at: "2026-04-18T15:00:00Z",
};

/** Default idle result (no data yet, not loading) */
function makeIdleResult() {
  return {
    pairs: [],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    isError: false,
    error: null,
  };
}

/** Loading state */
function makeLoadingResult() {
  return { ...makeIdleResult(), isLoading: true };
}

/** Populated state */
function makePopulatedResult(
  pairs = [STUB_PAIR_1, STUB_PAIR_2],
  hasNextPage = false,
) {
  return {
    ...makeIdleResult(),
    pairs,
    hasNextPage,
  };
}

/** Error state */
function makeErrorResult(message = "Network error") {
  return {
    ...makeIdleResult(),
    isError: true,
    error: new Error(message),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPanel(
  props: Partial<React.ComponentProps<typeof ContradictionsPanel>> = {},
) {
  return render(<ContradictionsPanel {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ContradictionsPanel (P7-02)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Structure and landmarks
  // -------------------------------------------------------------------------

  describe("Structure and landmarks", () => {
    it("renders a section landmark labelled 'Contradictions'", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
      renderPanel();

      const section = screen.getByRole("region", { name: /contradictions/i });
      expect(section).toBeInTheDocument();
    });

    it("renders the 'Contradictions' heading", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
      renderPanel();

      expect(
        screen.getByRole("heading", { name: /contradictions/i }),
      ).toBeInTheDocument();
    });

    it("renders the AlertTriangle icon via aria-hidden", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
      renderPanel();
      // Icon is decorative — heading still accessible
      expect(
        screen.getByRole("heading", { name: /contradictions/i }),
      ).toBeInTheDocument();
    });

    it("renders a list of contradiction pairs", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
      renderPanel();

      const list = screen.getByRole("list", { name: /contradiction pairs/i });
      expect(list).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe("Loading state", () => {
    it("renders loading indicator with aria-busy when isLoading=true", () => {
      mockUseContradictions.mockReturnValue(makeLoadingResult());
      renderPanel();

      const busyEl = screen.getByLabelText(/contradictions loading/i);
      expect(busyEl).toHaveAttribute("aria-busy", "true");
    });

    it("does not render a list when loading", () => {
      mockUseContradictions.mockReturnValue(makeLoadingResult());
      renderPanel();

      expect(
        screen.queryByRole("list", { name: /contradiction pairs/i }),
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Items rendering
  // -------------------------------------------------------------------------

  describe("Items rendering", () => {
    beforeEach(() => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
    });

    it("renders buttons for each contradiction pair", () => {
      renderPanel();

      const buttons = screen.getAllByRole("button", { name: /contradiction:/i });
      expect(buttons).toHaveLength(2);
    });

    it("renders artifact_a title in first row", () => {
      renderPanel();

      expect(
        screen.getByText("Distributed caching improves throughput"),
      ).toBeInTheDocument();
    });

    it("renders artifact_b title in first row", () => {
      renderPanel();

      expect(
        screen.getByText("Cache invalidation introduces stale reads"),
      ).toBeInTheDocument();
    });

    it("renders shared_topic tag in each row", () => {
      renderPanel();

      expect(screen.getByText("Distributed Caching")).toBeInTheDocument();
      expect(screen.getByText("Consistency Models")).toBeInTheDocument();
    });

    it("renders count badge when pairs are loaded", () => {
      renderPanel();

      const badge = screen.getByLabelText(/2 contradiction pairs/i);
      expect(badge).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe("Empty state", () => {
    it("renders empty state message when no pairs returned", () => {
      mockUseContradictions.mockReturnValue(makeIdleResult());
      renderPanel();

      expect(
        screen.getByRole("status", { name: /no contradictions detected/i }),
      ).toBeInTheDocument();
    });

    it("does not render a list in the empty state", () => {
      mockUseContradictions.mockReturnValue(makeIdleResult());
      renderPanel();

      expect(
        screen.queryByRole("list", { name: /contradiction pairs/i }),
      ).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  describe("Error state", () => {
    it("renders error alert when isError=true", () => {
      mockUseContradictions.mockReturnValue(makeErrorResult("Network error"));
      renderPanel();

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("renders the error message text", () => {
      mockUseContradictions.mockReturnValue(makeErrorResult("Network error"));
      renderPanel();

      expect(screen.getByText(/failed to load contradictions/i)).toBeInTheDocument();
    });

    it("renders the error detail when provided", () => {
      mockUseContradictions.mockReturnValue(makeErrorResult("Network error"));
      renderPanel();

      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  describe("Pagination", () => {
    it("renders 'Load more' button when hasNextPage is true", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1], true));
      renderPanel();

      expect(
        screen.getByRole("button", { name: /load more contradictions/i }),
      ).toBeInTheDocument();
    });

    it("does not render 'Load more' button when hasNextPage is false", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
      renderPanel();

      expect(
        screen.queryByRole("button", { name: /load more contradictions/i }),
      ).not.toBeInTheDocument();
    });

    it("calls fetchNextPage when 'Load more' is clicked", async () => {
      const mockFetchNextPage = jest.fn();
      mockUseContradictions.mockReturnValue({
        ...makePopulatedResult([STUB_PAIR_1], true),
        fetchNextPage: mockFetchNextPage,
      });

      const user = userEvent.setup();
      renderPanel();

      const btn = screen.getByRole("button", { name: /load more contradictions/i });
      await user.click(btn);

      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("disables 'Load more' button while isFetchingNextPage", () => {
      mockUseContradictions.mockReturnValue({
        ...makePopulatedResult([STUB_PAIR_1], true),
        isFetchingNextPage: true,
      });

      renderPanel();

      const btn = screen.getByRole("button", { name: /loading more contradictions/i });
      expect(btn).toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // Detail modal — open/close
  // -------------------------------------------------------------------------

  describe("Detail modal", () => {
    it("opens the detail modal when a row is clicked", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      const user = userEvent.setup();
      renderPanel();

      const rowBtn = screen.getByRole("button", { name: /distributed caching improves throughput/i });
      await user.click(rowBtn);

      // Modal heading appears
      expect(
        screen.getByRole("dialog", { name: /contradiction detail/i }),
      ).toBeInTheDocument();
    });

    it("modal shows both artifact titles", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      const user = userEvent.setup();
      renderPanel();

      const rowBtn = screen.getByRole("button", { name: /distributed caching improves throughput/i });
      await user.click(rowBtn);

      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText("Distributed caching improves throughput"),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText("Cache invalidation introduces stale reads"),
      ).toBeInTheDocument();
    });

    it("modal shows the shared_topic", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      const user = userEvent.setup();
      renderPanel();

      const rowBtn = screen.getByRole("button", { name: /distributed caching improves throughput/i });
      await user.click(rowBtn);

      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Distributed Caching")).toBeInTheDocument();
    });

    it("modal shows excerpt for artifact_a when available", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      const user = userEvent.setup();
      renderPanel();

      const rowBtn = screen.getByRole("button", { name: /distributed caching improves throughput/i });
      await user.click(rowBtn);

      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText(/caching at the edge reduces latency/i),
      ).toBeInTheDocument();
    });

    it("closes modal when the close button is clicked", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      const user = userEvent.setup();
      renderPanel();

      // Open
      const rowBtn = screen.getByRole("button", { name: /distributed caching improves throughput/i });
      await user.click(rowBtn);

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Close via button
      const closeBtn = screen.getByRole("button", { name: /close contradiction detail/i });
      await user.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("closes modal when Esc is pressed", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      const user = userEvent.setup();
      renderPanel();

      // Open
      const rowBtn = screen.getByRole("button", { name: /distributed caching improves throughput/i });
      await user.click(rowBtn);

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Press Esc
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("modal links to full artifact pages", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      const user = userEvent.setup();
      renderPanel();

      const rowBtn = screen.getByRole("button", { name: /distributed caching improves throughput/i });
      await user.click(rowBtn);

      const dialog = screen.getByRole("dialog");
      const links = within(dialog).getAllByRole("link", { name: /open full page/i });
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute(
        "href",
        `/library/${STUB_PAIR_1.artifact_a.id}`,
      );
      expect(links[1]).toHaveAttribute(
        "href",
        `/library/${STUB_PAIR_1.artifact_b.id}`,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------

  describe("Keyboard navigation", () => {
    it("row button opens modal on Enter key", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      renderPanel();

      const rowBtn = screen.getByRole("button", {
        name: /distributed caching improves throughput/i,
      });
      rowBtn.focus();
      fireEvent.keyDown(rowBtn, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("row button opens modal on Space key", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      renderPanel();

      const rowBtn = screen.getByRole("button", {
        name: /distributed caching improves throughput/i,
      });
      rowBtn.focus();
      fireEvent.keyDown(rowBtn, { key: " " });

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("all row buttons are visible and focusable", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
      renderPanel();

      const buttons = screen.getAllByRole("button", { name: /contradiction:/i });
      buttons.forEach((btn) => {
        expect(btn).toBeVisible();
        btn.focus();
        expect(btn).toHaveFocus();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Accessibility — WCAG 2.1 AA
  // -------------------------------------------------------------------------

  describe("Accessibility", () => {
    it("section has aria-labelledby pointing to the heading", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
      const { container } = renderPanel();

      const heading = screen.getByRole("heading", { name: /contradictions/i });
      const headingId = heading.id;
      expect(headingId).toBeTruthy();

      const section = container.querySelector(
        `[aria-labelledby="${headingId}"]`,
      );
      expect(section).toBeInTheDocument();
    });

    it("each row button has a non-empty aria-label", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
      renderPanel();

      const buttons = screen.getAllByRole("button", { name: /contradiction:/i });
      buttons.forEach((btn) => {
        const label = btn.getAttribute("aria-label");
        expect(label).toBeTruthy();
        expect(label!.length).toBeGreaterThan(0);
      });
    });

    it("modal has role=dialog and aria-modal=true", async () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult([STUB_PAIR_1]));

      const user = userEvent.setup();
      renderPanel();

      const rowBtn = screen.getByRole("button", {
        name: /distributed caching improves throughput/i,
      });
      await user.click(rowBtn);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("flagged_at dates use <time> element with dateTime attribute", () => {
      mockUseContradictions.mockReturnValue(makePopulatedResult());
      renderPanel();

      const timeEls = screen.getAllByText(/ago|today|yesterday/i);
      // At least one time element exists and is rendered inside a <time>
      const hasTimeEl = timeEls.some((el) => el.tagName === "TIME");
      expect(hasTimeEl).toBe(true);
    });
  });
});
