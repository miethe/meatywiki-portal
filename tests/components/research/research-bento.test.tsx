/**
 * Research Home bento component tests (DP4-02c).
 *
 * Covers:
 *   FeaturedTopicsGrid
 *     - Renders section heading
 *     - Shows skeleton cards + v1.6 notice when no topics prop provided
 *     - Renders topic cards when topics prop is supplied
 *     - Empty state when empty array supplied
 *
 *   EvidencePulsePanel
 *     - Renders section heading + both sub-section headings
 *     - Shows skeletons + notices when no data props provided
 *     - Renders evidence rows when items supplied
 *     - Shows empty state for each feed when empty arrays supplied
 *
 *   CrossEntitySynthesisTabs
 *     - Renders section heading + tab list
 *     - Shows skeletons + notice when no items prop
 *     - Tab switching updates active tab aria-selected
 *     - Renders synthesis rows when items prop supplied
 *
 *   TopicScopeDropdown
 *     - Renders label + select
 *     - Select is disabled (endpoint missing v1.6)
 *     - Shows v1.6 notice
 *
 * Uses renderWithProviders (thin wrapper — no external providers needed for
 * these pure presentational components).
 */

import React from "react";
import { renderWithProviders, screen } from "../../utils/render";
import { userEvent } from "../../utils/userEvent";

import { FeaturedTopicsGrid } from "@/components/research/FeaturedTopicsGrid";
import { EvidencePulsePanel } from "@/components/research/EvidencePulsePanel";
import { CrossEntitySynthesisTabs } from "@/components/research/CrossEntitySynthesisTabs";
import { TopicScopeDropdown } from "@/components/research/TopicScopeDropdown";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TOPIC_FIXTURE = [
  {
    id: "01HXYZ0000000000000000001",
    title: "Quantum Computing Fundamentals",
    subtype: "topic",
    article_count: 12,
    ranking_score: 0.85,
    snippet: "An overview of quantum computing basics.",
  },
  {
    id: "01HXYZ0000000000000000002",
    title: "Neural Architecture Search",
    subtype: "concept",
    article_count: 7,
    ranking_score: 0.5,
  },
];

const EVIDENCE_FIXTURE = [
  {
    id: "01HXYZ0000000000000000010",
    title: "Evidence A",
    subtype: "evidence",
    updated: "2026-04-20T00:00:00Z",
  },
];

const CONTRADICTION_FIXTURE = [
  {
    id: "01HXYZ0000000000000000020",
    title: "Contradicting Claim",
    subtype: "claim",
    edge_count: 2,
    updated: "2026-04-19T00:00:00Z",
  },
];

const SYNTHESIS_FIXTURE = [
  {
    id: "01HXYZ0000000000000000030",
    title: "Synthesis: Quantum + ML",
    subtype: "synthesis",
    scope: "concept_entity" as const,
    source_count: 4,
    snippet: "Cross-entity synthesis bridging quantum and ML concepts.",
  },
  {
    id: "01HXYZ0000000000000000031",
    title: "Synthesis: All domains",
    subtype: "synthesis",
    scope: "all" as const,
    source_count: 2,
  },
];

// ---------------------------------------------------------------------------
// FeaturedTopicsGrid tests
// ---------------------------------------------------------------------------

