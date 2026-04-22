/**
 * Synthesis Builder 2-step wizard tests (DP4-02d).
 *
 * Tests:
 *   SynthesisTypeBento   — type selection (radiogroup, keyboard, visual state)
 *   SynthesisParameterPanel — depth/tone toggles, constraints/scope/focus inputs
 *   SynthesisScopeRailPanel — scope summary content
 *   SynthesisArtifactPicker — manual ID textarea mode (grid mode skipped;
 *     requires live fetch which is tested via MSW integration suite)
 *
 * Mocking strategy: same pattern as synthesis-builder.test.tsx
 *   - jest.mock for API calls + useSSE
 *   - MSW not used for these unit tests (jsdom/undici compat)
 */

import React from "react";
import { renderWithProviders, screen, waitFor } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";

// ---------------------------------------------------------------------------
// SynthesisTypeBento
// ---------------------------------------------------------------------------

import {
  SynthesisTypeBento,
  type SynthesisType,
} from "@/components/research/SynthesisTypeBento";

describe("SynthesisTypeBento", () => {
  it("renders a radiogroup with 4 synthesis type options", () => {
    renderWithProviders(
      <SynthesisTypeBento value={null} onChange={jest.fn()} />,
    );
    expect(screen.getByRole("radiogroup", { name: /synthesis type/i })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("renders summary, analysis, compare, synthesize options", () => {
    renderWithProviders(
      <SynthesisTypeBento value={null} onChange={jest.fn()} />,
    );
    expect(screen.getByRole("radio", { name: /summary/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /analysis/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /compare/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /synthesize/i })).toBeInTheDocument();
  });

  it("marks selected type as aria-checked", () => {
    renderWithProviders(
      <SynthesisTypeBento value="analysis" onChange={jest.fn()} />,
    );
    const analysisCard = screen.getByRole("radio", { name: /analysis/i });
    expect(analysisCard).toHaveAttribute("aria-checked", "true");

    const summaryCard = screen.getByRole("radio", { name: /summary/i });
    expect(summaryCard).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the selected type on click", async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SynthesisTypeBento value={null} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("radio", { name: /summary/i }));
    expect(onChange).toHaveBeenCalledWith("summary");
  });

  it("calls onChange on Enter keydown", async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SynthesisTypeBento value={null} onChange={onChange} />,
    );
    const compareCard = screen.getByRole("radio", { name: /compare/i });
    compareCard.focus();
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("compare");
  });

  it("calls onChange on Space keydown", async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SynthesisTypeBento value={null} onChange={onChange} />,
    );
    const synthesizeCard = screen.getByRole("radio", { name: /synthesize/i });
    synthesizeCard.focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith("synthesize");
  });
});

// ---------------------------------------------------------------------------
// SynthesisParameterPanel
// ---------------------------------------------------------------------------

import {
  SynthesisParameterPanel,
  type SynthesisParameters,
} from "@/components/research/SynthesisParameterPanel";

const DEFAULT_PARAMS: SynthesisParameters = {
  depth: "standard",
  tone: "neutral",
  constraints: "",
  scope: "",
  focus: "",
};

