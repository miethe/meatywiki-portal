/**
 * DerivativeCountBadge smoke tests.
 *
 * Covers:
 *   - Count display (singular and plural)
 *   - Link variant (href prop)
 *   - Button variant (onClick prop)
 *   - Span variant (neither href nor onClick)
 *   - Accessibility: aria-label text
 *   - Keyboard focusability for interactive variants
 *   - Focus ring class is present on interactive variants
 *
 * library-source-rollup-v1 FE-07.
 */

import React from "react";
import { renderWithProviders, screen, fireEvent } from "../utils/render";
import { DerivativeCountBadge } from "@/components/ui/derivative-count-badge";

describe("DerivativeCountBadge", () => {
  describe("count display", () => {
    it("renders singular '1 derivative'", () => {
      renderWithProviders(<DerivativeCountBadge count={1} />);
      expect(screen.getByText("1 derivative")).toBeInTheDocument();
    });

    it("renders plural 'N derivatives' for N > 1", () => {
      renderWithProviders(<DerivativeCountBadge count={5} />);
      expect(screen.getByText("5 derivatives")).toBeInTheDocument();
    });

    it("renders plural '0 derivatives' for zero", () => {
      renderWithProviders(<DerivativeCountBadge count={0} />);
      expect(screen.getByText("0 derivatives")).toBeInTheDocument();
    });
  });

  describe("link variant (href prop)", () => {
    it("renders as an anchor when href is provided", () => {
      renderWithProviders(
        <DerivativeCountBadge count={3} href="/artifact/abc#derivatives" />,
      );
      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/artifact/abc#derivatives");
    });

    it("has interactive aria-label when rendered as link", () => {
      renderWithProviders(
        <DerivativeCountBadge count={3} href="/artifact/abc#derivatives" />,
      );
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("aria-label", "3 derivatives, view list");
    });
  });

  describe("button variant (onClick prop)", () => {
    it("renders as a button when onClick is provided", () => {
      renderWithProviders(
        <DerivativeCountBadge count={2} onClick={() => {}} />,
      );
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("calls onClick when the button is clicked", () => {
      const handleClick = jest.fn();
      renderWithProviders(
        <DerivativeCountBadge count={2} onClick={handleClick} />,
      );
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("has interactive aria-label when rendered as button", () => {
      renderWithProviders(
        <DerivativeCountBadge count={1} onClick={() => {}} />,
      );
      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        "1 derivative, view list",
      );
    });
  });

  describe("span variant (non-interactive)", () => {
    it("renders as a plain span when neither href nor onClick provided", () => {
      const { container } = renderWithProviders(
        <DerivativeCountBadge count={4} />,
      );
      // No link or button role — should be a span
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      const span = container.querySelector("span");
      expect(span).toBeInTheDocument();
    });

    it("has informational aria-label (no 'view list' suffix)", () => {
      const { container } = renderWithProviders(
        <DerivativeCountBadge count={4} />,
      );
      const span = container.querySelector("span");
      expect(span).toHaveAttribute("aria-label", "4 derivatives");
    });
  });

  describe("focus ring on interactive variants", () => {
    it("link has focus-visible ring class", () => {
      renderWithProviders(
        <DerivativeCountBadge count={2} href="/artifact/x#derivatives" />,
      );
      const link = screen.getByRole("link");
      expect(link.className).toContain("focus-visible:ring-2");
    });

    it("button has focus-visible ring class", () => {
      renderWithProviders(
        <DerivativeCountBadge count={2} onClick={() => {}} />,
      );
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("focus-visible:ring-2");
    });
  });
});
