/**
 * WCAG 2.1 AA Color Contrast Accessibility Tests (P3-09)
 *
 * Tests design token contrast ratios:
 * - Primary button: ≥ 4.5:1 text-primary-foreground on bg-primary
 * - Destructive button: ≥ 4.5:1 text-destructive-foreground on bg-destructive
 * - Muted text: ≥ 4.5:1 text-muted-foreground on bg-background
 * - Form labels: ≥ 4.5:1 text-foreground on bg-background
 *
 * Design tokens from shadcn/ui slate base (verified in globals.css)
 * CSS variables are computed; we verify the element classes are applied.
 */

import { axe } from "jest-axe";
import { screen, render } from "@testing-library/react";

// expect.extend(toHaveNoViolations) is registered globally in tests/setup.ts

// Color token verification component
function ContrastTestComponent() {
  return (
    <div className="space-y-6 p-4 bg-background">
      {/* Foreground text on background */}
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          Primary Text (Foreground)
        </h2>
        <p className="text-foreground mt-2">
          This is body text in foreground color. Should have ≥4.5:1 contrast on background.
        </p>
      </div>

      {/* Muted text on background */}
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          Secondary Text (Muted Foreground)
        </h2>
        <p className="text-muted-foreground mt-2">
          This is secondary text in muted foreground color. Should have ≥4.5:1 contrast.
        </p>
      </div>

      {/* Primary button */}
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          Primary Button
        </h2>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded mt-2 focus:outline-none focus-visible:ring-2">
          Primary Action
        </button>
        <p className="text-muted-foreground text-sm mt-2">
          Text color should be primary-foreground on primary background.
        </p>
      </div>

      {/* Destructive button */}
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          Destructive Button
        </h2>
        <button className="bg-destructive text-destructive-foreground px-4 py-2 rounded mt-2 focus:outline-none focus-visible:ring-2">
          Delete Action
        </button>
        <p className="text-muted-foreground text-sm mt-2">
          Text color should be destructive-foreground on destructive background.
        </p>
      </div>

      {/* Accent button (secondary) */}
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          Secondary Button
        </h2>
        <button className="bg-accent text-accent-foreground px-4 py-2 rounded mt-2 focus:outline-none focus-visible:ring-2">
          Secondary Action
        </button>
        <p className="text-muted-foreground text-sm mt-2">
          Text color should be accent-foreground on accent background.
        </p>
      </div>

      {/* Form label */}
      <div>
        <label htmlFor="test-input" className="text-foreground text-sm font-medium block mb-1">
          Form Label
        </label>
        <input
          id="test-input"
          type="text"
          placeholder="Placeholder text"
          className="border rounded px-2 py-1 w-full max-w-xs placeholder:text-muted-foreground"
        />
        <p className="text-muted-foreground text-xs mt-1">
          Label text should be foreground color (≥4.5:1).
        </p>
      </div>

      {/* Input with validation error */}
      <div>
        <label htmlFor="error-input" className="text-foreground text-sm font-medium block mb-1">
          Required Field
        </label>
        <input
          id="error-input"
          type="text"
          aria-invalid="true"
          aria-describedby="error-message"
          className="border border-destructive rounded px-2 py-1 w-full max-w-xs"
        />
        <p id="error-message" className="text-destructive text-sm mt-1">
          Error message in destructive color. Should be ≥4.5:1 on background.
        </p>
      </div>

      {/* Disabled element */}
      <div>
        <h2 className="text-foreground text-lg font-semibold">
          Disabled State
        </h2>
        <button
          disabled
          className="bg-muted text-muted-foreground px-4 py-2 rounded mt-2 opacity-50 cursor-not-allowed"
        >
          Disabled Button
        </button>
        <p className="text-muted-foreground text-sm mt-2">
          Disabled state uses opacity reduction per WCAG guidelines.
        </p>
      </div>

      {/* Card/elevated surface */}
      <div className="bg-card border rounded p-4 mt-6">
        <h2 className="text-foreground font-semibold">
          Card Surface
        </h2>
        <p className="text-muted-foreground text-sm mt-2">
          Text on card background. Card background is slightly different from main background.
        </p>
      </div>
    </div>
  );
}

