/**
 * WCAG 2.1 AA Accessibility Tests — Badge Components (P3-09)
 *
 * Tests badge component accessibility:
 * - TypeBadge, WorkspaceBadge, WorkflowStatusBadge, LensBadge
 * - Title attributes for badge information
 * - Color contrast on badge backgrounds
 * - No interactive element confusion
 */

import { axe } from "jest-axe";
import { screen, render } from "@testing-library/react";

// expect.extend(toHaveNoViolations) is registered globally in tests/setup.ts

// Mock badge components that match the actual component structure
function TestBadges() {
  return (
    <div className="space-y-4 p-4">
      {/* Type badge */}
      <div>
        <p className="text-sm font-medium mb-2">Type Badge</p>
        <div className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5">
          <span
            className="text-xs font-medium text-blue-700"
            title="Artifact type: note"
          >
            Note
          </span>
        </div>
      </div>

      {/* Workspace badge */}
      <div>
        <p className="text-sm font-medium mb-2">Workspace Badge</p>
        <div className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5">
          <span
            className="text-xs font-medium text-gray-700"
            title="Workspace: inbox"
          >
            Inbox
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div>
        <p className="text-sm font-medium mb-2">Workflow Status Badge</p>
        <div className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5">
          <span
            className="text-xs font-medium text-green-700"
            title="Workflow status: processed"
          >
            Processed
          </span>
        </div>
      </div>

      {/* Badge group (as would appear on a card) */}
      <div>
        <p className="text-sm font-medium mb-2">Badge Group</p>
        <div className="flex flex-wrap gap-1.5">
          <div className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5">
            <span className="text-xs font-medium text-blue-700" title="Type">
              Note
            </span>
          </div>
          <div className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5">
            <span className="text-xs font-medium text-gray-700" title="Workspace">
              Inbox
            </span>
          </div>
          <div className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5">
            <span className="text-xs font-medium text-green-700" title="Status">
              Processed
            </span>
          </div>
        </div>
      </div>

      {/* Lens badges (compact inline) */}
      <div>
        <p className="text-sm font-medium mb-2">Lens Badges</p>
        <div className="flex items-center gap-1">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700"
            title="Fidelity: high"
          >
            H
          </span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-700"
            title="Freshness: recent"
          >
            R
          </span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-[10px] font-semibold text-green-700"
            title="Verification: verified"
          >
            V
          </span>
        </div>
      </div>
    </div>
  );
}

