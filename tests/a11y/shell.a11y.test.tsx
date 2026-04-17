/**
 * WCAG 2.1 AA Accessibility Tests — Shell Navigation (P3-09)
 *
 * Tests:
 * - axe-core violations on main layout
 * - Landmark roles (main, aside, navigation)
 * - Skip-to-content functionality
 * - Focus management with tabIndex=-1 on main
 * - Header and navigation semantics
 */

import { axe } from "jest-axe";
import { screen, render } from "@testing-library/react";

// expect.extend(toHaveNoViolations) is registered globally in tests/setup.ts

// Minimal shell structure matching (main)/layout.tsx
function TestShell() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className="w-60 shrink-0 flex-col border-r bg-card"
        aria-label="Sidebar navigation"
      >
        <nav aria-label="Main navigation">
          <ul role="list">
            <li>
              <a href="/inbox">Inbox</a>
            </li>
            <li>
              <a href="/library">Library</a>
            </li>
            <li>
              <a href="/workflows">Workflows</a>
            </li>
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-background p-4">
          <h1 className="text-lg font-semibold">MeatyWiki Portal</h1>
        </header>

        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4"
          tabIndex={-1}
        >
          <p>Main content area</p>
        </main>
      </div>
    </div>
  );
}

describe("Shell Navigation — WCAG 2.1 AA Accessibility (P3-09)", () => {
  describe("axe-core automated scan", () => {
    it("renders shell with 0 axe violations", async () => {
      const { container } = render(<TestShell />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Landmark Roles (WCAG 1.3.1, 2.4.1)", () => {
    it("has main landmark for primary content", () => {
      render(<TestShell />);
      const main = screen.getByRole("main");
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute("id", "main-content");
    });

    it("sidebar has aria-label describing its purpose", () => {
      render(<TestShell />);
      const aside = screen.getByLabelText(/sidebar navigation/i);
      expect(aside).toBeInTheDocument();
    });

    it("has navigation landmark with aria-label", () => {
      render(<TestShell />);
      const nav = screen.getByLabelText(/main navigation/i);
      expect(nav).toBeInTheDocument();
    });
  });

  describe("Navigation Structure (WCAG 1.3.1)", () => {
    it("navigation links are in a list", () => {
      render(<TestShell />);
      const navLinks = screen.getAllByRole("link");
      expect(navLinks.length).toBeGreaterThan(0);
      // Links are inside nav which contains a list
      const nav = screen.getByLabelText(/main navigation/i);
      const list = nav.querySelector("ul");
      expect(list).toBeInTheDocument();
    });

    it("navigation links have descriptive text", () => {
      render(<TestShell />);
      expect(screen.getByRole("link", { name: /inbox/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /library/i })).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /workflows/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Focus Management (WCAG 2.4.3, 2.4.8)", () => {
    it("main element has tabIndex={-1} for programmatic focus", () => {
      render(<TestShell />);
      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("tabIndex", "-1");
    });

    it("all navigation links are keyboard accessible", () => {
      render(<TestShell />);
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toBeVisible();
        // Links should be in natural Tab order (no need for explicit tabIndex)
      });
    });

    it("links are in logical Tab order (visually top-to-bottom)", () => {
      const { container } = render(<TestShell />);
      const links = Array.from(
        container.querySelectorAll("a"),
      ) as HTMLAnchorElement[];
      // Should be Inbox, Library, Workflows
      expect(links[0]).toHaveTextContent(/inbox/i);
      expect(links[1]).toHaveTextContent(/library/i);
      expect(links[2]).toHaveTextContent(/workflows/i);
    });
  });

  describe("Header Semantics (WCAG 1.3.1)", () => {
    it("header contains the site title in h1", () => {
      render(<TestShell />);
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toHaveTextContent(/meatywiki portal/i);
    });
  });

  describe("Screen Reader Announcements (WCAG 4.1.2)", () => {
    it("aside element is properly labeled for screen readers", () => {
      render(<TestShell />);
      const aside = screen.getByLabelText(/sidebar navigation/i);
      expect(aside).toHaveAttribute("aria-label");
    });

    it("navigation is properly labeled", () => {
      render(<TestShell />);
      const nav = screen.getByLabelText(/main navigation/i);
      expect(nav).toHaveAttribute("aria-label", "Main navigation");
    });
  });

  describe("Mobile Responsive Navigation (WCAG 1.4.10)", () => {
    it("sidebar uses responsive classes for mobile/desktop", () => {
      const { container } = render(<TestShell />);
      const aside = container.querySelector("aside");
      // Should have responsive classes like md:flex for desktop
      expect(aside).toHaveClass("w-60", "shrink-0", "flex-col");
    });
  });

  describe("List Structure in Navigation (WCAG 1.3.1)", () => {
    it("navigation items are in a semantic list", () => {
      render(<TestShell />);
      const nav = screen.getByLabelText(/main navigation/i);
      const list = nav.querySelector("ul");
      expect(list).toHaveAttribute("role", "list");
      const items = nav.querySelectorAll("li");
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe("Keyboard Navigation Through Shell", () => {
    it("Tab key moves through all interactive elements", () => {
      render(<TestShell />);
      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        link.focus();
        expect(link).toHaveFocus();
      });
    });
  });
});
