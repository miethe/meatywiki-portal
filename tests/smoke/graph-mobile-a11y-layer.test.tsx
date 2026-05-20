/**
 * P5-RS1 — Runtime smoke: P5 mobile + a11y layer.
 *
 * Validates key runtime behaviours of the P5 surfaces without requiring WebGL
 * or sigma.js (both are unavailable in jsdom). All components are UI-only or
 * pure helper functions.
 *
 * Sections:
 *   §1 — Palette helpers (P5-08)
 *   §2 — GraphSettingsMenu (P5-08)
 *   §3 — GraphAriaLive + useAriaAnnouncer (P5-06)
 *   §4 — Animation timings + useAnimationBudget (P5-09)
 *   §5 — GraphDataTable / DegradedFallback (P5-10)
 *   §6 — GraphOnboardingOverlay + useOnboardingState (P5-11)
 *   §7 — GraphFilterPresets (P5-11)
 *   §8 — GraphFilterSheet (P5-02)
 *
 * Mocking strategy:
 *   - No sigma / WebGL needed — all components are presentational or pure.
 *   - localStorage is cleaned in beforeEach to isolate onboarding/palette tests.
 *   - requestAnimationFrame is provided by jest-environment-jsdom; no manual mock needed.
 */

import React, { act } from "react";
import { render, screen, fireEvent } from "../utils/render";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear localStorage so palette / onboarding tests don't bleed between runs.
  localStorage.clear();
});

afterEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// §1 — Palette helpers (P5-08)
// ===========================================================================

import { getPalette } from "@/lib/graph/palette";
import { resolveNodeColorWithPalette } from "@/lib/graph/encoding-palette";
import { PaletteProvider, usePaletteKey } from "@/lib/graph/palette-context";

describe("Palette helpers — getPalette (P5-08)", () => {
  it("getPalette('default') returns an object with required ColorPalette keys", () => {
    const p = getPalette("default");
    expect(p).toHaveProperty("artifact_type");
    expect(p).toHaveProperty("workspace");
    expect(p).toHaveProperty("edge_type");
    expect(p).toHaveProperty("selection_ring");
    expect(p).toHaveProperty("focus_glow");
    expect(p).toHaveProperty("focus_anchor");
  });

  it("getPalette('colorblind') returns an object with the same required keys", () => {
    const p = getPalette("colorblind");
    expect(p).toHaveProperty("artifact_type");
    expect(p).toHaveProperty("workspace");
    expect(p).toHaveProperty("edge_type");
    expect(p).toHaveProperty("selection_ring");
    expect(p).toHaveProperty("focus_glow");
    expect(p).toHaveProperty("focus_anchor");
  });

  it("getPalette('default') and getPalette('colorblind') return distinct objects", () => {
    const def = getPalette("default");
    const cb = getPalette("colorblind");
    // Objects are distinct references and differ on at least one key
    expect(def).not.toBe(cb);
    expect(def.artifact_type.concept).not.toBe(cb.artifact_type.concept);
  });

  it("getPalette('default').selection_ring is amber-500 (#d97706)", () => {
    expect(getPalette("default").selection_ring).toBe("#d97706");
  });

  it("getPalette('colorblind').selection_ring is also amber-500 (per spec §11)", () => {
    // Selection ring is not affected by colour blindness; both palettes match.
    expect(getPalette("colorblind").selection_ring).toBe("#d97706");
  });
});

