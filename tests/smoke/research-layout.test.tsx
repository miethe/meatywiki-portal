/**
 * Research workspace layout + sub-nav smoke tests (P4-01).
 *
 * Validates:
 *   - Sub-nav renders all four tabs: Pages, Synthesis, Backlinks, Queue
 *   - Each tab has the correct href
 *   - Active link receives aria-current="page" for the matching pathname
 *   - Inactive links do NOT have aria-current
 *   - Navigation landmark is labelled "Research workspace navigation"
 *   - Sub-nav is keyboard accessible (all links are in the DOM and visible)
 *   - Placeholder pages render without errors (Synthesis, Backlinks, Queue)
 *
 * Uses usePathname mock so the client component renders in jsdom without a
 * Next.js router context.
 */

import React from "react";
import { render, screen, within } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock next/navigation — ResearchLayout uses usePathname
// ---------------------------------------------------------------------------

const mockPathname = jest.fn(() => "/research/pages");

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  redirect: jest.fn(),
}));

// Mock next/link — renders as a plain <a> in jsdom
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
// Import component under test after mocks are registered
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first
import ResearchLayout from "@/app/(main)/research/layout";
import SynthesisPage from "@/app/(main)/research/synthesis/page";
import BacklinksPage from "@/app/(main)/research/backlinks/page";
import QueuePage from "@/app/(main)/research/queue/page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLayout(pathname = "/research/pages") {
  mockPathname.mockReturnValue(pathname);
  return render(
    <ResearchLayout>
      <div data-testid="page-content">Page content</div>
    </ResearchLayout>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Research workspace layout (P4-01)", () => {
  afterEach(() => {
    mockPathname.mockReturnValue("/research/pages");
  });

  describe("Sub-navigation structure", () => {
    it("renders a nav landmark labelled 'Research workspace navigation'", () => {
      renderLayout();
      const nav = screen.getByRole("navigation", {
        name: /research workspace navigation/i,
      });
      expect(nav).toBeInTheDocument();
    });

    it("renders all four sub-nav tabs", () => {
      renderLayout();
      expect(screen.getByRole("link", { name: /research pages/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /synthesis builder/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /backlinks explorer/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /review queue/i })).toBeInTheDocument();
    });

    it("each tab links to the correct sub-route", () => {
      renderLayout();
      expect(screen.getByRole("link", { name: /research pages/i })).toHaveAttribute(
        "href",
        "/research/pages",
      );
      expect(screen.getByRole("link", { name: /synthesis builder/i })).toHaveAttribute(
        "href",
        "/research/synthesis",
      );
      expect(screen.getByRole("link", { name: /backlinks explorer/i })).toHaveAttribute(
        "href",
        "/research/backlinks",
      );
      expect(screen.getByRole("link", { name: /review queue/i })).toHaveAttribute(
        "href",
        "/research/queue",
      );
    });

    it("renders nav items in a semantic list", () => {
      renderLayout();
      const nav = screen.getByRole("navigation", {
        name: /research workspace navigation/i,
      });
      const list = nav.querySelector("ul");
      expect(list).toBeInTheDocument();
      const items = list?.querySelectorAll("li");
      expect(items?.length).toBe(4);
    });

    it("renders page content in the layout slot", () => {
      renderLayout();
      expect(screen.getByTestId("page-content")).toBeInTheDocument();
    });
  });

  describe("Active link state", () => {
    it("marks /research/pages link as active when pathname matches", () => {
      renderLayout("/research/pages");
      const pagesLink = screen.getByRole("link", { name: /research pages/i });
      expect(pagesLink).toHaveAttribute("aria-current", "page");
    });

    it("does NOT mark other links as active on /research/pages", () => {
      renderLayout("/research/pages");
      expect(
        screen.getByRole("link", { name: /synthesis builder/i }),
      ).not.toHaveAttribute("aria-current");
      expect(
        screen.getByRole("link", { name: /backlinks explorer/i }),
      ).not.toHaveAttribute("aria-current");
      expect(
        screen.getByRole("link", { name: /review queue/i }),
      ).not.toHaveAttribute("aria-current");
    });

    it("marks /research/synthesis link as active when pathname matches", () => {
      renderLayout("/research/synthesis");
      const synthLink = screen.getByRole("link", { name: /synthesis builder/i });
      expect(synthLink).toHaveAttribute("aria-current", "page");
    });

    it("marks /research/backlinks link as active when pathname matches", () => {
      renderLayout("/research/backlinks");
      const backlinksLink = screen.getByRole("link", { name: /backlinks explorer/i });
      expect(backlinksLink).toHaveAttribute("aria-current", "page");
    });

    it("marks /research/queue link as active when pathname matches", () => {
      renderLayout("/research/queue");
      const queueLink = screen.getByRole("link", { name: /review queue/i });
      expect(queueLink).toHaveAttribute("aria-current", "page");
    });
  });

  describe("Keyboard accessibility", () => {
    it("all sub-nav links are visible and focusable", () => {
      renderLayout();
      const nav = screen.getByRole("navigation", {
        name: /research workspace navigation/i,
      });
      const links = within(nav).getAllByRole("link");
      expect(links).toHaveLength(4);
      links.forEach((link) => {
        expect(link).toBeVisible();
        link.focus();
        expect(link).toHaveFocus();
      });
    });

    it("links are in logical DOM order: Pages → Synthesis → Backlinks → Queue", () => {
      const { container } = renderLayout();
      const nav = container.querySelector(
        "nav[aria-label='Research workspace navigation']",
      );
      const links = Array.from(nav?.querySelectorAll("a") ?? []) as HTMLAnchorElement[];
      expect(links[0]).toHaveAttribute("href", "/research/pages");
      expect(links[1]).toHaveAttribute("href", "/research/synthesis");
      expect(links[2]).toHaveAttribute("href", "/research/backlinks");
      expect(links[3]).toHaveAttribute("href", "/research/queue");
    });
  });
});

// ---------------------------------------------------------------------------
// Placeholder page smoke tests
// ---------------------------------------------------------------------------

describe("Research placeholder pages (P4-01)", () => {
  it("Synthesis placeholder renders heading and 'Coming in P4-02' message", () => {
    render(<SynthesisPage />);
    expect(
      screen.getByRole("heading", { name: /synthesis builder/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/coming in p4-02/i)).toBeInTheDocument();
  });

  it("Synthesis placeholder has accessible status region", () => {
    render(<SynthesisPage />);
    expect(
      screen.getByRole("status", { name: /synthesis builder coming soon/i }),
    ).toBeInTheDocument();
  });

  it("Backlinks placeholder renders heading and 'Coming in P4-03' message", () => {
    render(<BacklinksPage />);
    expect(
      screen.getByRole("heading", { name: /backlinks/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/coming in p4-03/i)).toBeInTheDocument();
  });

  it("Backlinks placeholder has accessible status region", () => {
    render(<BacklinksPage />);
    expect(
      screen.getByRole("status", { name: /backlinks explorer coming soon/i }),
    ).toBeInTheDocument();
  });

  it("Queue placeholder renders heading and 'Coming in P4-05' message", () => {
    render(<QueuePage />);
    expect(
      screen.getByRole("heading", { name: /review queue/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/coming in p4-05/i)).toBeInTheDocument();
  });

  it("Queue placeholder has accessible status region", () => {
    render(<QueuePage />);
    expect(
      screen.getByRole("status", { name: /review queue coming soon/i }),
    ).toBeInTheDocument();
  });
});
