/**
 * GraphFilterChips tests — P3-13 (d).
 *
 * Covers:
 *   (d) Chips render for active dims; chip × removes that dim (calls onClearDim
 *       with the dim key); onFocusFilterPanel called on chip body click.
 *   - No chips rendered when all dims are at default values.
 *   - "Clear all" button always rendered when chips are present.
 *   - "Clear all" calls onClearAll.
 */

import React from "react";
import { render, screen, fireEvent } from "../utils/render";
import { GraphFilterChips } from "@/components/graph/GraphFilterChips";
import { GRAPH_FILTERS_DEFAULT } from "@/components/graph/GraphFilters";
import type { GraphFiltersValues } from "@/components/graph/GraphFilters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValues(overrides: Partial<GraphFiltersValues>): GraphFiltersValues {
  return { ...GRAPH_FILTERS_DEFAULT, ...overrides };
}

function renderChips(
  values: GraphFiltersValues,
  overrides?: {
    onClearDim?: jest.Mock;
    onClearAll?: jest.Mock;
    onFocusFilterPanel?: jest.Mock;
  },
) {
  const onClearDim = overrides?.onClearDim ?? jest.fn();
  const onClearAll = overrides?.onClearAll ?? jest.fn();
  const onFocusFilterPanel = overrides?.onFocusFilterPanel ?? jest.fn();

  return {
    onClearDim,
    onClearAll,
    onFocusFilterPanel,
    ...render(
      <GraphFilterChips
        values={values}
        onClearDim={onClearDim}
        onClearAll={onClearAll}
        onFocusFilterPanel={onFocusFilterPanel}
      />,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GraphFilterChips — active dims (P3-13d)", () => {
  it("renders nothing when all filter dims are at defaults", () => {
    const { container } = renderChips(GRAPH_FILTERS_DEFAULT);
    expect(container.firstChild).toBeNull();
  });

  it("renders a chip for the workspace dim when ws is non-empty", () => {
    renderChips(makeValues({ ws: ["library"] }));

    expect(
      screen.getByRole("button", {
        name: /filter active: workspace: library\. click to edit workspace filter\./i,
      }),
    ).toBeInTheDocument();
  });

  it("renders chips for multiple active dims simultaneously", () => {
    renderChips(makeValues({ ws: ["library"], types: ["concept"] }));

    // workspace chip and type chip
    expect(
      screen.getByRole("button", { name: /filter active: workspace:/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /filter active: type:/i }),
    ).toBeInTheDocument();
  });

  it("chip body click calls onFocusFilterPanel with the dim key", () => {
    const onFocusFilterPanel = jest.fn();
    renderChips(makeValues({ ws: ["research"] }), { onFocusFilterPanel });

    fireEvent.click(
      screen.getByRole("button", { name: /filter active: workspace:/i }),
    );

    expect(onFocusFilterPanel).toHaveBeenCalledWith("ws");
  });

  it("chip × button calls onClearDim with the dim key", () => {
    const onClearDim = jest.fn();
    renderChips(makeValues({ ws: ["research"] }), { onClearDim });

    fireEvent.click(
      screen.getByRole("button", { name: /remove workspace filter/i }),
    );

    expect(onClearDim).toHaveBeenCalledWith("ws");
  });

  it("renders Clear all button when chips are present", () => {
    renderChips(makeValues({ tags: ["ai", "ml"] }));

    expect(
      screen.getByRole("button", { name: /clear all active filters/i }),
    ).toBeInTheDocument();
  });

  it("Clear all button calls onClearAll", () => {
    const onClearAll = jest.fn();
    renderChips(makeValues({ tags: ["ai"] }), { onClearAll });

    fireEvent.click(
      screen.getByRole("button", { name: /clear all active filters/i }),
    );

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("renders date range chip when date_from is set", () => {
    renderChips(makeValues({ date_from: "2026-01-01" }));

    const chip = screen.getByRole("button", { name: /filter active: created:/i });
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toContain("created: since 2026-01-01");
  });

  it("renders date range chip with since/until format for single bound", () => {
    renderChips(makeValues({ date_to: "2026-03-31" }));

    const chip = screen.getByRole("button", { name: /filter active: created:/i });
    expect(chip.textContent).toContain("until 2026-03-31");
  });

  it("renders search chip when q is non-empty", () => {
    renderChips(makeValues({ q: "neural" }));

    const chip = screen.getByRole("button", { name: /filter active: search: neural/i });
    expect(chip).toBeInTheDocument();
  });

  it("truncates long type lists to 2 shown + N more", () => {
    renderChips(makeValues({ types: ["concept", "entity", "summary", "evidence"] }));

    const chip = screen.getByRole("button", { name: /filter active: type:/i });
    // 4 items: show 2 + "+2"
    expect(chip.textContent).toContain("+2");
  });

  it("renders confidence range chip when conf_max is below default", () => {
    renderChips(makeValues({ conf_min: 0, conf_max: 0.5 }));

    const chip = screen.getByRole("button", { name: /filter active: confidence:/i });
    expect(chip.textContent).toContain("confidence: <0.5");
  });
});
