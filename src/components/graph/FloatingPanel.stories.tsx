/**
 * FloatingPanel.stories — Storybook CSF3 stories for the FloatingPanel primitive.
 *
 * NOTE: @storybook/react is not yet installed in this project. This file is
 * authored in CSF3 format and will work with Storybook once it is added.
 * Until then, the type annotations use inline interfaces that mirror the
 * Storybook types without importing the package.
 *
 * The panel uses --mw-graph-* CSS custom properties defined in graph.css, which
 * are scoped to [data-page="graph"]. The decorator below sets
 * document.body.dataset.page = "graph" for the duration of each story and
 * restores the previous value on cleanup.
 *
 * graph.css must be loaded for styles to apply. It is imported directly here so
 * Storybook picks it up regardless of whether the global stylesheet includes it.
 *
 * Storybook title: Graph/FloatingPanel
 */

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Filter, BookOpen, Zap, Layers } from "lucide-react";
import { FloatingPanel } from "./FloatingPanel";

// Import the graph CSS so --mw-graph-* variables are available in Storybook
import "@/app/(graph)/graph.css";

// ---------------------------------------------------------------------------
// Minimal Storybook type shims (real @storybook/react types when installed)
// ---------------------------------------------------------------------------

type StoryFn = () => ReactNode;

interface StoryMeta {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
  decorators?: Array<(Story: StoryFn) => ReactNode>;
  parameters?: Record<string, unknown>;
}

interface StoryObj {
  render: () => ReactNode;
  parameters?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Decorator: set data-page="graph" on document.body for the story
// ---------------------------------------------------------------------------

function withGraphPage(Story: StoryFn): ReactNode {
  // This function is used as a Storybook decorator and called as a component
  // in rendered context, so hooks are valid here.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const prev = document.body.dataset.page;
    document.body.dataset.page = "graph";
    return () => {
      if (prev === undefined) {
        delete document.body.dataset.page;
      } else {
        document.body.dataset.page = prev;
      }
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "var(--mw-graph-bg, #0d0d0f)",
        position: "relative",
      }}
    >
      {Story()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: StoryMeta = {
  title: "Graph/FloatingPanel",
  component: FloatingPanel,
  decorators: [withGraphPage],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Collapsible floating overlay panel for the graph immersive canvas. " +
          "Renders via ReactDOM.createPortal; scoped to [data-page=\"graph\"] CSS theme. " +
          "Supports keyboard shortcuts and four anchor positions.",
      },
    },
  },
};

export default meta;

// ---------------------------------------------------------------------------
// Sample child content helpers
// ---------------------------------------------------------------------------

function SampleFilterContent() {
  return (
    <div className="flex flex-col gap-2">
      {["Concepts", "Entities", "Topics", "Summaries"].map((label) => (
        <label
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "var(--mw-graph-text-primary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            defaultChecked
            style={{ accentColor: "var(--mw-graph-accent)" }}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function SampleLegendContent() {
  const items = [
    { color: "#7c6af7", label: "Concept" },
    { color: "#4ade80", label: "Entity" },
    { color: "#60a5fa", label: "Topic" },
    { color: "#f472b6", label: "Summary" },
  ];
  return (
    <div className="flex flex-col gap-2">
      {items.map(({ color, label }) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "var(--mw-graph-text-primary)",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: color,
              flexShrink: 0,
            }}
          />
          {label}
        </div>
      ))}
    </div>
  );
}

function SampleActionContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {["Zoom In", "Zoom Out", "Fit View", "Export PNG"].map((label) => (
        <button
          key={label}
          type="button"
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            background: "var(--mw-graph-border)",
            color: "var(--mw-graph-text-primary)",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            textAlign: "left",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * AllAnchors — four panels placed at each corner simultaneously.
 * Demonstrates that panels at adjacent corners do not visually collide.
 */
export const AllAnchors: StoryObj = {
  render: () => (
    <>
      <FloatingPanel
        id="top-left-demo"
        anchor="top-left"
        collapsedIcon={<Filter size={16} />}
        title="Filters"
      >
        <SampleFilterContent />
      </FloatingPanel>

      <FloatingPanel
        id="top-right-demo"
        anchor="top-right"
        collapsedIcon={<Zap size={16} />}
        title="Actions"
      >
        <SampleActionContent />
      </FloatingPanel>

      <FloatingPanel
        id="bottom-left-demo"
        anchor="bottom-left"
        collapsedIcon={<BookOpen size={16} />}
        title="Legend"
      >
        <SampleLegendContent />
      </FloatingPanel>

      <FloatingPanel
        id="bottom-right-demo"
        anchor="bottom-right"
        collapsedIcon={<Layers size={16} />}
        title="Layers"
      >
        <SampleFilterContent />
      </FloatingPanel>
    </>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "All four anchor positions rendered simultaneously. Each panel is independent.",
      },
    },
  },
};

/**
 * WithShortcut — single panel demonstrating the keyboard shortcut toggle.
 * Press "F" to toggle the panel open/closed (while not focused in a text field).
 */
export const WithShortcut: StoryObj = {
  render: () => (
    <FloatingPanel
      id="shortcut-demo"
      anchor="top-left"
      collapsedIcon={<Filter size={16} />}
      shortcutKey="f"
      title="Filters"
    >
      <div
        style={{
          color: "var(--mw-graph-text-secondary)",
          fontSize: "12px",
          marginBottom: "8px",
        }}
      >
        Press{" "}
        <kbd
          style={{
            background: "var(--mw-graph-border)",
            color: "var(--mw-graph-text-primary)",
            padding: "1px 5px",
            borderRadius: "3px",
            fontFamily: "monospace",
          }}
        >
          F
        </kbd>{" "}
        to toggle
      </div>
      <SampleFilterContent />
    </FloatingPanel>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Press F while not focused in a text field to toggle this panel. " +
          "The shortcut key badge is visible in both the header and the collapsed button.",
      },
    },
  },
};

/**
 * Collapsed — panel starts collapsed so the toggle button is visible from first render.
 */
export const Collapsed: StoryObj = {
  render: () => (
    <FloatingPanel
      id="collapsed-demo"
      anchor="top-left"
      defaultOpen={false}
      collapsedIcon={<Filter size={16} />}
      shortcutKey="f"
      title="Filters"
    >
      <SampleFilterContent />
    </FloatingPanel>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Panel starts collapsed. The 40×40 toggle button is visible with the shortcut badge. " +
          "Click it or press F to expand.",
      },
    },
  },
};

/**
 * LongContent — panel with scrollable content to verify max-h and overflow-auto behaviour.
 */
export const LongContent: StoryObj = {
  render: () => (
    <FloatingPanel
      id="long-content-demo"
      anchor="top-left"
      collapsedIcon={<Layers size={16} />}
      title="Long Content"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {Array.from({ length: 30 }, (_, i) => (
          <div
            key={i}
            style={{
              padding: "6px 8px",
              borderRadius: "4px",
              background: "var(--mw-graph-border)",
              color: "var(--mw-graph-text-primary)",
              fontSize: "12px",
            }}
          >
            Item {i + 1} — long filter option that may wrap slightly
          </div>
        ))}
      </div>
    </FloatingPanel>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Content exceeds the 80vh max height, triggering the overflow-auto scrollbar inside the panel.",
      },
    },
  },
};