describe("FeaturedTopicsGrid", () => {
  it("renders the section heading", () => {
    renderWithProviders(<FeaturedTopicsGrid />);
    expect(
      screen.getByRole("heading", { name: /featured topics/i }),
    ).toBeInTheDocument();
  });

  it("shows skeleton grid with v1.6 notice when no topics prop", () => {
    renderWithProviders(<FeaturedTopicsGrid />);
    // v1.6 badge is present
    expect(screen.getByText("v1.6")).toBeInTheDocument();
    // endpoint notice
    expect(
      screen.getByText(/GET \/api\/research\/featured-topics/),
    ).toBeInTheDocument();
    // skeleton list is busy
    expect(screen.getByRole("list", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders topic cards when topics prop is supplied", () => {
    renderWithProviders(<FeaturedTopicsGrid topics={TOPIC_FIXTURE} />);
    expect(
      screen.getByRole("link", { name: /quantum computing fundamentals/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /neural architecture search/i }),
    ).toBeInTheDocument();
  });

  it("shows trending badge for high-ranking topics", () => {
    renderWithProviders(<FeaturedTopicsGrid topics={TOPIC_FIXTURE} />);
    expect(screen.getByLabelText(/trending topic/i)).toBeInTheDocument();
  });

  it("shows empty state when empty array supplied", () => {
    renderWithProviders(<FeaturedTopicsGrid topics={[]} />);
    expect(
      screen.getByText(/no featured topics yet/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EvidencePulsePanel tests
// ---------------------------------------------------------------------------

describe("EvidencePulsePanel", () => {
  it("renders the Evidence Pulse section heading", () => {
    renderWithProviders(<EvidencePulsePanel />);
    expect(
      screen.getByRole("heading", { name: /evidence pulse/i }),
    ).toBeInTheDocument();
  });

  it("renders both feed sub-headings", () => {
    renderWithProviders(<EvidencePulsePanel />);
    expect(screen.getByRole("heading", { name: /new evidence/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /contradictions/i })).toBeInTheDocument();
  });

  it("shows v1.6 notices for missing endpoints", () => {
    renderWithProviders(<EvidencePulsePanel />);
    expect(
      screen.getByText(/GET \/api\/research\/evidence-pulse\/new/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/GET \/api\/research\/evidence-pulse\/contradictions/),
    ).toBeInTheDocument();
  });

  it("renders evidence rows when newEvidence supplied", () => {
    renderWithProviders(
      <EvidencePulsePanel
        newEvidence={EVIDENCE_FIXTURE}
        contradictions={[]}
      />,
    );
    expect(
      screen.getByRole("link", { name: /evidence a/i }),
    ).toBeInTheDocument();
  });

  it("renders contradiction rows with edge count badge", () => {
    renderWithProviders(
      <EvidencePulsePanel
        newEvidence={[]}
        contradictions={CONTRADICTION_FIXTURE}
      />,
    );
    expect(
      screen.getByRole("link", { name: /contradicting claim/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/2 contradicting edges/i)).toBeInTheDocument();
  });

  it("shows empty state for each feed when empty arrays supplied", () => {
    renderWithProviders(
      <EvidencePulsePanel newEvidence={[]} contradictions={[]} />,
    );
    expect(screen.getByText(/no new evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/no contradictions detected/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CrossEntitySynthesisTabs tests
// ---------------------------------------------------------------------------

describe("CrossEntitySynthesisTabs", () => {
  it("renders the section heading", () => {
    renderWithProviders(<CrossEntitySynthesisTabs />);
    expect(
      screen.getByRole("heading", { name: /cross-entity synthesis/i }),
    ).toBeInTheDocument();
  });

  it("renders the tab list with All / Concept-Entity / Concept-Topic tabs", () => {
    renderWithProviders(<CrossEntitySynthesisTabs />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /concept.*entity/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /concept.*topic/i })).toBeInTheDocument();
  });

  it("shows v1.6 notice and skeleton when no items prop", () => {
    renderWithProviders(<CrossEntitySynthesisTabs />);
    expect(screen.getByText("v1.6")).toBeInTheDocument();
    expect(
      screen.getByText(/GET \/api\/research\/cross-entity-synthesis/),
    ).toBeInTheDocument();
  });

  it("renders synthesis rows when items prop supplied", () => {
    renderWithProviders(<CrossEntitySynthesisTabs items={SYNTHESIS_FIXTURE} />);
    expect(
      screen.getByRole("link", { name: /synthesis: quantum \+ ml/i }),
    ).toBeInTheDocument();
  });

  it("switches tab aria-selected on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CrossEntitySynthesisTabs items={SYNTHESIS_FIXTURE} />);

    const ceTab = screen.getByRole("tab", { name: /concept.*entity/i });
    expect(ceTab).toHaveAttribute("aria-selected", "false");

    await user.click(ceTab);
    expect(ceTab).toHaveAttribute("aria-selected", "true");
  });

  it("filters items by tab scope on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CrossEntitySynthesisTabs items={SYNTHESIS_FIXTURE} />);

    // Before: both items visible on "All" tab
    expect(
      screen.getByRole("link", { name: /synthesis: quantum \+ ml/i }),
    ).toBeInTheDocument();

    // Click Concept ↔ Entity — only concept_entity item should appear
    const ceTab = screen.getByRole("tab", { name: /concept.*entity/i });
    await user.click(ceTab);

    expect(
      screen.getByRole("link", { name: /synthesis: quantum \+ ml/i }),
    ).toBeInTheDocument();
    // The "all" scoped item should not be rendered
    expect(
      screen.queryByRole("link", { name: /synthesis: all domains/i }),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TopicScopeDropdown tests
// ---------------------------------------------------------------------------

describe("TopicScopeDropdown", () => {
  it("renders the topic label", () => {
    const onChange = jest.fn();
    renderWithProviders(
      <TopicScopeDropdown onChange={onChange} />,
    );
    expect(screen.getByLabelText(/filter by topic/i)).toBeInTheDocument();
  });

  it("select is disabled with coming-in-v1.6 notice", () => {
    const onChange = jest.fn();
    renderWithProviders(
      <TopicScopeDropdown onChange={onChange} />,
    );
    const select = screen.getByRole("combobox", { name: /filter by topic/i });
    expect(select).toBeDisabled();
    expect(
      screen.getByText(/GET \/api\/topics/),
    ).toBeInTheDocument();
  });
});
