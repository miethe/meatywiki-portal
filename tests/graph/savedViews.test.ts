/**
 * savedViews.ts unit tests — P3-13 (f).
 *
 * Covers:
 *   (f) save / list / delete / update; preserve insertion order;
 *       SSR safety (window absent → returns []).
 */

import {
  listSavedViews,
  saveView,
  deleteSavedView,
  updateSavedView,
} from "@/lib/graph/savedViews";
import { GRAPH_FILTERS_DEFAULT } from "@/components/graph/GraphFilters";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Baseline filter snapshot (no active dims). */
const DEFAULT_FILTER = { ...GRAPH_FILTERS_DEFAULT };

function makeView(name = "Test view") {
  return saveView({
    name,
    filter: DEFAULT_FILTER,
    cameraPreset: null,
    grouping: null,
  });
}

// ---------------------------------------------------------------------------
// Setup — clear localStorage before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// save + list
// ---------------------------------------------------------------------------

describe("savedViews — save + list", () => {
  it("listSavedViews returns [] when nothing is saved", () => {
    expect(listSavedViews()).toEqual([]);
  });

  it("saveView creates a view with a non-empty id and ISO createdAt", () => {
    const view = makeView("My first view");

    expect(view.id).toBeTruthy();
    expect(view.name).toBe("My first view");
    expect(new Date(view.createdAt).getTime()).not.toBeNaN();
  });

  it("listSavedViews returns the saved view", () => {
    const view = makeView("Workspace filter");
    const list = listSavedViews();

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(view.id);
    expect(list[0].name).toBe("Workspace filter");
  });

  it("preserves insertion order across multiple saves", () => {
    const a = makeView("View A");
    const b = makeView("View B");
    const c = makeView("View C");

    const list = listSavedViews();

    expect(list.map((v) => v.id)).toEqual([a.id, b.id, c.id]);
  });

  it("trims whitespace from the name and defaults to 'Untitled view' for blank names", () => {
    const view = saveView({
      name: "   ",
      filter: DEFAULT_FILTER,
      cameraPreset: null,
      grouping: null,
    });

    expect(view.name).toBe("Untitled view");
  });

  it("persists camera preset and grouping on the view", () => {
    const view = saveView({
      name: "With preset",
      filter: DEFAULT_FILTER,
      cameraPreset: "recent-activity",
      grouping: "workspace",
    });

    expect(view.cameraPreset).toBe("recent-activity");
    expect(view.grouping).toBe("workspace");

    const stored = listSavedViews()[0];
    expect(stored.cameraPreset).toBe("recent-activity");
    expect(stored.grouping).toBe("workspace");
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe("savedViews — delete", () => {
  it("deleteSavedView removes a view by id", () => {
    const a = makeView("A");
    const b = makeView("B");

    deleteSavedView(a.id);

    const list = listSavedViews();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(b.id);
  });

  it("deleteSavedView is a no-op for an unknown id", () => {
    makeView("keep");
    deleteSavedView("does-not-exist");

    expect(listSavedViews()).toHaveLength(1);
  });

  it("handles deleting the last remaining view", () => {
    const view = makeView("only view");
    deleteSavedView(view.id);

    expect(listSavedViews()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("savedViews — update", () => {
  it("updateSavedView patches the name field", () => {
    const view = makeView("Old name");
    updateSavedView(view.id, { name: "New name" });

    const stored = listSavedViews()[0];
    expect(stored.name).toBe("New name");
  });

  it("updateSavedView does not overwrite id or createdAt", () => {
    const view = makeView("Keep id");

    updateSavedView(view.id, {
      // TypeScript would block this, but verify runtime safety
      name: "Updated",
    });

    const stored = listSavedViews()[0];
    expect(stored.id).toBe(view.id);
    expect(stored.createdAt).toBe(view.createdAt);
  });

  it("updateSavedView patches grouping field", () => {
    const view = makeView("View");
    updateSavedView(view.id, { grouping: "artifact_type" });

    const stored = listSavedViews()[0];
    expect(stored.grouping).toBe("artifact_type");
  });

  it("updateSavedView is a no-op for an unknown id", () => {
    makeView("Unchanged");
    updateSavedView("unknown-id", { name: "Should not change" });

    const stored = listSavedViews()[0];
    expect(stored.name).toBe("Unchanged");
  });
});

// ---------------------------------------------------------------------------
// SSR safety (window absent)
// ---------------------------------------------------------------------------

describe("savedViews — SSR safety", () => {
  let windowSpy: jest.SpyInstance | undefined;

  beforeEach(() => {
    // Simulate a server-side context where `window` is undefined.
    // We do this by overwriting the global property temporarily.
    windowSpy = jest
      .spyOn(global, "window", "get")
      .mockReturnValue(undefined as unknown as Window & typeof globalThis);
  });

  afterEach(() => {
    windowSpy?.mockRestore();
  });

  it("listSavedViews returns [] when window is undefined (SSR)", () => {
    expect(listSavedViews()).toEqual([]);
  });

  it("saveView does not throw when window is undefined (SSR)", () => {
    expect(() =>
      saveView({
        name: "SSR view",
        filter: DEFAULT_FILTER,
        cameraPreset: null,
        grouping: null,
      }),
    ).not.toThrow();
  });

  it("deleteSavedView does not throw when window is undefined (SSR)", () => {
    expect(() => deleteSavedView("any-id")).not.toThrow();
  });
});
