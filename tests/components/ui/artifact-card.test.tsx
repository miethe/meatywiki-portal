/**
 * ArtifactCard — Agent Metadata section tests (P7-03, agent-authored-artifacts).
 *
 * Scenarios:
 *  1. All three hint fields present → "Agent Metadata" section renders with all rows
 *  2. No hint fields → "Agent Metadata" section is absent
 *  3. Partial hints (only automation_source) → only that row renders
 *  4. Partial hints (only agent_origin) → only that row renders
 *  5. Partial hints (only routing_workspace) → only that row renders
 *  6. null hint fields → treated as absent (no row, no "null" text)
 *  7. Compact variant → section not shown even when hints are present
 *  8. Inbox mode → section not shown (inbox render path is separate)
 *  9. No crash when API response lacks hint fields entirely
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ArtifactCard as ArtifactCardType } from "@/types/artifact";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setPointerType, resetMatchMedia } from "../../mocks/match-media";

// ArtifactCard renders InfoTooltip which uses usePointerType → window.matchMedia.
// Stub it as "fine" (mouse) for all tests in this file.
beforeEach(() => {
  setPointerType("fine");
});

afterEach(() => {
  resetMatchMedia();
});

// ---------------------------------------------------------------------------
// Minimal ArtifactCard fixture
// ---------------------------------------------------------------------------

function makeArtifact(overrides: Partial<ArtifactCardType> = {}): ArtifactCardType {
  return {
    id: "01HXYZ0000000000000000001",
    workspace: "library",
    type: "concept",
    title: "Test Artifact",
    status: "active",
    file_path: "wiki/concepts/test-artifact.md",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

/**
 * ArtifactCard uses InfoTooltip (Radix Tooltip) + ActivityHistoryTooltip
 * (React Query) internally. Both providers must be present.
 */
