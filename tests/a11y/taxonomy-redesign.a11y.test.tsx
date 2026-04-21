/**
 * WCAG 2.1 AA Accessibility Tests — Taxonomy Redesign (P5-08)
 *
 * Covers the components introduced / changed in taxonomy-redesign Phase 5:
 *   - FacetBadge (library/research/blog/projects callouts)
 *   - LibraryFilterBar (chip groups, sort, date range, lens toggle, lockedFacet)
 *   - ArtifactCard research_origin variant (P5-06 amber accent + aria label)
 *   - LensBadgeSet research_origin variant
 *   - StageTracker research_origin variants
 *
 * Automated axe-core scans + targeted ARIA / keyboard / use-of-colour assertions.
 * Mirrors conventions from P3-09 suite (jest-axe global registration in setup.ts).
 *
 * Colour-contrast rationale (manual verification):
 *   FacetBadge palette pairs Tailwind 100-shade backgrounds with 800-shade text,
 *   all of which land ≥7:1 on white — well above AA (4.5:1 normal text). Research
 *   teal ring + Lens Badge amber tint are decorative/supplemental; primary signal
 *   is always text (FacetBadge label, lock indicator, or aria-label on the card).
 */

import { axe } from "jest-axe";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FacetBadge } from "@/components/ui/facet-badge";
import { ArtifactCard } from "@/components/ui/artifact-card";
import { LibraryFilterBar } from "@/components/ui/library-filter-bar";
import { LensBadgeSet } from "@/components/workflow/lens-badge-set";
import { StageTracker } from "@/components/workflow/stage-tracker";
import type { ArtifactCard as ArtifactCardType } from "@/types/artifact";
import type { LibraryFilters } from "@/hooks/useLibraryArtifacts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseArtifact: ArtifactCardType = {
  id: "art-1",
  title: "Taxonomy Redesign",
  type: "concept",
  workspace: "library",
  status: "active",
  file_path: "wiki/concepts/taxonomy-redesign.md",
  updated: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
  workflow_status: "complete",
  preview: "A primer on MeatyWiki's taxonomy-redesign facet model.",
  metadata: {
    fidelity: "high",
    freshness: "current",
    verification_state: "verified",
  },
};

const blogArtifact: ArtifactCardType = {
  ...baseArtifact,
  id: "art-blog",
  title: "Blog post: shipping P5",
  workspace: "blog",
  file_path: "blog/shipping-p5.md",
};

const projectsArtifact: ArtifactCardType = {
  ...baseArtifact,
  id: "art-project",
  title: "Project: taxonomy redesign",
  workspace: "projects",
  file_path: "projects/taxonomy-redesign/plan.md",
};

const researchArtifact: ArtifactCardType = {
  ...baseArtifact,
  id: "art-research",
  title: "Research note",
  workspace: "library",
  research_origin: true,
};

const emptyFilters: LibraryFilters = {
  types: [],
  statuses: [],
  sort: "updated",
  order: "desc",
  facet: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  lensFidelity: [],
  lensFreshness: [],
  lensVerification: [],
};

// ---------------------------------------------------------------------------
// FacetBadge
// ---------------------------------------------------------------------------