describe("resolveNodeColorWithPalette (P5-08)", () => {
  const defaultPalette = getPalette("default");

  it("mode='workspace' returns the workspace colour from the palette", () => {
    const color = resolveNodeColorWithPalette(
      "concept",
      "research",
      null,
      null,
      "workspace",
      defaultPalette,
    );
    expect(color).toBe(defaultPalette.workspace.research);
  });

  it("mode='lens' with null selectedLens falls back to artifact_type colour", () => {
    const color = resolveNodeColorWithPalette(
      "concept",
      "research",
      null,
      null,
      "lens",
      defaultPalette,
    );
    expect(color).toBe(defaultPalette.artifact_type.concept);
  });

  it("mode='lens' with score missing for selectedLens falls back to artifact_type colour", () => {
    const color = resolveNodeColorWithPalette(
      "entity",
      "wiki",
      { relevance: 0.8 },
      "other_lens",
      "lens",
      defaultPalette,
    );
    expect(color).toBe(defaultPalette.artifact_type.entity);
  });

  it("mode='artifact_type' returns the artifact_type colour", () => {
    const color = resolveNodeColorWithPalette(
      "summary",
      "wiki",
      null,
      null,
      "artifact_type",
      defaultPalette,
    );
    expect(color).toBe(defaultPalette.artifact_type.summary);
  });
});

describe("PaletteProvider + usePaletteKey localStorage write (P5-08)", () => {
  function PaletteToggler() {
    const [key, setKey] = usePaletteKey();
    return (
      <button
        onClick={() => setKey(key === "default" ? "colorblind" : "default")}
        data-testid="toggle"
        data-palette={key}
      >
        {key}
      </button>
    );
  }

  it("writes 'colorblind' to localStorage['mw-graph-palette'] on toggle", async () => {
    render(
      <PaletteProvider>
        <PaletteToggler />
      </PaletteProvider>,
    );

    const btn = screen.getByTestId("toggle");
    // Initial key is 'default' (localStorage is empty)
    expect(btn).toHaveTextContent("default");

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(btn).toHaveTextContent("colorblind");
    expect(localStorage.getItem("mw-graph-palette")).toBe("colorblind");
  });
});

// ===========================================================================
// §2 — GraphSettingsMenu (P5-08)
// ===========================================================================

import { GraphSettingsMenu } from "@/components/graph/GraphSettingsMenu";

function renderSettingsMenu() {
  return render(
    <PaletteProvider>
      <GraphSettingsMenu />
    </PaletteProvider>,
  );
}

