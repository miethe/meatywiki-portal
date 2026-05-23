/**
 * InfoTooltip — RTL + axe coverage (P1-03).
 *
 * Scenarios:
 *  1. Renders icon trigger with correct aria-label
 *  2. Opens tooltip on hover (fine pointer / mouse)
 *  3. Opens tooltip on focus (keyboard a11y, fine pointer)
 *  4. Dismisses on Escape (fine pointer)
 *  5. Mobile tap variant opens Popover (coarse pointer)
 *  6. aria-describedby is wired when tooltip is open (fine pointer)
 *  7. axe scan — zero violations in default and open states
 *
 * Mocking strategy:
 *   - window.matchMedia is stubbed via tests/mocks/match-media so that
 *     usePointerType returns a controlled value.
 *   - Radix Tooltip uses a TooltipProvider for delay timing; we wrap in
 *     TooltipProvider with delayDuration=0 to avoid async timer management.
 *   - userEvent.setup() is used for all interactions (v14 API).
 *   - jest-axe matchers are registered globally in tests/setup.ts.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";

import InfoTooltip from "@/components/ui/info-tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setPointerType, resetMatchMedia } from "../../mocks/match-media";

// ---------------------------------------------------------------------------
// Render helper — wraps with TooltipProvider (required by Radix Tooltip.Root)
// ---------------------------------------------------------------------------

function renderTooltip(props: Partial<React.ComponentProps<typeof InfoTooltip>> = {}) {
  return render(
    <TooltipProvider delayDuration={0} skipDelayDuration={0}>
      <InfoTooltip content="Helpful tip" {...props} />
    </TooltipProvider>,
  );
}

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Default: mouse environment
  setPointerType("fine");
});

afterEach(() => {
  resetMatchMedia();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Scenario 1: Renders icon trigger
// ---------------------------------------------------------------------------

describe("InfoTooltip — trigger rendering", () => {
  it("renders a trigger button with default aria-label 'More information'", () => {
    renderTooltip();

    const trigger = screen.getByRole("button", { name: "More information" });
    expect(trigger).toBeInTheDocument();
  });

  it("uses a custom label when the label prop is provided", () => {
    renderTooltip({ label: "Learn more about this field" });

    const trigger = screen.getByRole("button", { name: "Learn more about this field" });
    expect(trigger).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Opens on hover (fine pointer)
// ---------------------------------------------------------------------------

describe("InfoTooltip — hover to open (fine pointer)", () => {
  it("reveals tooltip content when the trigger is hovered", async () => {
    const user = userEvent.setup({ delay: null });
    renderTooltip({ content: "Hover tip text" });

    const trigger = screen.getByRole("button", { name: "More information" });
    await user.hover(trigger);

    // Radix renders the tooltip content into a portal; findBy waits for it.
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Hover tip text");
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Opens on focus (keyboard a11y, fine pointer)
// ---------------------------------------------------------------------------

describe("InfoTooltip — focus to open (fine pointer)", () => {
  it("reveals tooltip content when the trigger receives keyboard focus", async () => {
    const user = userEvent.setup({ delay: null });
    renderTooltip({ content: "Focus tip text" });

    await user.tab(); // move focus to the trigger button

    const trigger = screen.getByRole("button", { name: "More information" });
    expect(trigger).toHaveFocus();

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("Focus tip text");
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Dismisses on Escape (fine pointer)
// ---------------------------------------------------------------------------

describe("InfoTooltip — Escape dismisses (fine pointer)", () => {
  it("hides tooltip content after pressing Escape", async () => {
    const user = userEvent.setup({ delay: null });
    renderTooltip({ content: "Dismiss me" });

    const trigger = screen.getByRole("button", { name: "More information" });
    await user.hover(trigger);

    // Wait for tooltip to appear
    await screen.findByRole("tooltip");

    // Press Escape to dismiss
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Mobile tap variant (coarse pointer → Popover)
// ---------------------------------------------------------------------------

describe("InfoTooltip — tap to open (coarse pointer)", () => {
  it("opens Popover content when trigger is clicked on a touch device", async () => {
    // Re-stub for coarse (touch) environment
    resetMatchMedia();
    setPointerType("coarse");

    const user = userEvent.setup({ delay: null });

    // usePointerType reads matchMedia on mount via useEffect, so we need to
    // render after setPointerType has configured window.matchMedia.
    render(
      <TooltipProvider delayDuration={0}>
        <InfoTooltip content="Mobile popover tip" />
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", { name: "More information" });
    await user.click(trigger);

    // Radix Popover renders content into a portal; wait for it to appear.
    await waitFor(() => {
      expect(screen.getByText("Mobile popover tip")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: aria-describedby is wired (fine pointer, open state)
// ---------------------------------------------------------------------------

describe("InfoTooltip — aria-describedby (fine pointer)", () => {
  it("trigger has aria-describedby pointing to non-empty id when tooltip is open", async () => {
    const user = userEvent.setup({ delay: null });
    renderTooltip({ content: "Described content" });

    const trigger = screen.getByRole("button", { name: "More information" });
    await user.hover(trigger);

    // Wait for tooltip to be in the DOM
    await screen.findByRole("tooltip");

    // Radix automatically sets aria-describedby on the trigger element when
    // the tooltip is open.
    const describedBy = trigger.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(describedBy!.trim().length).toBeGreaterThan(0);

    // Verify the referenced element exists in the document
    const described = document.getElementById(describedBy!);
    expect(described).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: axe clean
// ---------------------------------------------------------------------------

describe("InfoTooltip — axe accessibility scan", () => {
  it("has zero axe violations in default (closed) state", async () => {
    const { container } = renderTooltip({ content: "Axe tip text" });

    // Run axe on the rendered container (tooltip is not open yet)
    await act(async () => {
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  it("has zero axe violations in open (hovered) state", async () => {
    const user = userEvent.setup({ delay: null });
    renderTooltip({ content: "Axe tip open" });

    const trigger = screen.getByRole("button", { name: "More information" });
    await user.hover(trigger);
    await screen.findByRole("tooltip");

    await act(async () => {
      // Scan document.body to capture Radix portal content.
      // The `region` rule is disabled: Radix renders tooltip content into a
      // fixed-position portal outside any landmark container by design — this
      // is not a semantic defect in the component itself.
      const results = await axe(document.body, {
        rules: { region: { enabled: false } },
      });
      expect(results).toHaveNoViolations();
    });
  });
});