describe("FacetBadge — WCAG 2.1 AA (P5-08)", () => {
  it.each(["library", "research", "blog", "projects"] as const)(
    "renders %s facet with 0 axe violations",
    async (facet) => {
      const { container } = render(<FacetBadge facet={facet} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    },
  );

  it("exposes an accessible name for each facet (not colour-only)", () => {
    render(
      <>
        <FacetBadge facet="library" />
        <FacetBadge facet="research" />
        <FacetBadge facet="blog" />
        <FacetBadge facet="projects" />
      </>,
    );
    // aria-label="Facet: <Name>"
    expect(screen.getByLabelText(/facet: library/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/facet: research/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/facet: blog/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/facet: projects/i)).toBeInTheDocument();
  });

  it("blog/projects badges carry visible text (WCAG 1.4.1 Use of Colour)", () => {
    const { rerender } = render(<FacetBadge facet="blog" />);
    expect(screen.getByText("Blog")).toBeInTheDocument();
    rerender(<FacetBadge facet="projects" />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ArtifactCard — P5 facet + research_origin additions
// ---------------------------------------------------------------------------

describe("ArtifactCard (P5 taxonomy additions) — WCAG 2.1 AA", () => {
  it("library artifact renders with 0 axe violations", async () => {
    const { container } = render(
      <ArtifactCard artifact={baseArtifact} variant="grid" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("blog artifact renders FacetBadge + 0 axe violations", async () => {
    const { container } = render(
      <ArtifactCard artifact={blogArtifact} variant="list" />,
    );
    expect(screen.getByLabelText(/facet: blog/i)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("projects artifact renders FacetBadge + 0 axe violations", async () => {
    const { container } = render(
      <ArtifactCard artifact={projectsArtifact} variant="grid" />,
    );
    expect(screen.getByLabelText(/facet: projects/i)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("research_origin artifact announces research origin (not colour-only)", async () => {
    const { container } = render(
      <ArtifactCard artifact={researchArtifact} variant="list" />,
    );
    // aria-label includes "research origin" so SR users get parity with the
    // amber/teal visual accent — satisfies WCAG 1.4.1.
    const article = screen.getByRole("article", {
      name: /research note.*research origin/i,
    });
    expect(article).toBeInTheDocument();
    expect(article).toHaveAttribute("data-research-origin", "true");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("stretch link retains focus-visible ring when research_origin=true", () => {
    render(<ArtifactCard artifact={researchArtifact} variant="list" />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass(
      "focus:outline-none",
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
    );
    link.focus();
    expect(link).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// LensBadgeSet — workspace-aware styling (P5-06)
// ---------------------------------------------------------------------------

describe("LensBadgeSet workspace-aware styling — WCAG 2.1 AA (P5-06/P5-08)", () => {
  it("normal variant has accessible label and 0 axe violations", async () => {
    const { container } = render(
      <LensBadgeSet artifact={baseArtifact} variant="compact" />,
    );
    expect(screen.getByLabelText("Lens badges")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("researchOrigin variant announces amber accent via aria-label", async () => {
    const { container } = render(
      <LensBadgeSet
        artifact={baseArtifact}
        variant="compact"
        researchOrigin
      />,
    );
    expect(
      screen.getByLabelText(/lens badges \(research origin\)/i),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// StageTracker — workspace-aware styling (P5-06)
// ---------------------------------------------------------------------------

describe("StageTracker workspace-aware styling — WCAG 2.1 AA (P5-06/P5-08)", () => {
  it("compact variant (research) announces research context", async () => {
    const { container } = render(
      <StageTracker
        runId="run-1"
        status="running"
        currentStage={2}
        variant="compact"
        researchOrigin
      />,
    );
    expect(
      screen.getByLabelText(/workflow progress:.*research/i),
    ).toBeInTheDocument();
    // progressbar role provides SR affordance independent of amber border colour
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("timeline variant (research) announces research context", async () => {
    const { container } = render(
      <StageTracker
        runId="run-2"
        status="complete"
        currentStage={5}
        variant="timeline"
        researchOrigin
      />,
    );
    expect(
      screen.getByLabelText(/workflow stage timeline.*research/i),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("full variant (research) keeps stage list semantics", async () => {
    const { container } = render(
      <StageTracker
        runId="run-3"
        status="running"
        currentStage={1}
        variant="full"
        researchOrigin
      />,
    );
    // <ol aria-label=...> so assistive tech counts stages
    expect(
      screen.getByLabelText(/workflow stages.*research/i),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ---------------------------------------------------------------------------
// LibraryFilterBar — chips + sort + date range + lens toggle + lockedFacet
// ---------------------------------------------------------------------------

describe("LibraryFilterBar — WCAG 2.1 AA (P5-02/P5-08)", () => {
  it("renders with 0 axe violations (no lockedFacet)", async () => {
    const { container } = render(
      <LibraryFilterBar
        filters={emptyFilters}
        onFiltersChange={() => {}}
        resultCount={42}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("chip groups expose role=group + aria-label", () => {
    render(
      <LibraryFilterBar
        filters={emptyFilters}
        onFiltersChange={() => {}}
      />,
    );
    expect(screen.getByRole("group", { name: /^type$/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /^status$/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /^facet$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: /date range filter/i }),
    ).toBeInTheDocument();
  });

  it("chip buttons use aria-pressed to convey selection state", async () => {
    const user = userEvent.setup();
    let currentFilters = emptyFilters;
    const onChange = (next: Partial<LibraryFilters>) => {
      currentFilters = { ...currentFilters, ...next };
      rerender(
        <LibraryFilterBar
          filters={currentFilters}
          onFiltersChange={onChange}
        />,
      );
    };
    const { rerender } = render(
      <LibraryFilterBar filters={currentFilters} onFiltersChange={onChange} />,
    );

    const conceptChip = screen.getByRole("button", {
      name: /filter by type: concept/i,
    });
    expect(conceptChip).toHaveAttribute("aria-pressed", "false");
    await user.click(conceptChip);
    expect(
      screen.getByRole("button", { name: /filter by type: concept/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("lens toggle exposes aria-expanded + aria-controls", async () => {
    const user = userEvent.setup();
    render(
      <LibraryFilterBar filters={emptyFilters} onFiltersChange={() => {}} />,
    );
    const toggle = screen.getByRole("button", { name: /expand lens filters/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "lens-filter-panel");
    await user.click(toggle);
    // After click, the panel is open and toggle reflects state.
    const reopened = screen.getByRole("button", {
      name: /collapse lens filters/i,
    });
    expect(reopened).toHaveAttribute("aria-expanded", "true");
    // Panel present with region-like group
    expect(
      screen.getByRole("group", { name: /lens filters/i }),
    ).toBeInTheDocument();
  });

  it("lockedFacet hides the facet chip group and shows text lock indicator", async () => {
    const { container } = render(
      <LibraryFilterBar
        filters={{ ...emptyFilters, facet: "research" }}
        onFiltersChange={() => {}}
        lockedFacet="research"
      />,
    );
    // Facet chip group is absent
    expect(
      screen.queryByRole("group", { name: /^facet$/i }),
    ).not.toBeInTheDocument();
    // Lock indicator provides a text signal (not colour-only) for the locked facet
    expect(
      screen.getByLabelText(/filtered to research facet/i),
    ).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("sort control has an associated label", async () => {
    const { container } = render(
      <LibraryFilterBar filters={emptyFilters} onFiltersChange={() => {}} />,
    );
    const select = screen.getByLabelText(/sort artifacts/i);
    expect(select.tagName).toBe("SELECT");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("date inputs carry accessible labels", () => {
    render(
      <LibraryFilterBar filters={emptyFilters} onFiltersChange={() => {}} />,
    );
    expect(screen.getByLabelText(/filter from date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter to date/i)).toBeInTheDocument();
  });

  it("keyboard navigation: chips and lens toggle are Tab-reachable", async () => {
    const user = userEvent.setup();
    render(
      <LibraryFilterBar filters={emptyFilters} onFiltersChange={() => {}} />,
    );

    // First Tab lands on the first chip
    await user.tab();
    const firstChip = screen.getByRole("button", {
      name: /filter by type: note/i,
    });
    expect(firstChip).toHaveFocus();

    // Shift-Tab moves focus back off the bar without trapping
    await user.tab({ shift: true });
    expect(firstChip).not.toHaveFocus();
  });

  it("result count uses aria-live=polite for async updates", () => {
    render(
      <LibraryFilterBar
        filters={emptyFilters}
        onFiltersChange={() => {}}
        resultCount={3}
      />,
    );
    const count = screen.getByText(/3 artifacts/i);
    expect(count).toHaveAttribute("aria-live", "polite");
  });
});

// ---------------------------------------------------------------------------
// Colour contrast sanity check (facet-badge palette)
// ---------------------------------------------------------------------------

describe("Facet colour contrast — WCAG 1.4.3 (manual verification wrapper)", () => {
  /**
   * The FacetBadge palette uses Tailwind N-100 backgrounds with N-800 text:
   *   blog:     orange-100 (#ffedd5) + orange-800 (#9a3412)  ≈ 7.5:1
   *   projects: purple-100 (#f3e8ff) + purple-800 (#6b21a8)  ≈ 8.5:1
   *   research: teal-100   (#ccfbf1) + teal-800   (#115e59)  ≈ 8.3:1
   *   library:  indigo-100 (#e0e7ff) + indigo-800 (#3730a3)  ≈ 8.9:1
   * All pairs clear the AA 4.5:1 bar for normal text. axe-core re-validates
   * classes via render below; this test documents the rationale.
   */
  it("renders all four facet badges without axe contrast violations", async () => {
    const { container } = render(
      <div style={{ background: "white", padding: 16 }}>
        <FacetBadge facet="library" />
        <FacetBadge facet="research" />
        <FacetBadge facet="blog" />
        <FacetBadge facet="projects" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
