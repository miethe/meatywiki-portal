/**
 * Story types — op story catalog.
 *
 * Mirrors the backend StoryListItem / StoryDetail contract exactly.
 * lifecycle_state vocab: new|backlog|hold|held|drafted|pr_opened|archived|published
 * sensitivity.level ∈ public|internal|blocked
 */

// ---------------------------------------------------------------------------
// Nested shapes
// ---------------------------------------------------------------------------

export interface StorySensitivity {
  level: "public" | "internal" | "blocked";
  agent_access: string;
}

export interface StoryScrub {
  status: string;
  issue_count: number;
  summary: string;
}

export interface StoryPublication {
  state: string;
  draft_pr_url: string | null;
  published_url: string | null;
  post_slug: string | null;
}

export interface StorySource {
  safe_ref: string | null;
  safe_uri: string | null;
}

export interface StorySync {
  synced_at: string;
  source_system: string;
}

// ---------------------------------------------------------------------------
// Lifecycle state enum
// ---------------------------------------------------------------------------

export type LifecycleState =
  | "new"
  | "backlog"
  | "hold"
  | "held"
  | "drafted"
  | "pr_opened"
  | "archived"
  | "published";

// ---------------------------------------------------------------------------
// StoryListItem — returned in list endpoint
// ---------------------------------------------------------------------------

export interface StoryListItem {
  story_id: string;
  title: string | null;
  project_id: string | null;
  lifecycle_state: LifecycleState;
  story_status: string;
  source_type: string;
  date: string | null;
  domains: string[];
  sensitivity: StorySensitivity;
  scrub: StoryScrub;
  publication: StoryPublication;
  source: StorySource;
  sync: StorySync;
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// StoryDetail — returned in detail endpoint (extends StoryListItem)
// ---------------------------------------------------------------------------

export interface StoryLifecycle {
  status: string;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
  reason_code: string | null;
}

export interface StoryRelatedRefs {
  ccdash_session: string | null;
  ccdash_feature: string | null;
}

export interface StoryDetail extends StoryListItem {
  lifecycle: StoryLifecycle;
  related_refs: StoryRelatedRefs;
  routing_tags: string[];
  reason: string | null;
  /**
   * Rendered AAR markdown body — the narrative content of the op-story file,
   * surfaced by GET /api/stories/{id} after reading the vault artifact body.
   * Null when the vault record has no body or the record cannot be loaded.
   * Detail endpoint only; NOT present on StoryListItem.
   */
  body?: string | null;
}

// ---------------------------------------------------------------------------
// API envelope + filter shape
// ---------------------------------------------------------------------------

export interface StoriesEnvelope {
  data: StoryListItem[];
  cursor: string | null;
}

export interface StoryFilters {
  status?: string;
  project?: string;
  source_type?: string;
  sensitivity?: string;
  publication?: string;
  q?: string;
  /** ISO YYYY-MM-DD inclusive lower bound */
  date_from?: string;
  /** ISO YYYY-MM-DD inclusive upper bound */
  date_to?: string;
  limit?: number;
  cursor?: string;
}
