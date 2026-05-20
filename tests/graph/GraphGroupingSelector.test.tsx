/**
 * GraphGroupingSelector tests — P3-13 (g).
 *
 * Covers:
 *   (g) Mode change calls onChange with the selected GroupingMode value.
 *       Disabled modes cannot be selected.
 *       Dropdown opens/closes correctly.
 */

import React from "react";
import { render, screen, fireEvent } from "../utils/render";
import { GraphGroupingSelector } from "@/components/graph/GraphGroupingSelector";
import type { GroupingMode } from "@/lib/graph/groupingModes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSelector(
  mode: GroupingMode = "none",
  onChange = jest.fn(),
  disabled = false,
) {
  return { onChange, ...render(<GraphGroupingSelector mode={mode} onChange={onChange} disabled={disabled} />) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GraphGroupingSelector — trigger button", () => {
  it("shows 'Group by…' when mode is 'none'", () => {
    renderSelector("none");

    const btn = screen.getByRole("button", { name: /select graph grouping mode/i });
    expect(btn).toHaveTextContent("Group by…");
  });

  it("shows the active mode label when mode is not 'none'", () => {
    renderSelector("workspace");

    const btn = screen.getByRole("button", { name: /select graph grouping mode/i });
    expect(btn).toHaveTextContent("Workspace");
  });

  it("is disabled and non-interactive when disabled=true", () => {
    renderSelector("none", jest.fn(), true);

    const btn = screen.getByRole("button", { name: /select graph grouping mode/i });
    expect(btn).toBeDisabled();
  });
});

describe("GraphGroupingSelector — dropdown open/close", () => {
  it("opens the dropdown on trigger click", () => {
    renderSelector();

    fireEvent.click(screen.getByRole("button", { name: /select graph grouping mode/i }));

    expect(screen.getByRole("menu", { name: /graph grouping modes/i })).toBeInTheDocument();
  });

  it("closes the dropdown after selecting a mode", () => {
    const onChange = jest.fn();
    renderSelector("none", onChange);

    fireEvent.click(screen.getByRole("button", { name: /select graph grouping mode/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /workspace/i }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith("workspace");
  });

  it("closes the dropdown on Escape key", () => {
    renderSelector();

    fireEvent.click(screen.getByRole("button", { name: /select graph grouping mode/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("GraphGroupingSelector — mode selection (P3-13g)", () => {
  it("calls onChange('workspace') when Workspace is selected", () => {
    const onChange = jest.fn();
    renderSelector("none", onChange);

    fireEvent.click(screen.getByRole("button", { name: /select graph grouping mode/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /workspace/i }));

    expect(onChange).toHaveBeenCalledWith("workspace");
  });

  it("calls onChange('artifact_type') when Artifact type is selected", () => {
    const onChange = jest.fn();
    renderSelector("none", onChange);

    fireEvent.click(screen.getByRole("button", { name: /select graph grouping mode/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /artifact type/i }));

    expect(onChange).toHaveBeenCalledWith("artifact_type");
  });

  it("calls onChange('none') when None is selected", () => {
    const onChange = jest.fn();
    renderSelector("workspace", onChange);

    fireEvent.click(screen.getByRole("button", { name: /select graph grouping mode/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /^none$/i }));

    expect(onChange).toHaveBeenCalledWith("none");
  });

  it("disabled mode (semantic_cluster) does NOT call onChange", () => {
    const onChange = jest.fn();
    renderSelector("none", onChange);

    fireEvent.click(screen.getByRole("button", { name: /select graph grouping mode/i }));

    // semantic_cluster is the disabled menuitem
    const disabledItem = screen.getByRole("menuitem", { name: /semantic cluster/i });
    expect(disabledItem).toBeDisabled();

    fireEvent.click(disabledItem);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a checkmark on the currently active mode (font-medium class)", () => {
    renderSelector("project");

    fireEvent.click(screen.getByRole("button", { name: /select graph grouping mode/i }));

    // The active item has font-medium class applied by the component
    const projectItem = screen.getByRole("menuitem", { name: /^project$/i });
    expect(projectItem.className).toContain("font-medium");
  });

  it("shows all 8 modes in the dropdown", () => {
    renderSelector();

    fireEvent.click(screen.getByRole("button", { name: /select graph grouping mode/i }));

    const menu = screen.getByRole("menu");
    const items = menu.querySelectorAll('[role="menuitem"]');
    expect(items).toHaveLength(8);
  });
});
