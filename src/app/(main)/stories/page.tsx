/**
 * Stories — op story catalog list.
 *
 * Server component: SSR-fetches initial page with no filters; passes to
 * StoriesListClient for interactive filtering, search, and navigation.
 * Follows the decisions/projects pattern.
 *
 * URL: /stories
 */

import { listStories } from "@/lib/api/stories";
import type { StoriesEnvelope } from "@/types/stories";
import { StoriesListClient } from "./StoriesListClient";

// ---------------------------------------------------------------------------
// Error state (shown when SSR fetch fails)
// ---------------------------------------------------------------------------

function StoriesError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stories</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Op story catalog</p>
      </div>
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
      >
        <p className="text-sm font-medium text-destructive">
          Could not load stories
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Refresh the page or check that the backend is running.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function StoriesPage() {
  let initialData: StoriesEnvelope;
  let fetchError: string | null = null;

  try {
    initialData = await listStories({ limit: 50 });
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Unexpected error fetching stories";
    initialData = { data: [], cursor: null };
  }

  if (fetchError) {
    return <StoriesError message={fetchError} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <StoriesListClient initialData={initialData} />
    </div>
  );
}
