/**
 * Library component barrel — stable export path for P5-03/P5-04/P5-05.
 *
 * Filtered-view screens (Research/Blog/Projects) import from here to reuse
 * Library card, filter bar, and pagination without coupling directly to the
 * ui/ internals.
 *
 * Taxonomy-redesign P5-02.
 */

// ArtifactCard — primary card component for all artifact list views
export { ArtifactCard } from "@/components/ui/artifact-card";

// LibraryFilterBar — filter bar with lockedFacet support for filtered views
export { LibraryFilterBar, useLensFilterUrlSync } from "@/components/ui/library-filter-bar";

// Hook — data fetching with facet + date range support
export {
  useLibraryArtifacts,
  DEFAULT_LIBRARY_FILTERS,
} from "@/hooks/useLibraryArtifacts";

// Types
export type { LibraryFilters } from "@/hooks/useLibraryArtifacts";
