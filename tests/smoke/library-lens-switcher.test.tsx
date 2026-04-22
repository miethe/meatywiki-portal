/**
 * LibraryLensSwitcher smoke tests.
 *
 * Covers:
 *   - All 8 lenses are rendered
 *   - Clicking a lens calls onLensChange with the correct value
 *   - Active lens has aria-pressed=true; others are false
 *   - Orphans chip has help text (title attribute + visually-hidden description)
 *   - Keyboard: buttons are accessible (focusable, have labels)
 *
 * library-source-rollup-v1 FE-07.
 */

import React from "react";
import { renderWithProviders, screen, fireEvent } from "../utils/render";
import { LibraryLensSwitcher } from "@/components/ui/library-lens-switcher";
import type { LibraryLens } from "@/components/ui/library-lens-switcher";

const ALL_LENSES: LibraryLens[] = [
  "default",
  "concepts",
  "entities",
  "syntheses",
  "evidence",
  "contradictions",
  "glossary",
  "orphans",
];

describe("LibraryLensSwitcher", () => {
  describe("rendering", () => {
    it("renders all 8 lens buttons", () => {
      renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={jest.fn()} />,
      );
      // The group has a 'Lens' label header + 8 buttons
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(8);
    });

    it("has role='group' with aria-label 'Library lens'", () => {
      renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={jest.fn()} />,
      );
      expect(screen.getByRole("group", { name: /library lens/i })).toBeInTheDocument();
    });
  });

  describe("active lens aria-pressed", () => {
    it.each(ALL_LENSES)(
      "lens=%s: that button has aria-pressed=true, others are false",
      (activeLens) => {
        renderWithProviders(
          <LibraryLensSwitcher lens={activeLens} onLensChange={jest.fn()} />,
        );
        const allButtons = screen.getAllByRole("button");
        const pressedButtons = allButtons.filter(
          (btn) => btn.getAttribute("aria-pressed") === "true",
        );
        expect(pressedButtons).toHaveLength(1);
        // The pressed button should have aria-label containing the lens name
        expect(pressedButtons[0]).toBeInTheDocument();
      },
    );

    it("default lens button has aria-pressed=true by default", () => {
      renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={jest.fn()} />,
      );
      const defaultBtn = screen.getByRole("button", { name: /all sources lens/i });
      expect(defaultBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("non-active buttons have aria-pressed=false", () => {
      renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={jest.fn()} />,
      );
      const conceptsBtn = screen.getByRole("button", { name: /concepts lens/i });
      expect(conceptsBtn).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("onLensChange", () => {
    it("calls onLensChange with 'concepts' when Concepts is clicked", () => {
      const onChange = jest.fn();
      renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={onChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /concepts lens/i }));
      expect(onChange).toHaveBeenCalledWith("concepts");
    });

    it("calls onLensChange with 'orphans' when Orphans is clicked", () => {
      const onChange = jest.fn();
      renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={onChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /orphans lens/i }));
      expect(onChange).toHaveBeenCalledWith("orphans");
    });

    it("calls onLensChange with 'default' when All Sources is clicked", () => {
      const onChange = jest.fn();
      renderWithProviders(
        <LibraryLensSwitcher lens="concepts" onLensChange={onChange} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /all sources lens/i }));
      expect(onChange).toHaveBeenCalledWith("default");
    });
  });

  describe("Orphans help text", () => {
    it("Orphans button has a title attribute with help text", () => {
      renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={jest.fn()} />,
      );
      const orphansBtn = screen.getByRole("button", { name: /orphans lens/i });
      expect(orphansBtn).toHaveAttribute(
        "title",
        expect.stringContaining("Derivatives with no resolvable source"),
      );
    });

    it("Orphans button has a visually-hidden description in sr-only span", () => {
      const { container } = renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={jest.fn()} />,
      );
      const srOnly = container.querySelector(".sr-only");
      expect(srOnly).toBeInTheDocument();
      expect(srOnly?.textContent).toContain("Derivatives with no resolvable source");
    });
  });

  describe("keyboard accessibility", () => {
    it("all buttons are visible and accessible", () => {
      renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={jest.fn()} />,
      );
      const buttons = screen.getAllByRole("button");
      for (const btn of buttons) {
        expect(btn).toBeVisible();
        expect(btn).toHaveAttribute("aria-label");
      }
    });

    it("buttons have focus-visible ring class", () => {
      renderWithProviders(
        <LibraryLensSwitcher lens="default" onLensChange={jest.fn()} />,
      );
      const buttons = screen.getAllByRole("button");
      for (const btn of buttons) {
        expect(btn.className).toContain("focus-visible:ring-2");
      }
    });
  });
});
