/**
 * Tests for RoutingRecommendationCard (P1.5-1-06).
 *
 * Covers:
 *   - Renders nothing (null) when recommendation has template=null (no match)
 *   - Renders card with template label and rationale when match is present
 *   - "Start Workflow" button is present and calls onStart callback with template slug
 *   - Loading state renders skeleton (aria-busy=true), not the card
 *   - Error state renders nothing (silent failure)
 *   - Unknown template slug falls back to raw slug as label
 *   - aria-label on the section region (WCAG 2.1 AA)
 *   - onStart not required: button still renders without crash
 *
 * FE-06 — prompt display (TEST-03):
 *   - "View Prompts" toggle shows / hides the prompts panel
 *   - PromptsPanel calls the template API after the toggle opens
 *   - Prompts are rendered with placeholder substitution applied
 *   - Copy button calls navigator.clipboard.writeText with the substituted text
 *
 * Clipboard note:
 *   @testing-library/user-event v14 installs its own Clipboard stub on
 *   window.navigator.clipboard when userEvent.setup() is called. Copy-button
 *   tests spy on the stub's writeText after setup() to capture call arguments
 *   without interfering with the "Copied!" UI feedback.
 */

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoutingRecommendationCard } from "@/components/artifact/routing-recommendation-card";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Mock getRoutingRecommendation — decouples from real fetch
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/artifacts", () => ({
  getRoutingRecommendation: jest.fn(),
}));

import { getRoutingRecommendation } from "@/lib/api/artifacts";
const mockGetRecommendation = getRoutingRecommendation as jest.MockedFunction<
  typeof getRoutingRecommendation
>;

// ---------------------------------------------------------------------------
// Mock getWorkflowTemplate + listWorkflowTemplates (FE-06)
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/workflow-templates", () => ({
  getWorkflowTemplate: jest.fn(),
  listWorkflowTemplates: jest.fn(),
}));

import {
  getWorkflowTemplate,
  listWorkflowTemplates,
} from "@/lib/api/workflow-templates";

const mockGetTemplate = getWorkflowTemplate as jest.MockedFunction<
  typeof getWorkflowTemplate
>;
const mockListTemplates = listWorkflowTemplates as jest.MockedFunction<
  typeof listWorkflowTemplates
>;

// ---------------------------------------------------------------------------
// Fixture: a WorkflowTemplate with a prompts: section that uses placeholders
// ---------------------------------------------------------------------------

const COMPILE_TEMPLATE_YAML = `label: Full Compile
description: Compile staged artifacts.
params:
  - name: scope
    type: string
    label: Scope
    required: false
prompts:
  - label: Compilation brief
    text: |
      Compile the artifact titled "{{artifact_title}}" (type: {{artifact_type}}).
      Tags: {{tags}}.
      Focus on producing a well-structured wiki page.
  - label: Lint check
    text: Run a lint pass on {{artifact_title}} and report any schema violations.
`;

function makeCompileTemplate(overrides: Partial<{ id: string; slug: string }> = {}) {
  return {
    id: overrides.id ?? "tpl-compile-01",
    slug: overrides.slug ?? "compile_v1",
    yaml_content: COMPILE_TEMPLATE_YAML,
    description: "Compile staged artifacts.",
    system: true,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    label: "Full Compile",
    params: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCard(
  artifactId = "art-test-01",
  onStart?: (slug: string) => void,
) {
  return render(
    <RoutingRecommendationCard
      artifactId={artifactId}
      onStart={onStart}
    />,
  );
}

/**
 * Render the card with all artifact context props wired (used by FE-06 tests).
 */
function renderCardWithContext({
  artifactId = "art-ctx-01",
  artifactTitle = "Distributed Systems Overview",
  artifactType = "concept",
  artifactTags = ["distributed", "systems", "caching"],
  onStart,
}: {
  artifactId?: string;
  artifactTitle?: string;
  artifactType?: string;
  artifactTags?: string[];
  onStart?: (slug: string) => void;
} = {}) {
  return render(
    <RoutingRecommendationCard
      artifactId={artifactId}
      artifactTitle={artifactTitle}
      artifactType={artifactType}
      artifactTags={artifactTags}
      onStart={onStart}
    />,
  );
}

// ---------------------------------------------------------------------------
// Global mock reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGetRecommendation.mockReset();
  mockGetTemplate.mockReset();
  mockListTemplates.mockReset();
});

