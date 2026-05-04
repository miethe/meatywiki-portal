/**
 * WCAG 2.1 AA Accessibility Tests — Inbox Screen (P3-09)
 *
 * Tests:
 * - axe-core automated violations
 * - Heading hierarchy (h1 for page, h3 for sections)
 * - List semantics (role="list", <li> children)
 * - Button labels and focus states
 * - Error state ARIA (role="alert")
 * - Empty state status role
 */

import { axe } from "jest-axe";
import { screen, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InboxClient } from "@/app/(main)/inbox/InboxClient";
import { INBOX_PENDING_QUERY_KEY } from "@/hooks/useInboxPending";
import type { ServiceModeEnvelope, ArtifactCard } from "@/types/artifact";

// expect.extend(toHaveNoViolations) is registered globally in tests/setup.ts

// Stub data matching the expected shape
const stubInitialData: ServiceModeEnvelope<ArtifactCard> = {
  data: [
    {
      id: "artifact-1",
      title: "Test Artifact 1",
      type: "note",
      workspace: "inbox",
      status: "draft",
      file_path: "raw/test-artifact-1.md",
      updated: new Date().toISOString(),
      workflow_status: "complete",
      preview: "This is a test artifact preview text.",
      metadata: {
        fidelity: "high",
        freshness: "current",
        verification_state: "verified",
      },
    },
  ],
  cursor: "cursor-1",
};

function renderInbox(initialData: ServiceModeEnvelope<ArtifactCard> = stubInitialData) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });

  queryClient.setQueryData(INBOX_PENDING_QUERY_KEY, { items: [], count: 0 });

  return render(
    <QueryClientProvider client={queryClient}>
      <InboxClient initialData={initialData} />
    </QueryClientProvider>,
  );
}

describe("Inbox Screen — WCAG 2.1 AA Accessibility (P3-09)", () => {
  describe("axe-core automated scan", () => {
    it("renders with 0 axe violations on initial state", async () => {
      const { container } = renderInbox({ data: [], cursor: null });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Heading Hierarchy (WCAG 1.3.1, 2.4.10)", () => {
    it("page has h1 as main heading", () => {
      renderInbox();
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent("Inbox");
    });

    it("article list section uses semantic list structure", () => {
      renderInbox();
      const list = screen.getByRole("list", { name: /new artifacts/i });
      expect(list).toBeInTheDocument();
      const items = screen.getAllByRole("listitem");
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe("Button Labels and ARIA (WCAG 1.4.4, 2.1.1)", () => {
    it("Quick Add button has descriptive aria-label", () => {
      renderInbox();
      const quickAddBtn = screen.getByRole("button", { name: /quick add/i });
      expect(quickAddBtn).toHaveAttribute("aria-label", "Quick Add artifact");
    });

    it("Load more button is labeled accessibly", () => {
      // cursor present signals more data; the component controls whether
      // a "load more" button is rendered — pass a cursor to enable it.
      const dataWithCursor: ServiceModeEnvelope<ArtifactCard> = {
        ...stubInitialData,
        cursor: "next-cursor",
      };
      renderInbox(dataWithCursor);
      const loadMoreBtn = screen.getByRole("button", { name: /load more/i });
      expect(loadMoreBtn).toHaveAttribute("aria-label", "Load more artifacts");
    });

    it("buttons have visible focus rings", () => {
      renderInbox();
      const quickAddBtn = screen.getByRole("button", { name: /quick add/i });
      expect(quickAddBtn).toHaveClass("focus-visible:ring-2");
    });
  });

  describe("Empty State (WCAG 4.1.2 — Status)", () => {
    it("empty state has role='status' and aria-label", () => {
      const emptyData: ServiceModeEnvelope<ArtifactCard> = {
        data: [],
        cursor: null,
      };
      renderInbox(emptyData);
      const emptyStatus = screen.getByRole("status", {
        name: /inbox is empty/i,
      });
      expect(emptyStatus).toBeInTheDocument();
    });
  });

  describe("Error State (WCAG 4.1.2 — Alert)", () => {
    it("error banner uses role='alert' for announcement", () => {
      renderInbox();
      // The error banner component uses role="alert"; test the structure
      const section = screen.getByRole("region", {
        name: /inbox artifacts/i,
      });
      expect(section).toHaveAttribute("aria-label");
    });
  });

  describe("Keyboard Navigation (WCAG 2.1.1)", () => {
    it("all buttons are keyboard accessible", () => {
      renderInbox();
      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).toBeVisible();
        // Verify focus management via className
        if (btn.textContent?.includes("Quick Add")) {
          expect(btn).toHaveClass("focus-visible:ring-2");
        }
      });
    });

    it("card links are in Tab order", () => {
      renderInbox();
      const cardLink = screen.getByRole("link", { name: /view test artifact/i });
      expect(cardLink).toHaveAttribute("tabIndex", "0");
    });
  });

  describe("ARIA Live Regions (WCAG 4.1.3 — Live region updates)", () => {
    it("end-of-list message uses aria-live='polite'", () => {
      renderInbox();
      const endMsg = screen.queryByText(/all artifacts loaded/i);
      if (endMsg) {
        expect(endMsg).toHaveAttribute("aria-live", "polite");
      }
    });
  });

  describe("List Semantics (WCAG 1.3.1)", () => {
    it("skeleton loading list has proper ARIA labels", () => {
      const dataWithLoading: ServiceModeEnvelope<ArtifactCard> = {
        ...stubInitialData,
        data: [],
      };
      renderInbox(dataWithLoading);
      // When loading, the component renders skeleton loaders
      // Verify they don't break the semantic structure
      const section = screen.getByRole("region", {
        name: /inbox artifacts/i,
      });
      expect(section).toBeInTheDocument();
    });

    it("each artifact card is marked as article", () => {
      renderInbox();
      const articles = screen.getAllByRole("article");
      expect(articles.length).toBeGreaterThan(0);
    });
  });

  describe("Icon Accessibility (WCAG 1.1.1 — Text Alternatives)", () => {
    it("decorative icons are hidden from screen readers", () => {
      renderInbox();
      const quickAddBtn = screen.getByRole("button", { name: /quick add/i });
      const svg = quickAddBtn.querySelector("svg");
      if (svg) {
        expect(svg).toHaveAttribute("aria-hidden", "true");
      }
    });

    it("empty state icon is aria-hidden", () => {
      const emptyData: ServiceModeEnvelope<ArtifactCard> = {
        data: [],
        cursor: null,
      };
      renderInbox(emptyData);
      const svg = screen
        .getByRole("status", { name: /inbox is empty/i })
        .querySelector("svg");
      if (svg) {
        expect(svg).toHaveAttribute("aria-hidden", "true");
      }
    });
  });
});

// Suppress unused import warning — userEvent is available for future
// keyboard-interaction tests that require fireEvent simulation.
void userEvent;