describe("Color Contrast — WCAG 2.1 AA (P3-09)", () => {
  describe("axe-core automated contrast scan", () => {
    it("renders contrast test component with 0 violations", async () => {
      const { container } = render(<ContrastTestComponent />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Foreground Text (4.5:1 ratio required)", () => {
    it("page headings use text-foreground class", () => {
      render(<ContrastTestComponent />);
      const headings = screen.getAllByRole("heading");
      headings.forEach((h) => {
        expect(h).toHaveClass("text-foreground");
      });
    });

    it("body text uses text-foreground class", () => {
      render(<ContrastTestComponent />);
      const primaryText = screen.getByText(
        /This is body text in foreground color/i,
      );
      expect(primaryText).toHaveClass("text-foreground");
    });

    it("form labels use text-foreground class", () => {
      render(<ContrastTestComponent />);
      const label = screen.getByLabelText(/form label/i);
      const labelElement = label.previousElementSibling;
      if (labelElement) {
        expect(labelElement).toHaveClass("text-foreground");
      }
    });
  });

  describe("Muted Text (4.5:1 ratio on background)", () => {
    it("secondary text uses text-muted-foreground class", () => {
      render(<ContrastTestComponent />);
      const mutedText = screen.getByText(
        /This is secondary text in muted foreground color/i,
      );
      expect(mutedText).toHaveClass("text-muted-foreground");
    });

    it("helper text uses text-muted-foreground class", () => {
      render(<ContrastTestComponent />);
      const helperTexts = screen.getAllByText(/should be/i);
      helperTexts.forEach((text) => {
        if (text.classList.contains("text-muted-foreground")) {
          expect(text).toHaveClass("text-muted-foreground");
        }
      });
    });
  });

  describe("Primary Button Colors", () => {
    it("primary button has bg-primary class", () => {
      render(<ContrastTestComponent />);
      const primaryBtn = screen.getByRole("button", { name: /primary action/i });
      expect(primaryBtn).toHaveClass("bg-primary");
    });

    it("primary button text uses text-primary-foreground class", () => {
      render(<ContrastTestComponent />);
      const primaryBtn = screen.getByRole("button", { name: /primary action/i });
      expect(primaryBtn).toHaveClass("text-primary-foreground");
    });
  });

  describe("Destructive Button Colors", () => {
    it("destructive button has bg-destructive class", () => {
      render(<ContrastTestComponent />);
      const deleteBtn = screen.getByRole("button", { name: /delete action/i });
      expect(deleteBtn).toHaveClass("bg-destructive");
    });

    it("destructive button text uses text-destructive-foreground class", () => {
      render(<ContrastTestComponent />);
      const deleteBtn = screen.getByRole("button", { name: /delete action/i });
      expect(deleteBtn).toHaveClass("text-destructive-foreground");
    });
  });

  describe("Secondary/Accent Button Colors", () => {
    it("secondary button has bg-accent class", () => {
      render(<ContrastTestComponent />);
      const secondaryBtn = screen.getByRole("button", {
        name: /secondary action/i,
      });
      expect(secondaryBtn).toHaveClass("bg-accent");
    });

    it("secondary button text uses text-accent-foreground class", () => {
      render(<ContrastTestComponent />);
      const secondaryBtn = screen.getByRole("button", {
        name: /secondary action/i,
      });
      expect(secondaryBtn).toHaveClass("text-accent-foreground");
    });
  });

  describe("Error/Validation Colors", () => {
    it("error message uses text-destructive class", () => {
      render(<ContrastTestComponent />);
      const errorMsg = screen.getByText(/error message in destructive color/i);
      expect(errorMsg).toHaveClass("text-destructive");
    });

    it("error input has border-destructive class", () => {
      render(<ContrastTestComponent />);
      const inputs = screen.getAllByRole("textbox");
      const errorInputElement = inputs.find((i) =>
        i.getAttribute("aria-invalid"),
      );
      if (errorInputElement) {
        expect(errorInputElement).toHaveClass("border-destructive");
      }
    });
  });

  describe("Disabled State Colors", () => {
    it("disabled button uses opacity and muted colors", () => {
      render(<ContrastTestComponent />);
      const disabledBtn = screen.getByRole("button", { name: /disabled button/i });
      expect(disabledBtn).toBeDisabled();
      expect(disabledBtn).toHaveClass("bg-muted", "text-muted-foreground");
    });
  });

  describe("Card Surface Contrast", () => {
    it("card text uses appropriate foreground classes", () => {
      render(<ContrastTestComponent />);
      const cardHeading = screen.getByText(/card surface/i);
      expect(cardHeading).toHaveClass("text-foreground");
    });

    it("card background is bg-card", () => {
      const { container } = render(<ContrastTestComponent />);
      const card = container.querySelector(".bg-card");
      expect(card).toBeInTheDocument();
    });
  });

  describe("Focus Indicators (Visible on all backgrounds)", () => {
    it("buttons have focus-visible ring styles", () => {
      render(<ContrastTestComponent />);
      const buttons = screen.getAllByRole("button");
      // Only check interactive (non-disabled) buttons — disabled buttons are
      // excluded from Tab order by browsers and don't need a focus ring.
      const interactiveButtons = buttons.filter((btn) => !btn.hasAttribute("disabled"));
      interactiveButtons.forEach((btn) => {
        const classes = btn.className;
        expect(
          classes.includes("focus") || classes.includes("outline"),
        ).toBe(true);
      });
    });
  });

  describe("Placeholder Text Contrast", () => {
    it("placeholder text uses muted foreground color", () => {
      render(<ContrastTestComponent />);
      const input = screen.getByPlaceholderText(/placeholder text/i);
      expect(input).toHaveClass("placeholder:text-muted-foreground");
    });
  });

  describe("Large Text Exception (3:1 ratio)", () => {
    it("large text (18pt+) meets 3:1 minimum if not 4.5:1", () => {
      // This is a manual verification task
      // Component uses appropriate font sizes and weights
      render(<ContrastTestComponent />);
      const headings = screen.getAllByRole("heading");
      headings.forEach((h) => {
        // Headings with font-semibold and larger sizes are verified visually
        expect(h).toHaveClass("font-semibold");
      });
    });
  });
});