// ---------------------------------------------------------------------------
// Existing tests — no match
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — no match", () => {
  it("renders nothing when recommendation has template=null", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: null,
      rationale: null,
    });

    const { container } = renderCard();

    await waitFor(() => {
      expect(mockGetRecommendation).toHaveBeenCalledWith("art-test-01");
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Existing tests — match present
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — match present", () => {
  it("renders card with human-readable template label", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "research_synthesis_v1",
      rationale: "Stale + unverified artifact benefits from synthesis.",
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText("Research Synthesis")).toBeInTheDocument();
    });
  });

  it("renders rationale text", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "research_synthesis_v1",
      rationale: "Stale + unverified artifact benefits from synthesis.",
    });

    renderCard();

    await waitFor(() => {
      expect(
        screen.getByText(/stale \+ unverified artifact/i),
      ).toBeInTheDocument();
    });
  });

  it("calls onStart with the template slug when Start button clicked", async () => {
    const user = userEvent.setup();
    const onStart = jest.fn();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "research_synthesis_v1",
      rationale: "Rationale text.",
    });

    renderCard("art-test-02", onStart);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start.*workflow/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /start.*workflow/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith("research_synthesis_v1");
  });

  it("renders Start Workflow button even when onStart is not provided", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "verification_workflow_v1",
      rationale: "Speculative fidelity.",
    });

    renderCard("art-no-handler");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start.*workflow/i })).toBeInTheDocument();
    });
  });

  it("falls back to raw slug when template has no known label", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "unknown_custom_workflow_v99",
      rationale: "Custom workflow rationale.",
    });

    renderCard();

    await waitFor(() => {
      expect(screen.getByText("unknown_custom_workflow_v99")).toBeInTheDocument();
    });
  });

  it("has role=region with aria-label 'Workflow recommendation' (WCAG 2.1 AA)", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "research_synthesis_v1",
      rationale: "Some rationale.",
    });

    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /workflow recommendation/i }),
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Existing tests — loading state
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — loading state", () => {
  it("renders loading skeleton (aria-busy) before fetch resolves", async () => {
    let resolvePromise!: (value: { template: null; rationale: null }) => void;
    const pending = new Promise<{ template: null; rationale: null }>(
      (res) => { resolvePromise = res; },
    );
    mockGetRecommendation.mockReturnValueOnce(pending);

    const { container } = renderCard();

    const loadingEl = container.querySelector('[aria-busy="true"]');
    expect(loadingEl).toBeInTheDocument();

    act(() => {
      resolvePromise({ template: null, rationale: null });
    });

    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Existing tests — error state
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — error state", () => {
  it("renders nothing (silent failure) when the API call throws", async () => {
    mockGetRecommendation.mockRejectedValueOnce(
      new ApiError(500, { error: { code: "server_error", message: "Unexpected" } }),
    );

    const { container } = renderCard();

    await waitFor(() => {
      expect(mockGetRecommendation).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders nothing (silent 404) when artifact is not found", async () => {
    mockGetRecommendation.mockRejectedValueOnce(
      new ApiError(404, { error: { code: "not_found", message: "Not found" } }),
    );

    const { container } = renderCard();

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// FE-06 — "View Prompts" toggle (TEST-03 scenario 1)
// ---------------------------------------------------------------------------

describe('RoutingRecommendationCard — "View Prompts" toggle', () => {
  it('renders a "View Prompts" button once the card loads', async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Artifact is ready to compile.",
    });

    renderCard();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /view prompts/i }),
      ).toBeInTheDocument();
    });
  });

  it('clicking "View Prompts" shows the prompts panel', async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Artifact is ready to compile.",
    });

    // Provide a template so the panel has content to render
    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    renderCard();

    // Wait for the card to resolve and the toggle button to appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    // The prompts panel container should now be in the DOM
    await waitFor(() => {
      expect(document.getElementById("routing-card-prompts-panel")).toBeInTheDocument();
    });
  });

  it('clicking "View Prompts" again hides the prompts panel', async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Artifact is ready to compile.",
    });

    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    renderCard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    // Open
    await user.click(screen.getByRole("button", { name: /view prompts/i }));
    await waitFor(() => {
      expect(document.getElementById("routing-card-prompts-panel")).toBeInTheDocument();
    });

    // Button label toggles to "Hide Prompts"
    const hideButton = screen.getByRole("button", { name: /hide prompts/i });
    await user.click(hideButton);

    await waitFor(() => {
      expect(document.getElementById("routing-card-prompts-panel")).not.toBeInTheDocument();
    });
  });

  it('toggle button has aria-expanded=false when panel is closed', async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready to compile.",
    });

    renderCard();

    await waitFor(() => {
      const toggleBtn = screen.getByRole("button", { name: /view prompts/i });
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    });
  });

  it('toggle button has aria-expanded=true when panel is open', async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready to compile.",
    });

    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    renderCard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    await waitFor(() => {
      const toggleBtn = screen.getByRole("button", { name: /hide prompts/i });
      expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    });
  });
});

