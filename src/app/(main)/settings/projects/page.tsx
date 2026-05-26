/**
 * Project Directories Settings Page — /settings/projects
 *
 * Manages the list of registered project directories used by the
 * Cross-Project Knowledge Hub connector.
 *
 * Accessible from the Settings main page via "Manage" link in the
 * "Project Directories" section.
 *
 * Renders:
 *   - ProjectDirectoriesTable (list + inline toggles + per-row sync)
 *   - "Add Directory" button → ProjectDirModal (create mode)
 *   - ProjectDirModal in edit mode (triggered by table's Edit action)
 *
 * Shell: Standard Archival (Settings sub-page).
 * Traces: Cross-Project Knowledge Hub v2 / P5-04.
 */

import Link from "next/link";
import { ProjectDirectoriesClient } from "./ProjectDirectoriesClient";

export default function ProjectDirectoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link
          href="/settings"
          className="transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Settings
        </Link>
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span aria-current="page" className="font-medium text-foreground">
          Project Directories
        </span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Project Directories
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Register local project directories for the Cross-Project Knowledge Hub
          connector. Synced artifacts are ingested into the vault under the
          configured workspace.
        </p>
      </div>

      {/* Client island — all interactive state lives here */}
      <ProjectDirectoriesClient />
    </div>
  );
}
