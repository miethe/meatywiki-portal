/**
 * InlineTextField — unit tests (P2-01).
 *
 * Coverage:
 *   - Renders display mode (value shown as text)
 *   - Pencil button present in display mode (visible on hover via CSS; queryable in DOM)
 *   - Click on display area enters edit mode (input visible, pencil hidden)
 *   - aria-label set on the display container and pencil button
 *   - Enter key with non-empty value calls onSave with trimmed string
 *   - Enter key with empty / whitespace-only value does NOT call onSave
 *   - Escape key calls onCancel and exits edit mode
 *   - disabled prop removes pencil button and prevents entering edit mode
 *   - onSave rejection keeps component in edit mode
 */

import React from "react";
import { renderWithProviders, screen, waitFor, fireEvent } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";
import { InlineTextField } from "@/components/inline-edit/InlineTextField";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

describe("InlineTextField", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Display mode ────────────────────────────────────────────────────────────

  it("renders the current value in display mode", () => {
    renderWithProviders(
      <InlineTextField value="My title" onSave={makeOnSave()} label="Title" />,
    );

    expect(screen.getByText("My title")).toBeInTheDocument();
    // Input should not be visible in display mode
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the pencil button in display mode", () => {
    renderWithProviders(
      <InlineTextField value="My title" onSave={makeOnSave()} label="Title" />,
    );

    // The pencil <button> is present in the DOM (CSS hides it until hover).
    // getAllByRole because both the wrapper div (role=button) and the inner
    // <button> carry the same aria-label — we verify at least one <button>
    // element is present.
    const editButtons = screen.getAllByRole("button", { name: /edit title/i });
    // Ensure the inner <button> (pencil) element exists (tagName === BUTTON)
    const pencilButton = editButtons.find(
      (el) => el.tagName.toLowerCase() === "button",
    );
    expect(pencilButton).toBeInTheDocument();
  });

  it("sets aria-label on the display container", () => {
    renderWithProviders(
      <InlineTextField value="My title" onSave={makeOnSave()} label="Title" />,
    );

    // Both the wrapper div (role=button) and the inner pencil button
    // carry aria-label="Edit Title" — verify the wrapper div is present.
    const editRegions = screen.getAllByRole("button", { name: /edit title/i });
    expect(editRegions.length).toBeGreaterThanOrEqual(1);
  });

  // ── Entering edit mode ───────────────────────────────────────────────────────

  it("enters edit mode when the display area is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <InlineTextField value="My title" onSave={makeOnSave()} label="Title" />,
    );

    // The display container has role=button (aria); click it
    const displayRegion = screen.getAllByRole("button", { name: /edit title/i })[0];
    await user.click(displayRegion);

    // Input should appear after entering edit mode
    const input = await screen.findByRole("textbox");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("My title");
  });

  it("enters edit mode when the pencil icon button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <InlineTextField value="My title" onSave={makeOnSave()} label="Title" />,
    );

    // Find the inner <button> (pencil) specifically — both the wrapper div and
    // the inner button share the same aria-label, so use getAllByRole + filter.
    const editButtons = screen.getAllByRole("button", { name: /edit title/i });
    const pencilBtn = editButtons.find(
      (el) => el.tagName.toLowerCase() === "button",
    )!;
    await user.click(pencilBtn);

    expect(await screen.findByRole("textbox")).toBeInTheDocument();
  });

  // ── Save (Enter) ─────────────────────────────────────────────────────────────

  it("calls onSave with trimmed value on Enter", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineTextField value="Old title" onSave={onSave} label="Title" />,
    );

    await user.click(screen.getAllByRole("button", { name: /edit title/i })[0]);
    const input = await screen.findByRole("textbox");

    await user.clear(input);
    await user.type(input, "  New title  ");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith("New title");
    });
  });

  it("exits edit mode after a successful save", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <InlineTextField value="Old title" onSave={makeOnSave(true)} label="Title" />,
    );

    await user.click(screen.getAllByRole("button", { name: /edit title/i })[0]);
    const input = await screen.findByRole("textbox");
    await user.clear(input);
    await user.type(input, "New title");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  // ── Empty string guard ───────────────────────────────────────────────────────

  it("does NOT call onSave when Enter is pressed with an empty value", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineTextField value="My title" onSave={onSave} label="Title" />,
    );

    await user.click(screen.getAllByRole("button", { name: /edit title/i })[0]);
    const input = await screen.findByRole("textbox");

    await user.clear(input);
    // Input is now empty
    await user.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
    // Still in edit mode
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does NOT call onSave when Enter is pressed with whitespace-only value", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineTextField value="My title" onSave={onSave} label="Title" />,
    );

    await user.click(screen.getAllByRole("button", { name: /edit title/i })[0]);
    const input = await screen.findByRole("textbox");

    await user.clear(input);
    await user.type(input, "   ");
    await user.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  // ── Escape / cancel ──────────────────────────────────────────────────────────

  it("calls onCancel and exits edit mode on Escape", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();

    renderWithProviders(
      <InlineTextField
        value="My title"
        onSave={makeOnSave(true)}
        onCancel={onCancel}
        label="Title"
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /edit title/i })[0]);
    await screen.findByRole("textbox");

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  // ── Rejection — stay in edit mode ───────────────────────────────────────────

  it("stays in edit mode when onSave rejects", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(false); // always rejects

    renderWithProviders(
      <InlineTextField value="My title" onSave={onSave} label="Title" />,
    );

    await user.click(screen.getAllByRole("button", { name: /edit title/i })[0]);
    const input = await screen.findByRole("textbox");
    await user.clear(input);
    await user.type(input, "New title");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    // Component should remain in edit mode after rejection
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  // ── Disabled state ───────────────────────────────────────────────────────────

  it("does not render the pencil button when disabled", () => {
    renderWithProviders(
      <InlineTextField
        value="My title"
        onSave={makeOnSave(true)}
        label="Title"
        disabled
      />,
    );

    // In disabled mode, no <button> element with "Edit Title" should exist.
    // The wrapper div may retain role=button (tabindex=-1) but the inner
    // pencil <button> must not be rendered.
    const editButtons = screen.queryAllByRole("button", { name: /edit title/i });
    const pencilButton = editButtons.find(
      (el) => el.tagName.toLowerCase() === "button",
    );
    expect(pencilButton).toBeUndefined();
  });

  it("does not enter edit mode when disabled display area is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <InlineTextField
        value="My title"
        onSave={makeOnSave(true)}
        label="Title"
        disabled
      />,
    );

    // The value text is still visible
    expect(screen.getByText("My title")).toBeInTheDocument();

    // Clicking the text (no button present) does nothing
    await user.click(screen.getByText("My title"));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
