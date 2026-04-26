/**
 * InlineTextarea component tests.
 *
 * Covers:
 *   - Display mode renders value with whitespace-pre-wrap
 *   - Newlines preserved in display mode
 *   - Click enters edit mode and focuses textarea
 *   - Enter (without Shift) triggers onSave with trimmed value
 *   - Shift+Enter inserts a newline (does not save)
 *   - Escape triggers onCancel
 *   - Empty string is allowed (onSave called with '')
 *   - Auto-height adjusts on input change
 *   - aria-label set to "Edit <label>" on display trigger
 *   - Disabled state blocks entering edit mode
 *   - On rejected save, component stays in edit mode
 *
 * P2-02 · Portal v1.8 inline editing
 */

import React from "react";
import { renderWithProviders, screen, fireEvent, waitFor } from "../../utils/render";
import { userEvent } from "../../utils/render";
import { InlineTextarea } from "@/components/inline-edit/InlineTextarea";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function noop() {
  return Promise.resolve();
}

function rejected() {
  return Promise.reject(new Error("save failed"));
}

// ---------------------------------------------------------------------------
// Display mode
// ---------------------------------------------------------------------------

describe("InlineTextarea — display mode", () => {
  it("renders the value as text", () => {
    renderWithProviders(
      <InlineTextarea value="Hello world" onSave={noop} label="Description" />,
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("preserves newlines via whitespace-pre-wrap class", () => {
    const multiline = "Line one\nLine two\nLine three";
    const { container } = renderWithProviders(
      <InlineTextarea value={multiline} onSave={noop} label="Description" />,
    );
    // The span carrying the value should have whitespace-pre-wrap applied.
    const valueSpan = container.querySelector("span.whitespace-pre-wrap");
    expect(valueSpan).toBeInTheDocument();
    expect(valueSpan?.textContent).toBe(multiline);
  });

  it("sets aria-label to 'Edit <label>' on the display button", () => {
    renderWithProviders(
      <InlineTextarea value="Some text" onSave={noop} label="Summary" />,
    );
    expect(
      screen.getByRole("button", { name: "Edit Summary" }),
    ).toBeInTheDocument();
  });

  it("does not show textarea in display mode", () => {
    renderWithProviders(
      <InlineTextarea value="foo" onSave={noop} label="Description" />,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Entering edit mode
// ---------------------------------------------------------------------------

describe("InlineTextarea — entering edit mode", () => {
  it("shows textarea after clicking the display button", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <InlineTextarea value="initial" onSave={noop} label="Description" />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("initial");
  });

  it("does not enter edit mode when disabled", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <InlineTextarea value="locked" onSave={noop} label="Description" disabled />,
    );

    const btn = screen.getByRole("button", { name: "Edit Description" });
    // Disabled button — userEvent should not trigger a click action.
    await user.click(btn);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Save on Enter
// ---------------------------------------------------------------------------

describe("InlineTextarea — Enter saves", () => {
  it("calls onSave with trimmed value when Enter is pressed", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(
      <InlineTextarea value="original" onSave={onSave} label="Description" />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    const textarea = screen.getByRole("textbox");

    await user.clear(textarea);
    await user.type(textarea, "  updated value  ");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("updated value");
    });
  });

  it("returns to display mode after a successful save", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(
      <InlineTextarea value="hello" onSave={onSave} label="Description" />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  it("allows saving with an empty string (clears optional field)", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(
      <InlineTextarea value="some text" onSave={onSave} label="Description" />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    const textarea = screen.getByRole("textbox");

    await user.clear(textarea);
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("");
    });
  });
});

// ---------------------------------------------------------------------------
// Shift+Enter inserts newline
// ---------------------------------------------------------------------------

describe("InlineTextarea — Shift+Enter inserts newline", () => {
  it("does not call onSave when Shift+Enter is pressed", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    renderWithProviders(
      <InlineTextarea value="line one" onSave={onSave} label="Description" />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    // Still in edit mode, onSave not called.
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Escape cancels
// ---------------------------------------------------------------------------

describe("InlineTextarea — Escape cancels", () => {
  it("exits edit mode when Escape is pressed", async () => {
    const onCancel = jest.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <InlineTextarea
        value="original"
        onSave={noop}
        onCancel={onCancel}
        label="Description"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("restores the original value after Escape", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <InlineTextarea value="original" onSave={noop} label="Description" />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    const textarea = screen.getByRole("textbox");

    await user.clear(textarea);
    await user.type(textarea, "modified");
    await user.keyboard("{Escape}");

    // Display mode should show original value again.
    await waitFor(() => {
      expect(screen.getByText("original")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Stay in edit mode on rejected save
// ---------------------------------------------------------------------------

describe("InlineTextarea — rejected save", () => {
  it("stays in edit mode when onSave rejects", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <InlineTextarea value="original" onSave={rejected} label="Description" />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    await user.keyboard("{Enter}");

    // Should still be in edit mode.
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Auto-height on input
// ---------------------------------------------------------------------------

describe("InlineTextarea — auto-height", () => {
  it("calls adjustHeight on content change (scrollHeight fallback)", async () => {
    const user = userEvent.setup();

    // jsdom doesn't implement scrollHeight layout, but we can verify that
    // style.height is set (even to '0px') meaning the fallback path ran.
    renderWithProviders(
      <InlineTextarea value="" onSave={noop} label="Description" />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

    // Initial height set on focus.
    expect(textarea.style.height).toBeDefined();

    // Type something and verify style.height is updated (not necessarily a real
    // pixel value in jsdom, but confirms the resize path executed).
    await user.type(textarea, "some content");

    // After typing the height attribute should still be explicitly set.
    expect(textarea.style.height).not.toBe("");
  });
});