function renderCard(
  artifactOverrides: Partial<ArtifactCardType> = {},
  props: Partial<React.ComponentProps<typeof ArtifactCard>> = {},
) {
  const artifact = makeArtifact(artifactOverrides);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <ArtifactCard artifact={artifact} {...props} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Scenario 1: All three hint fields present
// ---------------------------------------------------------------------------

describe("ArtifactCard — Agent Metadata section with all hints", () => {
  it("renders 'Agent Metadata' section header when all hint fields are present", () => {
    renderCard({
      automation_source: "prd-synthesis-workflow",
      agent_origin: "claude-code",
      routing_workspace: "projects",
    });

    expect(screen.getByText("Agent Metadata")).toBeInTheDocument();
  });

  it("renders 'Automation Source' row with correct value", () => {
    renderCard({
      automation_source: "prd-synthesis-workflow",
      agent_origin: "claude-code",
      routing_workspace: "projects",
    });

    expect(screen.getByText("Automation Source:")).toBeInTheDocument();
    expect(screen.getByText("prd-synthesis-workflow")).toBeInTheDocument();
  });

  it("renders 'Agent Origin' row with correct value", () => {
    renderCard({
      automation_source: "prd-synthesis-workflow",
      agent_origin: "claude-code",
      routing_workspace: "projects",
    });

    expect(screen.getByText("Agent Origin:")).toBeInTheDocument();
    expect(screen.getByText("claude-code")).toBeInTheDocument();
  });

  it("renders 'Routing Workspace' row with correct value", () => {
    renderCard({
      automation_source: "prd-synthesis-workflow",
      agent_origin: "claude-code",
      routing_workspace: "projects",
    });

    expect(screen.getByText("Routing Workspace:")).toBeInTheDocument();
    expect(screen.getByText("projects")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: No hint fields → section absent
// ---------------------------------------------------------------------------

describe("ArtifactCard — Agent Metadata absent when no hints", () => {
  it("does not render 'Agent Metadata' when no hint fields are present", () => {
    renderCard(); // no automation_source, agent_origin, or routing_workspace

    expect(screen.queryByText("Agent Metadata")).not.toBeInTheDocument();
  });

  it("does not render any hint label rows when no hints are present", () => {
    renderCard();

    expect(screen.queryByText("Automation Source:")).not.toBeInTheDocument();
    expect(screen.queryByText("Agent Origin:")).not.toBeInTheDocument();
    expect(screen.queryByText("Routing Workspace:")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Partial hints — only automation_source
// ---------------------------------------------------------------------------

describe("ArtifactCard — Agent Metadata partial: only automation_source", () => {
  it("renders section header and only the automation_source row", () => {
    renderCard({ automation_source: "prd-synthesis-workflow" });

    expect(screen.getByText("Agent Metadata")).toBeInTheDocument();
    expect(screen.getByText("Automation Source:")).toBeInTheDocument();
    expect(screen.queryByText("Agent Origin:")).not.toBeInTheDocument();
    expect(screen.queryByText("Routing Workspace:")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Partial hints — only agent_origin
// ---------------------------------------------------------------------------

describe("ArtifactCard — Agent Metadata partial: only agent_origin", () => {
  it("renders section header and only the agent_origin row", () => {
    renderCard({ agent_origin: "claude-code" });

    expect(screen.getByText("Agent Metadata")).toBeInTheDocument();
    expect(screen.getByText("Agent Origin:")).toBeInTheDocument();
    expect(screen.queryByText("Automation Source:")).not.toBeInTheDocument();
    expect(screen.queryByText("Routing Workspace:")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Partial hints — only routing_workspace
// ---------------------------------------------------------------------------

describe("ArtifactCard — Agent Metadata partial: only routing_workspace", () => {
  it("renders section header and only the routing_workspace row", () => {
    renderCard({ routing_workspace: "projects" });

    expect(screen.getByText("Agent Metadata")).toBeInTheDocument();
    expect(screen.getByText("Routing Workspace:")).toBeInTheDocument();
    expect(screen.queryByText("Automation Source:")).not.toBeInTheDocument();
    expect(screen.queryByText("Agent Origin:")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: null hint fields → treated as absent
// ---------------------------------------------------------------------------

describe("ArtifactCard — null hint fields are treated as absent", () => {
  it("does not render section when all hint fields are explicitly null", () => {
    renderCard({
      automation_source: null,
      agent_origin: null,
      routing_workspace: null,
    });

    expect(screen.queryByText("Agent Metadata")).not.toBeInTheDocument();
  });

  it("does not show 'null' or 'N/A' text in the card", () => {
    renderCard({
      automation_source: null,
      agent_origin: null,
      routing_workspace: null,
    });

    // Ensure no raw null/N/A placeholders appear
    expect(screen.queryByText("null")).not.toBeInTheDocument();
    expect(screen.queryByText("N/A")).not.toBeInTheDocument();
  });

  it("renders only present non-null field when one is null and one is set", () => {
    renderCard({
      automation_source: "prd-synthesis-workflow",
      agent_origin: null,
    });

    expect(screen.getByText("Agent Metadata")).toBeInTheDocument();
    expect(screen.getByText("Automation Source:")).toBeInTheDocument();
    expect(screen.queryByText("Agent Origin:")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Compact variant — section not shown
// ---------------------------------------------------------------------------

describe("ArtifactCard — compact variant suppresses Agent Metadata", () => {
  it("does not render Agent Metadata section in compact displayVariant", () => {
    renderCard(
      {
        automation_source: "prd-synthesis-workflow",
        agent_origin: "claude-code",
        routing_workspace: "projects",
      },
      { displayVariant: "compact" },
    );

    expect(screen.queryByText("Agent Metadata")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 8: Inbox mode — section not shown (separate render path)
// ---------------------------------------------------------------------------

describe("ArtifactCard — inbox mode suppresses Agent Metadata", () => {
  it("does not render Agent Metadata section when inboxGroup is set", () => {
    renderCard(
      {
        automation_source: "prd-synthesis-workflow",
        agent_origin: "claude-code",
        routing_workspace: "projects",
      },
      { inboxGroup: "new" },
    );

    expect(screen.queryByText("Agent Metadata")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 9: No crash when API response lacks hint fields entirely
// ---------------------------------------------------------------------------

describe("ArtifactCard — no crash when hint fields are undefined", () => {
  it("renders the title and no Agent Metadata section when artifact has no hint fields at all", () => {
    // makeArtifact does not include hint fields — simulates an API response
    // from a backend that has not yet shipped these columns.
    renderCard(); // must not throw
    expect(screen.getByText("Test Artifact")).toBeInTheDocument();
    expect(screen.queryByText("Agent Metadata")).not.toBeInTheDocument();
  });
});
