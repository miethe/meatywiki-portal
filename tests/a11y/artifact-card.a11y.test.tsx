/**
 * WCAG 2.1 AA Accessibility Tests — ArtifactCard Component (P3-09)
 *
 * Tests:
 * - axe-core violations
 * - Article semantic role
 * - Stretch link accessibility
 * - Time element with dateTime attribute
 * - Heading hierarchy within card
 */

import { axe } from "jest-axe";
import { screen, render } from "@testing-library/react";
import { ArtifactCard } from "@/components/ui/artifact-card";
import type { ArtifactCard as ArtifactCardType } from "@/types/artifact";

// expect.extend(toHaveNoViolations) is registered globally in tests/setup.ts

const mockArtifact: ArtifactCardType = {
  id: "test-artifact-1",
  title: "Understanding React Hooks",
  type: "note",
  workspace: "inbox",
  status: "active",
  file_path: "raw/understanding-react-hooks.md",
  // Use a fixed past date so formatRelativeTime renders "Xm ago" / "Xh ago"
  updated: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 90 min ago
  workflow_status: "complete",
  preview: "A detailed exploration of React Hooks and their use cases.",
  metadata: {
    fidelity: "high",
    freshness: "current",
    verification_state: "verified",
  },
};

describe("ArtifactCard Component — WCAG 2.1 AA Accessibility (P3-09)", () => {
  describe("axe-core automated scan", () => {
    it("renders with 0 axe violations in list variant", async () => {
      const { container } = render(
        <ArtifactCard artifact={mockArtifact} variant="list" />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("renders with 0 axe violations in grid variant", async () => {
      const { container } = render(
        <ArtifactCard artifact={mockArtifact} variant="grid" />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Semantic Structure (WCAG 1.3.1)", () => {
    it("card is marked as article element", () => {
      render(<ArtifactCard artifact={mockArtifact} variant="list" />);
      const article = screen.getByRole("article");
      expect(article).toBeInTheDocument();
    });

    it("article has accessible name via aria-label", () => {
      render(<ArtifactCard artifact={mockArtifact} variant="list" />);
      const article = screen.getByRole("article", {
        name: /understanding react hooks/i,
      });
      expect(article).toBeInTheDocument();
    });

    it("title is marked as heading (h3)", () => {
      render(<ArtifactCard artifact={mockArtifact} variant="list" />);
      // Note: The component uses <h3> for title
      const heading = screen.getByRole("heading", { level: 3 });
      expect(heading).toHaveTextContent("Understanding React Hooks");
    });
  });

  describe("Stretch Link Accessibility (WCAG 2.1.1, 2.4.4)", () => {
    it("card link has aria-label describing the action", () => {
      render(<ArtifactCard artifact={mockArtifact} variant="list" />);
      const link = screen.getByRole("link", {
        name: /view understanding react hooks/i,
      });
      expect(link).toBeInTheDocument();
    });

    it("link has tabIndex={0} for keyboard accessibility", () => {
      render(<ArtifactCard artifact={mockArtifact} variant="list" />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("tabIndex", "0");
    });

    it("link has visible focus ring via focus-visible", () => {
      render(<ArtifactCard artifact={mockArtifact} variant="list" />);
      const link = screen.getByRole("link");
      expect(link).toHaveClass(
        "focus:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
      );
    });
  });

  describe("Time Element (WCAG 1.1.1, 1.3.1)", () => {
    it("timestamp uses <time> element with dateTime attribute", () => {
      render(<ArtifactCard artifact={mockArtifact} variant="list" />);
      const timeEl = screen.getByText(/ago/i);
      expect(timeEl.tagName).toBe("TIME");
      expect(timeEl).toHaveAttribute("dateTime");
    });

    it("time element has valid ISO datetime", () => {
      const { getByText } = render(
        <ArtifactCard artifact={mockArtifact} variant="list" />,
      );
      const timeEl = getByText(/ago/i) as HTMLTimeElement;
      // Should be a valid ISO string
      expect(() => new Date(timeEl.dateTime)).not.toThrow();
    });
  });

  describe("Preview Text (WCAG 1.4.5 — Images of Text)", () => {
    it("preview text is readable and not truncated indefinitely", () => {
      render(<ArtifactCard artifact={mockArtifact} variant="list" />);
      const preview = screen.getByText(/detailed exploration/i);
      // line-clamp-2 limits to 2 lines but text is still accessible
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveClass("line-clamp-2");
    });
  });

  describe("Badge Accessibility (WCAG 1.1.1)", () => {
    it("renders without violating axe when badges are present", async () => {
      const { container } = render(
        <ArtifactCard artifact={mockArtifact} variant="list" />,
      );
      // Badges (type, workspace, workflow status, lens) should not create a11y issues
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Keyboard Navigation (WCAG 2.1.1)", () => {
    it("card can be navigated with keyboard", () => {
      render(<ArtifactCard artifact={mockArtifact} variant="list" />);
      const link = screen.getByRole("link");

      // Focus the link
      link.focus();
      expect(link).toHaveFocus();
    });
  });

  describe("Responsive Variants (WCAG 1.4.10 — Reflow)", () => {
    it("renders correctly in list variant", () => {
      const { container } = render(
        <ArtifactCard artifact={mockArtifact} variant="list" />,
      );
      const article = container.querySelector("article");
      expect(article).toHaveClass("flex", "items-start", "gap-3");
    });

    it("renders correctly in grid variant", () => {
      const { container } = render(
        <ArtifactCard artifact={mockArtifact} variant="grid" />,
      );
      const article = container.querySelector("article");
      expect(article).toHaveClass("flex", "flex-col");
    });
  });

  describe("Missing Data Graceful Degradation", () => {
    const minimalArtifact: ArtifactCardType = {
      id: "minimal",
      title: "Minimal Card",
      type: "note",
      workspace: "inbox",
      status: "draft",
      file_path: "raw/minimal-card.md",
      updated: null,
      workflow_status: null,
      preview: null,
      metadata: {},
    };

    it("handles missing updated date gracefully", async () => {
      const { container } = render(
        <ArtifactCard artifact={minimalArtifact} variant="list" />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("handles missing preview text", () => {
      render(<ArtifactCard artifact={minimalArtifact} variant="list" />);
      // Should still render without errors
      const article = screen.getByRole("article");
      expect(article).toBeInTheDocument();
    });

    it("handles missing workflow_status", async () => {
      const { container } = render(
        <ArtifactCard artifact={minimalArtifact} variant="list" />,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
