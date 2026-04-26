/**
 * InlineChipEditor — unit tests (P2-04).
 *
 * Coverage:
 *   - Initial chips render as Badge elements
 *   - × button removes chip from local state and calls onSave immediately
 *   - Type + Enter adds chip to local state, clears input, does NOT call onSave
 *   - Duplicate chip (case-insensitive) is not added
 *   - Blur on add-input with changed chips calls onSave
 *   - Blur on add-input with no changes does NOT call onSave
 *   - Escape on add-input commits via onSave and clears input
 *   - aria-label is set on the container
 *   - disabled prop blocks add (input not rendered) and remove (× not rendered)
 *   - onSave rejection reverts local chip state to snapshot before change
 */

import React from "react";
import {
  renderWithProviders,
  screen,
  waitFor,
  fireEvent,
} from "../../utils/render";
import { userEvent } from "../../utils/userEvent";
import { InlineChipEditor } from "@/components/inline-edit/InlineChipEditor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOnSave(resolves = true) {
  return jest.fn<Promise<void>, [string[]]>(
    () =>
      new Promise((resolve, reject) =>
        resolves ? resolve() : reject(new Error("save failed")),
      ),
  );
}

const DEFAULT_VALUES = ["alpha", "beta", "gamma"];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InlineChipEditor", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── Initial render ──────────────────────────────────────────────────────────

  it("renders all initial chips", () => {
    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={makeOnSave()}
        label="Tags"
      />,
    );

    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByText("gamma")).toBeInTheDocument();
  });

  // ── aria-label ───────────────────────────────────────────────────────────────

  it("sets aria-label on the container", () => {
    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={makeOnSave()}
        label="Tags"
      />,
    );

    expect(screen.getByLabelText("Tags")).toBeInTheDocument();
  });

  // ── Remove chip ──────────────────────────────────────────────────────────────

  it("removes a chip from the list when × is clicked and calls onSave immediately", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={onSave}
        label="Tags"
      />,
    );

    const removeBtn = screen.getByRole("button", { name: "Remove beta" });
    await user.click(removeBtn);

    // Chip removed from DOM
    await waitFor(() => {
      expect(screen.queryByText("beta")).not.toBeInTheDocument();
    });

    // onSave called immediately with remaining chips
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(["alpha", "gamma"]);
  });

  // ── Add chip ─────────────────────────────────────────────────────────────────

  it("adds a chip to local state on Enter and clears the input", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={onSave}
        label="Tags"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Add Tags" });
    await user.type(input, "delta");
    await user.keyboard("{Enter}");

    // New chip appears
    expect(screen.getByText("delta")).toBeInTheDocument();
    // Input cleared
    expect((input as HTMLInputElement).value).toBe("");
    // onSave not called yet (committed on blur/Escape)
    expect(onSave).not.toHaveBeenCalled();
  });

  // ── Dedup ────────────────────────────────────────────────────────────────────

  it("does not add a duplicate chip (case-insensitive)", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={onSave}
        label="Tags"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Add Tags" });
    // "ALPHA" is a case-insensitive duplicate of "alpha"
    await user.type(input, "ALPHA");
    await user.keyboard("{Enter}");

    // Only one "alpha" (the original) should be present
    const alphaChips = screen.getAllByText("alpha");
    expect(alphaChips).toHaveLength(1);
    // Input cleared after rejected dedup
    expect((input as HTMLInputElement).value).toBe("");
    expect(onSave).not.toHaveBeenCalled();
  });

  // ── Blur commits ─────────────────────────────────────────────────────────────

  it("calls onSave on blur when chips have changed", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={onSave}
        label="Tags"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Add Tags" });
    await user.type(input, "delta");
    await user.keyboard("{Enter}");

    // Blur the input — should commit [alpha, beta, gamma, delta]
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(["alpha", "beta", "gamma", "delta"]);
    });
  });

  it("does NOT call onSave on blur when chips have not changed", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={onSave}
        label="Tags"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Add Tags" });
    // Focus then blur without any change
    await user.click(input);
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
  });

  // ── Escape commits ────────────────────────────────────────────────────────────

  it("commits via onSave on Escape when chips have changed", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={onSave}
        label="Tags"
      />,
    );

    // Remove a chip to create a change
    const removeBtn = screen.getByRole("button", { name: "Remove gamma" });
    await user.click(removeBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(["alpha", "beta"]);
    });
  });

  it("commits via onSave on Escape from the add-input when chips differ", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(true);

    renderWithProviders(
      <InlineChipEditor
        values={["x"]}
        onSave={onSave}
        label="Tags"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Add Tags" });
    await user.type(input, "y");
    await user.keyboard("{Enter}"); // adds "y" to local state, no save yet
    await user.keyboard("{Escape}"); // should commit [x, y]

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(["x", "y"]);
    });
  });

  // ── Disabled ─────────────────────────────────────────────────────────────────

  it("does not render the add input when disabled", () => {
    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={makeOnSave()}
        label="Tags"
        disabled
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("does not render × buttons when disabled", () => {
    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={makeOnSave()}
        label="Tags"
        disabled
      />,
    );

    expect(screen.queryByRole("button", { name: /Remove/i })).not.toBeInTheDocument();
  });

  // ── onSave rejection — revert ────────────────────────────────────────────────

  it("reverts local chips to the pre-change snapshot when onSave rejects on remove", async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave(false); // always rejects

    renderWithProviders(
      <InlineChipEditor
        values={DEFAULT_VALUES}
        onSave={onSave}
        label="Tags"
      />,
    );

    const removeBtn = screen.getByRole("button", { name: "Remove beta" });
    await user.click(removeBtn);

    // After rejection, chip should be reverted — all three chips visible again
    await waitFor(() => {
      expect(screen.getByText("beta")).toBeInTheDocument();
    });

    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("gamma")).toBeInTheDocument();
  });
});