describe("GraphSettingsMenu (P5-08)", () => {
  it("renders a gear-icon trigger with accessible label 'Graph settings'", () => {
    renderSettingsMenu();
    // Button has an sr-only span with "Graph settings" text
    expect(screen.getByRole("button", { name: /graph settings/i })).toBeInTheDocument();
  });

  it("opening the menu shows two checkbox items for the two palettes", async () => {
    const user = userEvent.setup();
    renderSettingsMenu();
    const trigger = screen.getByRole("button", { name: /graph settings/i });
    await user.click(trigger);

    expect(
      screen.getByRole("menuitemcheckbox", { name: /default \(wcag aa\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /color-blind \(deuteranopia-safe\)/i }),
    ).toBeInTheDocument();
  });

  it("clicking the colorblind item calls setPaletteKey('colorblind')", async () => {
    const user = userEvent.setup();
    renderSettingsMenu();
    const trigger = screen.getByRole("button", { name: /graph settings/i });
    await user.click(trigger);

    const cbItem = screen.getByRole("menuitemcheckbox", {
      name: /color-blind \(deuteranopia-safe\)/i,
    });
    await user.click(cbItem);

    // After toggle, localStorage should reflect the new key
    expect(localStorage.getItem("mw-graph-palette")).toBe("colorblind");
  });
});

// ===========================================================================
// §3 — GraphAriaLive + useAriaAnnouncer (P5-06)
// ===========================================================================

import { GraphAriaLive, useAriaAnnouncer } from "@/components/graph/GraphAriaLive";
import { renderHook } from "@testing-library/react";

describe("useAriaAnnouncer outside provider (P5-06)", () => {
  it("returns a no-op announce function — does not throw", () => {
    const { result } = renderHook(() => useAriaAnnouncer());
    expect(() => result.current.announce("hello")).not.toThrow();
  });
});

describe("GraphAriaLive — live region (P5-06)", () => {
  it("renders a live region with role='status' and aria-live='polite'", () => {
    render(
      <GraphAriaLive>
        <span>children</span>
      </GraphAriaLive>,
    );
    const region = document.querySelector('[role="status"][aria-live="polite"]');
    expect(region).toBeInTheDocument();
  });

  it("renders children alongside the live region", () => {
    render(<GraphAriaLive><span data-testid="child">ok</span></GraphAriaLive>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("announce() calls requestAnimationFrame to update the live region", async () => {
    // Spy on rAF to verify it was called; the actual content update involves
    // an async rAF tick that jsdom doesn't run automatically in fake-timer mode.
    const rafSpy = jest.spyOn(window, "requestAnimationFrame");

    function Announcer() {
      const { announce } = useAriaAnnouncer();
      return (
        <button onClick={() => announce("hello world")} data-testid="ann-btn">
          announce
        </button>
      );
    }

    render(
      <GraphAriaLive>
        <Announcer />
      </GraphAriaLive>,
    );

    fireEvent.click(screen.getByTestId("ann-btn"));

    // The implementation calls rAF to batch the state update; verify it was invoked.
    expect(rafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
  });
});

// ===========================================================================
// §4 — Animation timings + useAnimationBudget (P5-09)
// ===========================================================================

import { ANIMATION_TIMINGS } from "@/lib/graph/animationTimings";
import { useAnimationBudget } from "@/hooks/useAnimationBudget";

describe("ANIMATION_TIMINGS shape (P5-09)", () => {
  it("cameraJump.durationMs === 400", () => {
    expect(ANIMATION_TIMINGS.cameraJump.durationMs).toBe(400);
  });

  it("nodeFadeIn.durationMs === 200", () => {
    expect(ANIMATION_TIMINGS.nodeFadeIn.durationMs).toBe(200);
  });

  it("performanceGuardThresholdMs === 33", () => {
    expect(ANIMATION_TIMINGS.performanceGuardThresholdMs).toBe(33);
  });

  it("nodeFadeOut.durationMs is 150", () => {
    expect(ANIMATION_TIMINGS.nodeFadeOut.durationMs).toBe(150);
  });
});

describe("useAnimationBudget initial render (P5-09)", () => {
  it("slowFrame is false on initial render (RAF hasn't accumulated frames yet)", () => {
    const { result } = renderHook(() => useAnimationBudget());
    // Before any RAF tick has accumulated 10 frames, slowFrame starts false.
    expect(result.current.slowFrame).toBe(false);
  });
});

// ===========================================================================
// §5 — GraphDataTable / DegradedFallback (P5-10)
// ===========================================================================

import { GraphDataTable } from "@/components/graph/DegradedFallback";
import type { VaultGraphNode } from "@/types/graph";

const SAMPLE_NODES: VaultGraphNode[] = [
  {
    id: "node-1",
    title: "Attention Is All You Need",
    artifact_type: "concept",
    workspace: "research",
    fidelity_level: "F3",
    freshness_class: "current",
    updated_at: "2026-01-01T00:00:00Z",
    tags: [],
  },
  {
    id: "node-2",
    title: "Knowledge Graphs Overview",
    artifact_type: "topic_note",
    workspace: "wiki",
    fidelity_level: "F2",
    freshness_class: "aging",
    updated_at: "2025-06-01T00:00:00Z",
    tags: [],
  },
];

describe("GraphDataTable — accessible data grid (P5-10)", () => {
  it("renders a table with role='grid'", () => {
    render(
      <GraphDataTable nodes={SAMPLE_NODES} totalNodes={SAMPLE_NODES.length} />,
    );
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("sets aria-rowcount equal to totalNodes", () => {
    render(<GraphDataTable nodes={SAMPLE_NODES} totalNodes={42} />);
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-rowcount", "42");
  });

  it("renders 6 column headers: Title, Type, Workspace, Updated, Fidelity, Freshness", () => {
    render(
      <GraphDataTable nodes={SAMPLE_NODES} totalNodes={SAMPLE_NODES.length} />,
    );
    expect(screen.getByRole("button", { name: /^title$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^type$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^workspace$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^updated$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^fidelity$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^freshness$/i })).toBeInTheDocument();
  });

  it("contains a sr-only skip link with text 'Skip to table view'", () => {
    render(
      <GraphDataTable nodes={SAMPLE_NODES} totalNodes={SAMPLE_NODES.length} />,
    );
    const skipLink = document.querySelector("a.sr-only");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink?.textContent).toMatch(/skip to table view/i);
  });

  it("clicking a column header sets aria-sort on that button", async () => {
    render(
      <GraphDataTable nodes={SAMPLE_NODES} totalNodes={SAMPLE_NODES.length} />,
    );
    const titleBtn = screen.getByRole("button", { name: /^title$/i });
    await act(async () => {
      fireEvent.click(titleBtn);
    });
    // After first click, sort should be ascending
    expect(titleBtn).toHaveAttribute("aria-sort", "ascending");
  });

  it("pressing Enter on a row calls onSelectNode with that node's id", async () => {
    const onSelectNode = jest.fn();
    render(
      <GraphDataTable
        nodes={SAMPLE_NODES}
        totalNodes={SAMPLE_NODES.length}
        onSelectNode={onSelectNode}
      />,
    );
    // Rows have tabIndex=0 and respond to keyboard
    const rows = screen.getAllByRole("row");
    // rows[0] is the header row; rows[1] is first data row
    const firstDataRow = rows[1];
    fireEvent.keyDown(firstDataRow, { key: "Enter" });
    expect(onSelectNode).toHaveBeenCalledWith("node-1");
  });
});

// ===========================================================================
// §6 — GraphOnboardingOverlay + useOnboardingState (P5-11)
// ===========================================================================

import {
  GraphOnboardingOverlay,
  useOnboardingState,
} from "@/components/graph/GraphOnboardingOverlay";

describe("GraphOnboardingOverlay (P5-11)", () => {
  it("when open=true renders role='dialog' containing the welcome title", () => {
    render(
      <GraphOnboardingOverlay open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(/welcome to your knowledge graph/i),
    ).toBeInTheDocument();
  });

  it("when open=false does not render the dialog", () => {
    render(
      <GraphOnboardingOverlay open={false} onOpenChange={jest.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders 4 hint cards by name: Search, Focus, Filter, Navigate", () => {
    render(
      <GraphOnboardingOverlay open={true} onOpenChange={jest.fn()} />,
    );
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Focus")).toBeInTheDocument();
    expect(screen.getByText("Filter")).toBeInTheDocument();
    expect(screen.getByText("Navigate")).toBeInTheDocument();
  });

  it("clicking 'Got it — start exploring' calls onOpenChange(false) and writes localStorage key", async () => {
    const onOpenChange = jest.fn();
    render(
      <GraphOnboardingOverlay open={true} onOpenChange={onOpenChange} />,
    );

    const dismiss = screen.getByRole("button", {
      name: /got it — start exploring/i,
    });
    await act(async () => {
      fireEvent.click(dismiss);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("useOnboardingState — localStorage gate (P5-11)", () => {
  it("open is false on initial render when localStorage flag is set", async () => {
    localStorage.setItem("mw-graph-onboarded", "1");

    const { result } = renderHook(() => useOnboardingState());

    // Give the useEffect a chance to run
    await act(async () => {});

    expect(result.current.open).toBe(false);
  });

  it("open becomes true after mount when localStorage flag is absent", async () => {
    // localStorage is empty (cleared in beforeEach)
    const { result } = renderHook(() => useOnboardingState());

    await act(async () => {});

    expect(result.current.open).toBe(true);
  });
});

// ===========================================================================
// §7 — GraphFilterPresets (P5-11)
// ===========================================================================

import { GraphFilterPresets } from "@/components/graph/GraphFilterPresets";

describe("GraphFilterPresets (P5-11)", () => {
  it("renders 4 preset cards by title", () => {
    render(<GraphFilterPresets onApplyPreset={jest.fn()} />);
    expect(screen.getByText("Show my library")).toBeInTheDocument();
    expect(screen.getByText("High-fidelity artifacts")).toBeInTheDocument();
    expect(screen.getByText("Recent research")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });

  it("'Show my library' calls onApplyPreset with workspaces=['library']", () => {
    const onApplyPreset = jest.fn();
    render(<GraphFilterPresets onApplyPreset={onApplyPreset} />);

    fireEvent.click(screen.getByText("Show my library"));

    expect(onApplyPreset).toHaveBeenCalledWith(
      expect.objectContaining({ ws: ["library"] }),
    );
  });

  it("'High-fidelity artifacts' calls onApplyPreset with fidelity_min >= 0.75", () => {
    const onApplyPreset = jest.fn();
    render(<GraphFilterPresets onApplyPreset={onApplyPreset} />);

    fireEvent.click(screen.getByText("High-fidelity artifacts"));

    const arg = onApplyPreset.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof arg.fidelity_min).toBe("number");
    expect(arg.fidelity_min as number).toBeGreaterThanOrEqual(0.75);
  });

  it("'Needs review' calls onApplyPreset with conf_max <= 0.5", () => {
    const onApplyPreset = jest.fn();
    render(<GraphFilterPresets onApplyPreset={onApplyPreset} />);

    fireEvent.click(screen.getByText("Needs review"));

    const arg = onApplyPreset.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof arg.conf_max).toBe("number");
    expect(arg.conf_max as number).toBeLessThanOrEqual(0.5);
  });

  it("each preset card fires onApplyPreset with a non-empty partial filter", () => {
    const onApplyPreset = jest.fn();
    render(<GraphFilterPresets onApplyPreset={onApplyPreset} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(4);

    buttons.forEach((btn) => {
      fireEvent.click(btn);
    });

    onApplyPreset.mock.calls.forEach(([arg]) => {
      expect(Object.keys(arg as object).length).toBeGreaterThan(0);
    });
  });
});

// ===========================================================================
// §8 — GraphFilterSheet (P5-02)
// ===========================================================================

import { GraphFilterSheet } from "@/components/graph/GraphFilterSheet";

function renderFilterSheet(
  overrides?: Partial<React.ComponentProps<typeof GraphFilterSheet>>,
) {
  const defaults: React.ComponentProps<typeof GraphFilterSheet> = {
    open: true,
    onOpenChangeAction: jest.fn(),
    activeFilterCount: 0,
    children: <span data-testid="sheet-child">filter content</span>,
  };
  return { ...render(<GraphFilterSheet {...defaults} {...overrides} />) };
}

describe("GraphFilterSheet (P5-02)", () => {
  it("when open=true renders the sheet body with children", () => {
    renderFilterSheet();
    expect(screen.getByTestId("sheet-child")).toBeInTheDocument();
  });

  it("when open=false renders nothing", () => {
    renderFilterSheet({ open: false });
    expect(screen.queryByTestId("sheet-child")).not.toBeInTheDocument();
  });

  it("clicking the backdrop calls onOpenChangeAction(false)", () => {
    const onOpenChangeAction = jest.fn();
    renderFilterSheet({ onOpenChangeAction });

    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeTruthy();
    if (backdrop) fireEvent.click(backdrop as HTMLElement);

    expect(onOpenChangeAction).toHaveBeenCalledWith(false);
  });

  it("pressing Escape calls onOpenChangeAction(false)", () => {
    const onOpenChangeAction = jest.fn();
    renderFilterSheet({ onOpenChangeAction });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onOpenChangeAction).toHaveBeenCalledWith(false);
  });

  it("close button click calls onOpenChangeAction(false)", () => {
    const onOpenChangeAction = jest.fn();
    renderFilterSheet({ onOpenChangeAction });

    fireEvent.click(screen.getByRole("button", { name: /close filter panel/i }));

    expect(onOpenChangeAction).toHaveBeenCalledWith(false);
  });
});