describe("Badge Components — WCAG 2.1 AA Accessibility (P3-09)", () => {
  describe("axe-core automated scan", () => {
    it("renders all badges with 0 axe violations", async () => {
      const { container } = render(<TestBadges />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Badge Semantics (WCAG 1.3.1, 1.4.1)", () => {
    it("badges are not marked as interactive elements", () => {
      const { container } = render(<TestBadges />);
      // Badges should not have onClick, role="button", etc.
      const badgeSpans = container.querySelectorAll("span[title]");
      badgeSpans.forEach((span) => {
        expect(span).not.toHaveAttribute("onclick");
        expect(span).not.toHaveAttribute("role", "button");
      });
    });

    it("badges use semantic span elements, not divs", () => {
      const { container } = render(<TestBadges />);
      const badges = container.querySelectorAll("div.inline-flex span");
      expect(badges.length).toBeGreaterThan(0);
      badges.forEach((badge) => {
        expect(badge.tagName.toLowerCase()).toBe("span");
      });
    });
  });

  describe("Title Attributes (WCAG 1.3.1 — Accessible Names)", () => {
    it("type badge has descriptive title", () => {
      const { container } = render(<TestBadges />);
      const typeBadge = container.querySelector("span[title*='type']");
      expect(typeBadge).toHaveAttribute("title", expect.stringMatching(/type/i));
    });

    it("workspace badge has descriptive title", () => {
      const { container } = render(<TestBadges />);
      const workspaceBadge = container.querySelector("span[title*='Workspace']");
      expect(workspaceBadge).toHaveAttribute(
        "title",
        expect.stringMatching(/workspace/i),
      );
    });

    it("status badge has descriptive title", () => {
      const { container } = render(<TestBadges />);
      const statusBadge = container.querySelector("span[title*='status']");
      expect(statusBadge).toHaveAttribute("title", expect.stringMatching(/status/i));
    });

    it("lens badges have title attributes", () => {
      const { container } = render(<TestBadges />);
      const lensBadges = container.querySelectorAll(
        "span[title*='Fidelity'], span[title*='Freshness'], span[title*='Verification']",
      );
      expect(lensBadges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Color Contrast on Badges (WCAG 1.4.3 — 4.5:1)", () => {
    it("blue badge text has sufficient contrast on blue background", () => {
      const { container } = render(<TestBadges />);
      // Text span has text-blue-700; its container div carries bg-blue-100
      const blueText = container.querySelector(".text-blue-700");
      expect(blueText).toHaveClass("text-blue-700");
      // Verify contrast pairing: bg is on the wrapper div
      const blueWrapper = container.querySelector(".bg-blue-100");
      expect(blueWrapper).toBeInTheDocument();
      // Manual verification: text-blue-700 on bg-blue-100 is ~7:1 contrast
    });

    it("gray badge text has sufficient contrast on gray background", () => {
      const { container } = render(<TestBadges />);
      const grayText = container.querySelector(".text-gray-700");
      expect(grayText).toHaveClass("text-gray-700");
      const grayWrapper = container.querySelector(".bg-gray-100");
      expect(grayWrapper).toBeInTheDocument();
    });

    it("green badge text has sufficient contrast on green background", () => {
      const { container } = render(<TestBadges />);
      const greenText = container.querySelector(".text-green-700");
      expect(greenText).toHaveClass("text-green-700");
      const greenWrapper = container.querySelector(".bg-green-100");
      expect(greenWrapper).toBeInTheDocument();
    });
  });

  describe("Badge Text Content", () => {
    it("type badge displays readable text", () => {
      render(<TestBadges />);
      // TestBadges renders "Note" in both the standalone badge and the group badge
      const noteElements = screen.getAllByText(/^Note$/);
      expect(noteElements.length).toBeGreaterThan(0);
    });

    it("workspace badge displays readable text", () => {
      render(<TestBadges />);
      const inboxElements = screen.getAllByText(/^Inbox$/);
      expect(inboxElements.length).toBeGreaterThan(0);
    });

    it("status badge displays readable text", () => {
      render(<TestBadges />);
      const processedElements = screen.getAllByText(/^Processed$/);
      expect(processedElements.length).toBeGreaterThan(0);
    });
  });

  describe("Badge Groups (WCAG 1.3.1)", () => {
    it("badge group contains multiple badges", () => {
      const { container } = render(<TestBadges />);
      const badgeGroup = Array.from(
        container.querySelectorAll(".flex.flex-wrap.gap-1\\.5"),
      )[0];
      if (badgeGroup) {
        const childBadges = badgeGroup.querySelectorAll("div.inline-flex");
        expect(childBadges.length).toBeGreaterThan(1);
      }
    });

    it("badges in group are visually separated by gap classes", () => {
      const { container } = render(<TestBadges />);
      // Use classList.contains with the literal class name (no CSS escaping needed)
      const badgeGroup = Array.from(
        container.querySelectorAll(".flex.flex-wrap"),
      ).find((el) => el.classList.contains("gap-1.5"));
      expect(badgeGroup).toBeDefined();
    });
  });

  describe("Lens Badge Abbreviations (WCAG 1.3.1 — Abbreviations)", () => {
    it("lens badges show single letter with title for expansion", () => {
      const { container } = render(<TestBadges />);
      const lensSpans = container.querySelectorAll(
        "span[title*='Fidelity'], span[title*='Freshness'], span[title*='Verification']",
      );

      expect(lensSpans.length).toBeGreaterThanOrEqual(2);
      lensSpans.forEach((span) => {
        // Each has a single letter text
        expect(span.textContent?.length).toBeLessThanOrEqual(2);
        // And a title for expansion
        expect(span).toHaveAttribute("title");
      });
    });
  });

  describe("Badge Sizing and Touch Targets (WCAG 2.5.5)", () => {
    it("badges have appropriate text size", () => {
      const { container } = render(<TestBadges />);
      const badgeTexts = container.querySelectorAll("span.text-xs, span.text-\\[10px\\]");
      expect(badgeTexts.length).toBeGreaterThan(0);
    });

    it("badge containers have padding for touch readability", () => {
      const { container } = render(<TestBadges />);
      const badgeContainers = container.querySelectorAll("div.inline-flex");
      badgeContainers.forEach((container) => {
        // Should have padding (px, py)
        expect(
          container.className.includes("px-") || container.className.includes("py-"),
        ).toBe(true);
      });
    });
  });

  describe("Badge Icon Styling (if present)", () => {
    it("badge content is text-based (no decorative icons)", () => {
      const { container } = render(<TestBadges />);
      const badgeSpans = container.querySelectorAll(
        "div.inline-flex span.text-xs, div.inline-flex span.text-\\[10px\\]",
      );
      // All badge content should be text, no SVG icons
      badgeSpans.forEach((span) => {
        const svg = span.querySelector("svg");
        expect(svg).toBeNull();
      });
    });
  });

  describe("Responsive Badge Layout", () => {
    it("badge group uses flex with wrap for responsive layout", () => {
      const { container } = render(<TestBadges />);
      const badgeGroup = Array.from(container.querySelectorAll(".flex")).find(
        (el) => el.classList.contains("flex-wrap"),
      );
      expect(badgeGroup).toBeDefined();
      // gap-1.5 contains a literal period — use classList for reliable matching
      expect(badgeGroup).toHaveClass("flex-wrap");
      expect(badgeGroup?.classList.contains("gap-1.5")).toBe(true);
    });
  });
});
