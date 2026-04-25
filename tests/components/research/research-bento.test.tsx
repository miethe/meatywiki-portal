/**
 * Research Home bento component tests (DP4-02c / P4-04).
 *
 * Covers:
 *   FeaturedTopicsGrid
 *     - Renders section heading
 *     - Shows loading skeleton when useFeaturedTopics returns isLoading=true
 *     - Renders topic cards from hook data
 *     - Shows empty state when hook returns empty array
 *     - Shows trending badge for topics with activity_score > 0
 *     - Shows error state when hook returns isError
 *
 *   EvidencePulsePanel
 *     - Renders section heading + both sub-section headings
 *     - Shows skeletons + notices when no data props provided
 *     - Renders evidence rows when items supplied
 *     - Shows empty state for each feed when empty arrays supplied
 *
 *   CrossEntitySynthesisTabs (P4-08: live data via useCrossEntitySynthesis)
 *     - Renders section heading
 *     - Shows skeleton when hook isLoading
 *     - Empty state when no entries returned
 *     - Tab per entity + All tab when entries present
 *     - Tab switching updates active tab aria-selected
 *     - Filters by entity when entity tab clicked
 *     - Load more button visible/calls fetchNextPage
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
import type { UseCrossEntitySynthesisResult } from "@/hooks/useCrossEntitySynthesis";
import type {
  UseEvidencePulseNewResult,
  UseEvidencePulseContradictionsResult,
} from "@/hooks/useEvidencePulse";
import type { UseFeaturedTopicsResult } from "@/hooks/useFeaturedTopics";

// ---------------------------------------------------------------------------
// Hook mock — useFeaturedTopics
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useFeaturedTopics");

import { useFeaturedTopics } from "@/hooks/useFeaturedTopics";
const mockUseFeaturedTopics = useFeaturedTopics as jest.MockedFunction<
  typeof useFeaturedTopics
>;

const DEFAULT_FEATURED_TOPICS_RESULT: UseFeaturedTopicsResult = {
  topics: [],
  isLoading: false,
  isError: false,
  error: null,
};

function mockFeaturedTopicsHook(
  overrides: Partial<UseFeaturedTopicsResult> = {},
): void {
  mockUseFeaturedTopics.mockReturnValue({
    ...DEFAULT_FEATURED_TOPICS_RESULT,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Hook mock — useCrossEntitySynthesis
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useCrossEntitySynthesis");

import { useCrossEntitySynthesis } from "@/hooks/useCrossEntitySynthesis";
const mockUseCrossEntitySynthesis = useCrossEntitySynthesis as jest.MockedFunction<
  typeof useCrossEntitySynthesis
>;

function mockHook(overrides: Partial<UseCrossEntitySynthesisResult> = {}): void {
  mockUseCrossEntitySynthesis.mockReturnValue({
    entries: [],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    isError: false,
    error: null,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Hook mocks — useEvidencePulse
// ---------------------------------------------------------------------------

jest.mock("@/hooks/useEvidencePulse");

import {
  useEvidencePulseNew,
  useEvidencePulseContradictions,
} from "@/hooks/useEvidencePulse";
const mockUseEvidencePulseNew = useEvidencePulseNew as jest.MockedFunction<
  typeof useEvidencePulseNew
>;
const mockUseEvidencePulseContradictions =
  useEvidencePulseContradictions as jest.MockedFunction<
    typeof useEvidencePulseContradictions
  >;

const DEFAULT_NEW_RESULT: UseEvidencePulseNewResult = {
  items: [],
  total_count: 0,
  last_7_days: 0,
  prior_7_days: 0,
  isLoading: false,
  isError: false,
  error: null,
};

const DEFAULT_CONTRADICTIONS_RESULT: UseEvidencePulseContradictionsResult = {
  items: [],
  isLoading: false,
  isError: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Shared ArtifactCard factory
const makeArtifactCard = (id: string, title: string, subtype = "entity") => ({
  id,
  workspace: "wiki",
  type: "artifact",
  subtype,
  title,
  status: "compiled",
  schema_version: null,
  created: null,
  updated: "2026-04-20T00:00:00Z",
  file_path: `/wiki/${id}.md`,
  metadata: null,
  priority: null,
});

// FeaturedTopicItem extends ArtifactCard with activity_score
const TOPIC_FIXTURE = [
  {
    ...makeArtifactCard("01HXYZ0000000000000000001", "Quantum Computing Fundamentals", "topic"),
    activity_score: 0.85,
  },
  {
    ...makeArtifactCard("01HXYZ0000000000000000002", "Neural Architecture Search", "concept"),
    activity_score: 0.0,
  },
];

const EVIDENCE_FIXTURE = [
  makeArtifactCard("01HXYZ0000000000000000010", "Evidence A", "evidence"),
];

// EvidenceContradictionPair shape: { artifact_a: ArtifactCard, artifact_b: ArtifactCard }
const CONTRADICTION_FIXTURE = [
  {
    artifact_a: makeArtifactCard("01HXYZ0000000000000000020", "Contradicting Claim", "claim"),
    artifact_b: makeArtifactCard("01HXYZ0000000000000000021", "Original Claim", "claim"),
  },
];

// CrossEntitySynthesisEntry fixtures: { entity: ArtifactCard, syntheses: ArtifactCard[] }
const SYNTHESIS_FIXTURE = [
  {
    entity: makeArtifactCard("entity-001", "Quantum Computing"),
    syntheses: [
      makeArtifactCard("synth-001", "Synthesis: Quantum + ML", "synthesis"),
    ],
  },
  {
    entity: makeArtifactCard("entity-002", "Machine Learning"),
    syntheses: [
      makeArtifactCard("synth-002", "Synthesis: All domains", "synthesis"),
    ],
  },
];

// ---------------------------------------------------------------------------
// FeaturedTopicsGrid tests
// ---------------------------------------------------------------------------

describe("FeaturedTopicsGrid", () => {
  beforeEach(() => {
    mockFeaturedTopicsHook();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the section heading", () => {
    renderWithProviders(<FeaturedTopicsGrid />);
    expect(
      screen.getByRole("heading", { name: /featured topics/i }),
    ).toBeInTheDocument();
  });

  it("shows loading skeleton when isLoading is true", () => {
    mockFeaturedTopicsHook({ isLoading: true });
    renderWithProviders(<FeaturedTopicsGrid />);
    expect(screen.getByRole("list", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders topic cards when hook returns topics", () => {
    mockFeaturedTopicsHook({ topics: TOPIC_FIXTURE });
    renderWithProviders(<FeaturedTopicsGrid />);
    expect(
      screen.getByRole("link", { name: /quantum computing fundamentals/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /neural architecture search/i }),
    ).toBeInTheDocument();
  });

  it("shows trending badge for high-activity topics", () => {
    mockFeaturedTopicsHook({ topics: TOPIC_FIXTURE });
    renderWithProviders(<FeaturedTopicsGrid />);
    expect(screen.getByLabelText(/trending topic/i)).toBeInTheDocument();
  });

  it("shows empty state when hook returns empty array", () => {
    mockFeaturedTopicsHook({ topics: [] });
    renderWithProviders(<FeaturedTopicsGrid />);
    expect(screen.getByText(/no featured topics/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EvidencePulsePanel tests
// ---------------------------------------------------------------------------

describe("EvidencePulsePanel", () => {
  beforeEach(() => {
    mockUseEvidencePulseNew.mockReturnValue(DEFAULT_NEW_RESULT);
    mockUseEvidencePulseContradictions.mockReturnValue(DEFAULT_CONTRADICTIONS_RESULT);
  });

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

  it("shows skeleton loading state while fetching", () => {
    mockUseEvidencePulseNew.mockReturnValue({ ...DEFAULT_NEW_RESULT, isLoading: true });
    mockUseEvidencePulseContradictions.mockReturnValue({
      ...DEFAULT_CONTRADICTIONS_RESULT,
      isLoading: true,
    });
    renderWithProviders(<EvidencePulsePanel />);
    // Loading list is aria-busy
    expect(screen.getByRole("list", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders evidence rows when items available", () => {
    mockUseEvidencePulseNew.mockReturnValue({
      ...DEFAULT_NEW_RESULT,
      items: EVIDENCE_FIXTURE,
      total_count: 1,
    });
    renderWithProviders(<EvidencePulsePanel />);
    expect(
      screen.getByRole("link", { name: /evidence a/i }),
    ).toBeInTheDocument();
  });

  it("renders contradiction rows when items available", () => {
    mockUseEvidencePulseContradictions.mockReturnValue({
      ...DEFAULT_CONTRADICTIONS_RESULT,
      items: CONTRADICTION_FIXTURE,
    });
    renderWithProviders(<EvidencePulsePanel />);
    expect(
      screen.getByRole("link", { name: /contradicting claim vs original claim/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state for each feed when no data", () => {
    renderWithProviders(<EvidencePulsePanel />);
    expect(screen.getByText(/no new evidence in the last 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/no contradictions detected/i)).toBeInTheDocument();
  });

  it("shows total_count badge when evidence items exist", () => {
    mockUseEvidencePulseNew.mockReturnValue({
      ...DEFAULT_NEW_RESULT,
      items: EVIDENCE_FIXTURE,
      total_count: 3,
      last_7_days: 3,
      prior_7_days: 1,
    });
    renderWithProviders(<EvidencePulsePanel />);
    expect(screen.getByLabelText(/3 new evidence items/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CrossEntitySynthesisTabs tests
// ---------------------------------------------------------------------------

describe("CrossEntitySynthesisTabs", () => {
  beforeEach(() => {
    mockHook();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders the section heading", () => {
    renderWithProviders(<CrossEntitySynthesisTabs />);
    expect(
      screen.getByRole("heading", { name: /cross-entity synthesis/i }),
    ).toBeInTheDocument();
  });

  it("shows skeleton when isLoading is true", () => {
    mockHook({ isLoading: true });
    renderWithProviders(<CrossEntitySynthesisTabs />);
    expect(
      screen.getByRole("list", { name: /loading/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no entries returned", () => {
    mockHook({ entries: [] });
    renderWithProviders(<CrossEntitySynthesisTabs />);
    expect(screen.getByText(/no cross-entity syntheses found/i)).toBeInTheDocument();
  });

  it("renders All tab and one tab per entity when entries provided", () => {
    mockHook({ entries: SYNTHESIS_FIXTURE });
    renderWithProviders(<CrossEntitySynthesisTabs />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /quantum computing/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /machine learning/i })).toBeInTheDocument();
  });

  it("renders synthesis rows on All tab", () => {
    mockHook({ entries: SYNTHESIS_FIXTURE });
    renderWithProviders(<CrossEntitySynthesisTabs />);
    expect(
      screen.getByRole("link", { name: /synthesis: quantum \+ ml/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /synthesis: all domains/i }),
    ).toBeInTheDocument();
  });

  it("switches tab aria-selected on click", async () => {
    const user = userEvent.setup();
    mockHook({ entries: SYNTHESIS_FIXTURE });
    renderWithProviders(<CrossEntitySynthesisTabs />);

    const entityTab = screen.getByRole("tab", { name: /quantum computing/i });
    expect(entityTab).toHaveAttribute("aria-selected", "false");

    await user.click(entityTab);
    expect(entityTab).toHaveAttribute("aria-selected", "true");
  });

  it("filters to entity's syntheses when entity tab clicked", async () => {
    const user = userEvent.setup();
    mockHook({ entries: SYNTHESIS_FIXTURE });
    renderWithProviders(<CrossEntitySynthesisTabs />);

    await user.click(screen.getByRole("tab", { name: /quantum computing/i }));

    expect(
      screen.getByRole("link", { name: /synthesis: quantum \+ ml/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /synthesis: all domains/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Load more button when hasNextPage is true", () => {
    mockHook({ entries: SYNTHESIS_FIXTURE, hasNextPage: true });
    renderWithProviders(<CrossEntitySynthesisTabs />);
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("calls fetchNextPage when Load more is clicked", async () => {
    const user = userEvent.setup();
    const fetchNextPage = jest.fn();
    mockHook({ entries: SYNTHESIS_FIXTURE, hasNextPage: true, fetchNextPage });
    renderWithProviders(<CrossEntitySynthesisTabs />);

    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
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