// ---------------------------------------------------------------------------
// FE-06 — template API call (TEST-03 scenario 2)
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — template API call on prompt toggle", () => {
  it("calls getWorkflowTemplate with the template slug after opening the panel", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Artifact is staged and ready.",
    });

    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    renderCard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    await waitFor(() => {
      expect(mockGetTemplate).toHaveBeenCalledWith("compile_v1");
    });
  });

  it("does NOT call the template API before the panel is opened", async () => {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Artifact is staged and ready.",
    });

    renderCard();

    // Wait for the recommendation fetch to complete but do NOT click the toggle
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    expect(mockGetTemplate).not.toHaveBeenCalled();
    expect(mockListTemplates).not.toHaveBeenCalled();
  });

  it("falls back to listWorkflowTemplates when getWorkflowTemplate throws", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready.",
    });

    // First call (direct slug fetch) throws — triggers fallback list
    mockGetTemplate.mockRejectedValueOnce(new Error("slug is not an ID"));
    mockListTemplates.mockResolvedValueOnce([makeCompileTemplate()]);

    renderCard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    await waitFor(() => {
      expect(mockListTemplates).toHaveBeenCalled();
    });

    // Prompts should still render after fallback
    await waitFor(() => {
      expect(screen.getByRole("list", { name: /template prompts/i })).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// FE-06 — placeholder substitution (TEST-03 scenario 3)
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — prompt placeholder substitution", () => {
  it("substitutes {{artifact_title}} with the provided artifactTitle", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready to compile.",
    });

    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    renderCardWithContext({
      artifactTitle: "Distributed Systems Overview",
      artifactType: "concept",
      artifactTags: ["distributed", "systems", "caching"],
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    // The title appears in one or more rendered prompts (use getAllByText)
    await waitFor(() => {
      const matches = screen.getAllByText(/Distributed Systems Overview/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("substitutes {{artifact_type}} with the provided artifactType", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready.",
    });

    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    renderCardWithContext({
      artifactTitle: "My Article",
      artifactType: "concept",
      artifactTags: [],
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    // The first prompt's <pre> should contain "type: concept"
    await waitFor(() => {
      expect(screen.getByText(/type: concept/)).toBeInTheDocument();
    });
  });

  it("substitutes {{tags}} with a comma-joined list of artifact tags", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready.",
    });

    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    renderCardWithContext({
      artifactTitle: "My Article",
      artifactType: "note",
      artifactTags: ["distributed", "systems", "caching"],
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    await waitFor(() => {
      // Tags placeholder renders as "distributed, systems, caching"
      expect(screen.getByText(/distributed, systems, caching/)).toBeInTheDocument();
    });
  });

  it("renders empty string for {{artifact_title}} when artifactTitle is not provided", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready.",
    });

    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    // No context props — all placeholders resolve to empty
    renderCard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    // Prompt list renders; the placeholder for title becomes ""
    await waitFor(() => {
      expect(screen.getByRole("list", { name: /template prompts/i })).toBeInTheDocument();
    });

    // Verify the raw placeholder string "{{artifact_title}}" is NOT visible
    expect(screen.queryByText(/\{\{artifact_title\}\}/)).not.toBeInTheDocument();
  });

  it("renders each prompt's label in the panel header", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready.",
    });

    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    renderCardWithContext();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    await waitFor(() => {
      expect(screen.getByText("Compilation brief")).toBeInTheDocument();
      expect(screen.getByText("Lint check")).toBeInTheDocument();
    });
  });

  it("renders a 'No prompts available' message when the template has no prompts block", async () => {
    const user = userEvent.setup();

    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready.",
    });

    // Template with no prompts: section
    mockGetTemplate.mockResolvedValueOnce({
      ...makeCompileTemplate(),
      yaml_content: "label: Full Compile\nparams: []\n",
    });

    renderCardWithContext();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no prompts available/i),
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// FE-06 — copy button (TEST-03 scenario 4)
//
// @testing-library/user-event v14 installs its own Clipboard stub on
// window.navigator.clipboard during userEvent.setup(). We spy on the stub's
// writeText method to capture call arguments for assertions.
//
// The spy is created BEFORE clicking the Copy button (after the prompts panel
// is open) so all clipboard interactions during the test are captured.
// ---------------------------------------------------------------------------

