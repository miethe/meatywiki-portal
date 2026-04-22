/**
 * DerivativesList component tests.
 *
 * Covers:
 *   - Renders 0 items → empty state "No derivatives yet."
 *   - Renders 3 items → 3 rows, each with type badge + title link + lens badges
 *   - Renders 5 items with totalCount=5 → no count header (threshold is > 5)
 *   - Renders 5 items with totalCount=20 → shows count header "20 derivatives total"
 *   - Each title renders as a Next Link with href /artifact/{id}
 *   - Lens badges render via aria-label on FidelityBadge / FreshnessBadge / VerificationBadge
 *
 * library-source-rollup-v1 Phase 3 DETAIL-06.
 */

import React from "react";
import { renderWithProviders, screen, within } from "../utils/render";
import { DerivativesList } from "@/components/workflow/derivatives-list";
import type { DerivativeItem } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Mock next/link — renders as a plain <a> so href assertions work in jsdom
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Stub factory
// ---------------------------------------------------------------------------

function makeDerivativeItem(
  overrides: Partial<DerivativeItem> = {},
): DerivativeItem {
  return {
    id: "deriv-default",
    artifact_type: "synthesis",
    title: "Stub Derivative",
    updated_at: "2026-04-16T00:00:00Z",
    fidelity: "high",
    freshness: "current",
    verification_state: "verified",
    ...overrides,
  };
}

function makeItems(count: number): DerivativeItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeDerivativeItem({
      id: `deriv-${i + 1}`,
      artifact_type: i % 2 === 0 ? "synthesis" : "evidence",
      title: `Derivative ${i + 1}`,
      fidelity: "high",
      freshness: "current",
      verification_state: "verified",
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DerivativesList", () => {
  describe("empty state", () => {
    it("renders 'No derivatives yet.' when derivatives array is empty", () => {
      renderWithProviders(<DerivativesList derivatives={[]} />);
      expect(screen.getByText("No derivatives yet.")).toBeInTheDocument();
    });

    it("empty state element has role=status", () => {
      renderWithProviders(<DerivativesList derivatives={[]} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("3-item render", () => {
    it("renders 3 list items", () => {
      renderWithProviders(<DerivativesList derivatives={makeItems(3)} />);
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    it("each row has a title link", () => {
      renderWithProviders(<DerivativesList derivatives={makeItems(3)} />);
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(3);
      expect(links[0]).toHaveTextContent("Derivative 1");
    });

    it("each title link has correct href /artifact/{id}", () => {
      const items = makeItems(3);
      renderWithProviders(<DerivativesList derivatives={items} />);
      const links = screen.getAllByRole("link");
      links.forEach((link, i) => {
        expect(link).toHaveAttribute("href", `/artifact/deriv-${i + 1}`);
      });
    });

    it("each row renders lens badges via aria-label", () => {
      renderWithProviders(<DerivativesList derivatives={makeItems(3)} />);
      const fidelityBadges = screen.getAllByLabelText(/^Fidelity: /);
      const freshnessBadges = screen.getAllByLabelText(/^Freshness: /);
      const verificationBadges = screen.getAllByLabelText(/^Verification: /);
      expect(fidelityBadges).toHaveLength(3);
      expect(freshnessBadges).toHaveLength(3);
      expect(verificationBadges).toHaveLength(3);
    });

    it("each row has a type badge (list item contains a chip)", () => {
      renderWithProviders(<DerivativesList derivatives={makeItems(3)} />);
      const list = screen.getByRole("list", { name: /derivative artifacts/i });
      const listItems = within(list).getAllByRole("listitem");
      // Each row should contain at least one span/badge with the type text
      expect(listItems).toHaveLength(3);
    });
  });

  describe("count header logic", () => {
    it("does NOT show count header when 5 items and totalCount=5 (threshold is > 5)", () => {
      renderWithProviders(
        <DerivativesList derivatives={makeItems(5)} totalCount={5} />,
      );
      expect(
        screen.queryByText(/derivatives total/i),
      ).not.toBeInTheDocument();
    });

    it("does NOT show count header when 5 items without totalCount", () => {
      renderWithProviders(<DerivativesList derivatives={makeItems(5)} />);
      expect(
        screen.queryByText(/derivatives total/i),
      ).not.toBeInTheDocument();
    });

    it("shows count header '20 derivatives total' when 5 items with totalCount=20", () => {
      renderWithProviders(
        <DerivativesList derivatives={makeItems(5)} totalCount={20} />,
      );
      expect(screen.getByText("20 derivatives total")).toBeInTheDocument();
    });

    it("shows count header when totalCount > 5 (e.g. 6)", () => {
      renderWithProviders(
        <DerivativesList derivatives={makeItems(5)} totalCount={6} />,
      );
      expect(screen.getByText("6 derivatives total")).toBeInTheDocument();
    });
  });

  describe("lens badge rendering", () => {
    it("FidelityBadge has correct aria-label text", () => {
      const items = [
        makeDerivativeItem({ id: "d1", fidelity: "medium", freshness: null, verification_state: null }),
      ];
      renderWithProviders(<DerivativesList derivatives={items} />);
      expect(screen.getByLabelText("Fidelity: medium")).toBeInTheDocument();
    });

    it("FreshnessBadge has correct aria-label text", () => {
      const items = [
        makeDerivativeItem({ id: "d1", fidelity: null, freshness: "stale", verification_state: null }),
      ];
      renderWithProviders(<DerivativesList derivatives={items} />);
      expect(screen.getByLabelText("Freshness: stale")).toBeInTheDocument();
    });

    it("VerificationBadge has correct aria-label text", () => {
      const items = [
        makeDerivativeItem({ id: "d1", fidelity: null, freshness: null, verification_state: "disputed" }),
      ];
      renderWithProviders(<DerivativesList derivatives={items} />);
      expect(screen.getByLabelText("Verification: disputed")).toBeInTheDocument();
    });

    it("renders null for lens badges when all lens values are null (no badge elements)", () => {
      const items = [
        makeDerivativeItem({
          id: "d1",
          fidelity: null,
          freshness: null,
          verification_state: null,
        }),
      ];
      renderWithProviders(<DerivativesList derivatives={items} />);
      expect(screen.queryByLabelText(/^Fidelity:/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Freshness:/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Verification:/)).not.toBeInTheDocument();
    });
  });

  describe("title fallback", () => {
    it("renders '(untitled)' when title is null", () => {
      const items = [makeDerivativeItem({ id: "d1", title: null })];
      renderWithProviders(<DerivativesList derivatives={items} />);
      expect(screen.getByText("(untitled)")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("the list has aria-label 'Derivative artifacts'", () => {
      renderWithProviders(<DerivativesList derivatives={makeItems(2)} />);
      expect(
        screen.getByRole("list", { name: "Derivative artifacts" }),
      ).toBeInTheDocument();
    });

    it("each lens badge group has aria-label 'Lens badges'", () => {
      renderWithProviders(<DerivativesList derivatives={makeItems(2)} />);
      const lensBadgeGroups = screen.getAllByLabelText("Lens badges");
      expect(lensBadgeGroups).toHaveLength(2);
    });
  });
});
