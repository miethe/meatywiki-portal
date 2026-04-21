/**
 * Library artifact card — re-export from the canonical ui/artifact-card component.
 *
 * P5-03, P5-04, P5-05 (Research/Blog/Projects filtered-view screens) should import
 * from this path rather than directly from src/components/ui/artifact-card to make
 * the dependency explicit and allow future Library-specific augmentation without
 * touching the shared ui component.
 *
 * Taxonomy-redesign P5-02. Stable re-export path for parallel agents.
 */

export { ArtifactCard } from "@/components/ui/artifact-card";
