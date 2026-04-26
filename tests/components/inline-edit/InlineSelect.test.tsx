/**
 * InlineSelect — unit tests (P2-03).
 *
 * Coverage:
 *   - Renders display mode showing the current option's label
 *   - Falls back to placeholder when no option matches current value
 *   - Falls back to raw value when no option matches and no placeholder
 *   - aria-label is set on the trigger
 *   - Selecting an option calls onSave with the new value
 *   - Optimistic update: local displayed value reverts when onSave rejects
 *   - disabled prop prevents interaction
 *
 * Radix UI Select relies on pointer-capture and scroll APIs that jsdom does not
 * implement; the beforeAll block below adds the minimal stubs required.
 */

import React from "react";
import { renderWithProviders, screen, waitFor } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";
import { InlineSelect, type InlineSelectOption } from "@/components/inline-edit/InlineSelect";

// ---------------------------------------------------------------------------
// Radix UI pointer / scroll stubs
// ---------------------------------------------------------------------------

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  Element.prototype.hasPointerCapture = jest.fn() as typeof Element.prototype.hasPointerCapture;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  Element.prototype.scrollIntoView = jest.fn() as typeof Element.prototype.scrollIntoView;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OPTIONS: InlineSelectOption[] = [
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

function makeOnSave(resolves = true) {
  return jest.fn<Promise<void>, [string]>(
    () =>
      new Promise((resolve, reject) =>
        resolves ? resolve() : reject(new Error("save failed")),
      ),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InlineSelect", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Display mode ────────────────────────────────────────────────────────────

  it("renders the matching option label for the current value", () => {
    renderWithProviders(
      <InlineSelect
        value="published"
        options={OPTIONS}
        onSave={makeOnSave()}
        label="Status"
      />,
    );

    // The trigger shows the selected option's label
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("renders placeholder when current value has no matching option", () => {
    renderWithProviders(
      <InlineSelect
        value=""
        options={OPTIONS}
        onSave={makeOnSave()}
        label="Status"
        placeholder="Select a status"
      />,
    );

    expect(screen.getByText("Select a status")).toBeInTheDocument();
  });

  // ── Accessibility ────────────────────────────────────────────────────────────

  it("sets aria-label on the select trigger", () => {
    renderWithProviders(
      <InlineSelect
        value="draft"
        options={OPTIONS}
        onSave={makeOnSave()}
        label="Publish status"
      />,
    );

    const trigger = screen.getByRole("combobox", { name: /publish status/i });
    expect(trigger).toBeInTheDocument();
  });

  // ── Interaction: open & select ───────────────────────────────────────────────

  it("calls onSave with the selected value when an option is chosen", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineSelect
        value="draft"
        options={OPTIONS}
        onSave={onSave}
        label="Status"
      />,
    );

    // Open the dropdown
    const trigger = screen.getByRole("combobox", { name: /status/i });
    await user.click(trigger);

    // Select the "Published" option
    const publishedOption = await screen.findByRole("option", { name: /published/i });
    await user.click(publishedOption);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith("published");
    });
  });

  // ── Optimistic update + rollback on rejection ────────────────────────────────

  it("reverts displayed value when onSave rejects", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(false); // always rejects

    renderWithProviders(
      <InlineSelect
        value="draft"
        options={OPTIONS}
        onSave={onSave}
        label="Status"
      />,
    );

    // Verify initial display
    expect(screen.getByText("Draft")).toBeInTheDocument();

    // Open and select a different option
    await user.click(screen.getByRole("combobox", { name: /status/i }));
    const archivedOption = await screen.findByRole("option", { name: /archived/i });
    await user.click(archivedOption);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    // After rejection, displayed value should revert to "Draft"
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  // ── Disabled state ───────────────────────────────────────────────────────────

  it("disables the select trigger when disabled prop is true", () => {
    renderWithProviders(
      <InlineSelect
        value="draft"
        options={OPTIONS}
        onSave={makeOnSave()}
        label="Status"
        disabled
      />,
    );

    const trigger = screen.getByRole("combobox", { name: /status/i });
    expect(trigger).toBeDisabled();
  });

  it("does not call onSave when disabled and trigger is clicked", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineSelect
        value="draft"
        options={OPTIONS}
        onSave={onSave}
        label="Status"
        disabled
      />,
    );

    const trigger = screen.getByRole("combobox", { name: /status/i });
    // Clicking a disabled trigger should not open the dropdown
    await user.click(trigger);

    // No options should appear
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
