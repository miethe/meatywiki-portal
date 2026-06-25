/**
 * Story detail page — server component wrapper.
 *
 * Fetches the story SSR; delegates rendering to StoryDetailClient.
 * Calls notFound() on 404 so Next.js renders the nearest not-found.tsx.
 *
 * URL: /stories/[id]
 */

import { notFound } from "next/navigation";
import { getStory } from "@/lib/api/stories";
import { ApiError } from "@/lib/api/client";
import { StoryDetailClient } from "./StoryDetailClient";

// ---------------------------------------------------------------------------
// Error state (non-404 fetch failure)
// ---------------------------------------------------------------------------

function StoryError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
    >
      <p className="text-sm font-medium text-destructive">
        Could not load story
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StoryDetailPage({ params }: Props) {
  const { id } = await params;

  try {
    const story = await getStory(id);
    return <StoryDetailClient story={story} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    const message =
      err instanceof Error ? err.message : "Unexpected error loading story";
    return <StoryError message={message} />;
  }
}