describe("SynthesisParameterPanel", () => {
  it("renders depth toggle buttons", () => {
    renderWithProviders(
      <SynthesisParameterPanel value={DEFAULT_PARAMS} onChange={jest.fn()} />,
    );
    expect(screen.getByRole("button", { name: /brief/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /standard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deep/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /exhaustive/i })).toBeInTheDocument();
  });

  it("renders tone toggle buttons", () => {
    renderWithProviders(
      <SynthesisParameterPanel value={DEFAULT_PARAMS} onChange={jest.fn()} />,
    );
    expect(screen.getByRole("button", { name: /neutral/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /academic/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conversational/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /critical/i })).toBeInTheDocument();
  });

  it("calls onChange with new depth when depth button clicked", async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SynthesisParameterPanel value={DEFAULT_PARAMS} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /deep/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ depth: "deep" }));
  });

  it("calls onChange with new tone when tone button clicked", async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SynthesisParameterPanel value={DEFAULT_PARAMS} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /academic/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tone: "academic" }));
  });

  it("renders constraints textarea", () => {
    renderWithProviders(
      <SynthesisParameterPanel value={DEFAULT_PARAMS} onChange={jest.fn()} />,
    );
    expect(screen.getByRole("textbox", { name: /constraints/i })).toBeInTheDocument();
  });

  it("renders scope and focus inputs", () => {
    renderWithProviders(
      <SynthesisParameterPanel value={DEFAULT_PARAMS} onChange={jest.fn()} />,
    );
    expect(screen.getByRole("textbox", { name: /scope/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /focus/i })).toBeInTheDocument();
  });

  it("calls onChange with constraints partial on input", async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <SynthesisParameterPanel value={DEFAULT_PARAMS} onChange={onChange} />,
    );
    const textarea = screen.getByRole("textbox", { name: /constraints/i });
    await userEvent.type(textarea, "x");
    // onChange called with { constraints: "x" } — partial update, controlled parent
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ constraints: "x" }),
    );
  });

  it("marks currently active depth as aria-pressed true", () => {
    renderWithProviders(
      <SynthesisParameterPanel
        value={{ ...DEFAULT_PARAMS, depth: "deep" }}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /deep/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /standard/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders the backend-pending notice banner", () => {
    renderWithProviders(
      <SynthesisParameterPanel value={DEFAULT_PARAMS} onChange={jest.fn()} />,
    );
    expect(
      screen.getByRole("note", { name: /parameter support status/i }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SynthesisScopeRailPanel
// ---------------------------------------------------------------------------

import { SynthesisScopeRailPanel } from "@/components/research/SynthesisScopeRailPanel";

describe("SynthesisScopeRailPanel", () => {
  it("shows 'No artifacts selected' when selectedIds is empty", () => {
    renderWithProviders(<SynthesisScopeRailPanel selectedIds={[]} />);
    expect(screen.getByText(/no artifacts selected yet/i)).toBeInTheDocument();
  });

  it("renders selected artifact IDs", () => {
    renderWithProviders(
      <SynthesisScopeRailPanel
        selectedIds={["01HXYZ0000000000000000001", "01HXYZ0000000000000000002"]}
      />,
    );
    expect(screen.getByText("01HXYZ0000000000000000001")).toBeInTheDocument();
    expect(screen.getByText("01HXYZ0000000000000000002")).toBeInTheDocument();
  });

  it("shows Sources count badge with correct number", () => {
    renderWithProviders(
      <SynthesisScopeRailPanel selectedIds={["01HXYZ0000000000000000001"]} />,
    );
    expect(screen.getByText(/sources \(1\)/i)).toBeInTheDocument();
  });

  it("renders synthesis type when provided", () => {
    renderWithProviders(
      <SynthesisScopeRailPanel
        selectedIds={["01HXYZ0000000000000000001"]}
        synthesisType="Analysis"
      />,
    );
    expect(screen.getByText("Analysis")).toBeInTheDocument();
  });

  it("renders scope when provided", () => {
    renderWithProviders(
      <SynthesisScopeRailPanel
        selectedIds={["01HXYZ0000000000000000001"]}
        scope="wiki/concepts/**"
      />,
    );
    expect(screen.getByText("wiki/concepts/**")).toBeInTheDocument();
  });

  it("renders focus when provided", () => {
    renderWithProviders(
      <SynthesisScopeRailPanel
        selectedIds={["01HXYZ0000000000000000001"]}
        focus="performance benchmarks"
      />,
    );
    expect(screen.getByText("performance benchmarks")).toBeInTheDocument();
  });

  it("does not render type section when synthesisType is not provided", () => {
    renderWithProviders(
      <SynthesisScopeRailPanel selectedIds={["01HXYZ0000000000000000001"]} />,
    );
    // "Type" section heading should not appear when no type is set
    const typeSectionHeading = screen.queryByRole("region", { name: /type/i });
    // Since we don't label with role=region, we check text absence
    expect(screen.queryByText("Type")).not.toBeInTheDocument();
  });

  it("shows empty placeholder when no ids, type, scope, or focus", () => {
    renderWithProviders(<SynthesisScopeRailPanel selectedIds={[]} />);
    expect(
      screen.getByText(/select source artifacts in step 1/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SynthesisArtifactPicker — manual ID mode only (grid mode needs live fetch)
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  ...jest.requireActual("@/lib/api/artifacts"),
  listArtifacts: jest.fn(),
}));

import { listArtifacts } from "@/lib/api/artifacts";
import { SynthesisArtifactPicker } from "@/components/research/SynthesisArtifactPicker";

const mockListArtifacts = listArtifacts as jest.MockedFunction<typeof listArtifacts>;

beforeEach(() => {
  // Return empty list to avoid grid loading complexity in unit tests
  mockListArtifacts.mockResolvedValue({
    data: [],
    cursor: null,
  } as Awaited<ReturnType<typeof listArtifacts>>);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("SynthesisArtifactPicker — manual mode", () => {
  it("renders toolbar with search input", async () => {
    renderWithProviders(
      <SynthesisArtifactPicker selectedIds={[]} onSelectionChange={jest.fn()} />,
    );
    expect(
      screen.getByRole("searchbox", { name: /filter artifacts by title/i }),
    ).toBeInTheDocument();
  });

  it("renders the 'Enter IDs' toggle button", async () => {
    renderWithProviders(
      <SynthesisArtifactPicker selectedIds={[]} onSelectionChange={jest.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /enter ids manually/i }),
    ).toBeInTheDocument();
  });

  it("switches to manual ID textarea on toggle click", async () => {
    renderWithProviders(
      <SynthesisArtifactPicker selectedIds={[]} onSelectionChange={jest.fn()} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /enter ids manually/i }),
    );
    expect(
      screen.getByRole("textbox", { name: /source artifact ids/i }),
    ).toBeInTheDocument();
  });

  it("calls onSelectionChange with parsed IDs from manual textarea", async () => {
    const onSelectionChange = jest.fn();
    renderWithProviders(
      <SynthesisArtifactPicker
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /enter ids manually/i }),
    );
    const textarea = screen.getByRole("textbox", { name: /source artifact ids/i });
    await userEvent.type(textarea, "01HXYZ0000000000000000001");
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.arrayContaining(["01HXYZ0000000000000000001"]),
    );
  });

  it("renders selection count badge when IDs are selected", async () => {
    renderWithProviders(
      <SynthesisArtifactPicker
        selectedIds={["01HXYZ0000000000000000001", "01HXYZ0000000000000000002"]}
        onSelectionChange={jest.fn()}
      />,
    );
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });

  it("shows 'no artifacts found' empty state in grid mode after load", async () => {
    renderWithProviders(
      <SynthesisArtifactPicker selectedIds={[]} onSelectionChange={jest.fn()} />,
    );
    // Wait for loading to finish (mocked to resolve empty)
    await waitFor(() => {
      expect(screen.getByText(/no artifacts found/i)).toBeInTheDocument();
    });
  });
});