describe("RoutingRecommendationCard — copy button", () => {
  /**
   * Open the card, wait for the prompts panel, and return the copy buttons.
   * Call userEvent.setup() BEFORE this helper so user-event's clipboard stub
   * is already installed when the spy is set up.
   */
  async function openPromptPanel(
    user: ReturnType<typeof userEvent.setup>,
    options: Parameters<typeof renderCardWithContext>[0] = {},
  ) {
    mockGetRecommendation.mockResolvedValueOnce({
      template: "compile_v1",
      rationale: "Ready to compile.",
    });
    mockGetTemplate.mockResolvedValueOnce(makeCompileTemplate());

    if (Object.keys(options).length > 0) {
      renderCardWithContext(options);
    } else {
      renderCard();
    }

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /view prompts/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /view prompts/i }));

    await waitFor(() => {
      expect(screen.getByRole("list", { name: /template prompts/i })).toBeInTheDocument();
    });
  }

  it("clicking Copy calls navigator.clipboard.writeText with the substituted text", async () => {
    const user = userEvent.setup();

    await openPromptPanel(user, {
      artifactTitle: "Distributed Systems Overview",
      artifactType: "concept",
      artifactTags: ["distributed", "systems", "caching"],
    });

    // Spy on the clipboard stub that user-event installed during setup()
    const writeTextSpy = jest.spyOn(window.navigator.clipboard, "writeText");

    const copyButtons = screen.getAllByRole("button", { name: /copy prompt text/i });
    expect(copyButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(copyButtons[0]);

    expect(writeTextSpy).toHaveBeenCalledTimes(1);

    // Capture the text that was written to the clipboard
    const copiedText = writeTextSpy.mock.calls[0][0];

    // Placeholders must be substituted
    expect(copiedText).toContain("Distributed Systems Overview");
    expect(copiedText).toContain("concept");
    expect(copiedText).toContain("distributed, systems, caching");

    // Raw placeholder syntax must not be present
    expect(copiedText).not.toContain("{{artifact_title}}");
    expect(copiedText).not.toContain("{{artifact_type}}");
    expect(copiedText).not.toContain("{{tags}}");

    writeTextSpy.mockRestore();
  });

  it("different prompts write different text to the clipboard", async () => {
    const user = userEvent.setup();

    await openPromptPanel(user, {
      artifactTitle: "Redis Deep Dive",
      artifactType: "entity",
      artifactTags: ["redis", "caching"],
    });

    const writeTextSpy = jest.spyOn(window.navigator.clipboard, "writeText");

    const copyButtons = screen.getAllByRole("button", { name: /copy prompt text/i });
    // The fixture has two prompts
    expect(copyButtons.length).toBe(2);

    await user.click(copyButtons[0]);
    const firstCopied = writeTextSpy.mock.calls[0][0];

    await user.click(copyButtons[1]);
    const secondCopied = writeTextSpy.mock.calls[1][0];

    // Both contain the artifact title but have different content
    expect(firstCopied).toContain("Redis Deep Dive");
    expect(secondCopied).toContain("Redis Deep Dive");
    expect(firstCopied).not.toBe(secondCopied);

    writeTextSpy.mockRestore();
  });

  it("copy button shows 'Copied!' feedback after clicking", async () => {
    const user = userEvent.setup();

    await openPromptPanel(user);

    const copyButtons = screen.getAllByRole("button", { name: /copy prompt text/i });
    await user.click(copyButtons[0]);

    // After click the aria-label transitions to "Copied!"
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /copied!/i }).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it("clipboard receives empty-string substitutions when no artifact context is provided", async () => {
    const user = userEvent.setup();

    // renderCard() without context — all placeholders resolve to ""
    await openPromptPanel(user);

    const writeTextSpy = jest.spyOn(window.navigator.clipboard, "writeText");

    const copyButtons = screen.getAllByRole("button", { name: /copy prompt text/i });
    await user.click(copyButtons[0]);

    expect(writeTextSpy).toHaveBeenCalledTimes(1);

    const copiedText = writeTextSpy.mock.calls[0][0];

    // Raw placeholder syntax must not be present
    expect(copiedText).not.toContain("{{artifact_title}}");
    expect(copiedText).not.toContain("{{artifact_type}}");
    expect(copiedText).not.toContain("{{tags}}");

    writeTextSpy.mockRestore();
  });
});
