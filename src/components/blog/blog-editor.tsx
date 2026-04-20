"use client";

/**
 * BlogEditor — GFM markdown editor with auto-save and compile trigger.
 *
 * Features:
 *   - Textarea-based GFM markdown editor (plain textarea; no external editor dep)
 *   - Auto-save every 30s via PATCH (debounced — only fires when content changed)
 *   - Manual Save button → immediate PATCH
 *   - Compile button → POST /api/blog/posts/:id/compile (via workflows) + StageTracker compact
 *   - Stage Tracker compact indicator shown while compile workflow is running
 *
 * Compile trigger uses compile_v1 workflow template (stub when not live).
 *
 * P1.5-3-03: Blog workspace screens
 * Stitch reference: blog-editor.html (ID: e818bfb26a2b4c0dac09dbf10b0670af)
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Save, Play, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateBlogPost, createBlogPost } from "@/lib/api/blog";
import { StageTracker } from "@/components/workflow/stage-tracker";
import type { BlogPost } from "@/lib/api/blog";
import type { WorkflowRunStatus } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlogEditorProps {
  /** Existing post — undefined when creating a new post */
  post?: BlogPost;
  /** Called after successful save with the updated/created post */
  onSave?: (post: BlogPost) => void;
}

// Auto-save interval in milliseconds (30s)
const AUTO_SAVE_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Save status indicator
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-emerald-600 dark:text-emerald-400",
        status === "error" && "text-destructive",
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 aria-hidden="true" className="size-3 animate-spin" />
          Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <CheckCircle2 aria-hidden="true" className="size-3" />
          Saved
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle aria-hidden="true" className="size-3" />
          Save failed
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BlogEditor component
// ---------------------------------------------------------------------------

export function BlogEditor({ post, onSave }: BlogEditorProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Form state
  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.content ?? "");

  // Track last-saved values to detect dirty state
  const lastSavedTitle = useRef(post?.title ?? "");
  const lastSavedContent = useRef(post?.content ?? "");
  const currentPostId = useRef<string | undefined>(post?.artifact_id);

  // Save status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Compile state (stub — shows StageTracker while running)
  const [compileRunId, setCompileRunId] = useState<string | null>(null);
  const [compileStatus, setCompileStatus] = useState<WorkflowRunStatus>("pending");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Save logic
  // ---------------------------------------------------------------------------

  const isDirty = useCallback(() => {
    return (
      title !== lastSavedTitle.current ||
      content !== lastSavedContent.current
    );
  }, [title, content]);

  const save = useCallback(async (): Promise<BlogPost | null> => {
    if (!isDirty()) return null;

    setSaveStatus("saving");
    setSaveError(null);

    try {
      let saved: BlogPost;

      if (currentPostId.current) {
        // Update existing post
        saved = await updateBlogPost(currentPostId.current, { title, content });
      } else {
        // Create new post
        saved = await createBlogPost({ title, content });
        currentPostId.current = saved.artifact_id;
        // Navigate to the edit page for the new post so the URL is canonical
        router.replace(`/blog/posts/${saved.artifact_id}/edit`);
      }

      lastSavedTitle.current = saved.title;
      lastSavedContent.current = saved.content ?? "";

      // Invalidate cache
      await queryClient.invalidateQueries({ queryKey: ["blog"] });

      setSaveStatus("saved");
      // Reset to idle after 3s
      setTimeout(() => setSaveStatus("idle"), 3_000);

      onSave?.(saved);
      return saved;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setSaveError(msg);
      setSaveStatus("error");
      return null;
    }
  }, [title, content, isDirty, queryClient, router, onSave]);

  // ---------------------------------------------------------------------------
  // Auto-save every 30s (only when dirty)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty()) {
        void save();
      }
    }, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [save, isDirty]);

  // ---------------------------------------------------------------------------
  // Compile trigger (stub — uses compile_v1 template)
  // ---------------------------------------------------------------------------

  const handleCompile = useCallback(async () => {
    if (isCompiling) return;

    // Save first to ensure latest content is persisted
    const saved = await save();
    const postId = saved?.artifact_id ?? currentPostId.current;

    if (!postId) {
      setCompileError("Save the post before compiling.");
      return;
    }

    setIsCompiling(true);
    setCompileError(null);

    try {
      // Stub: in production this would POST to /api/blog/posts/:id/compile
      // or trigger compile_v1 workflow. We simulate a run ID and running state.
      const stubRunId = `blog-compile-${postId}-${Date.now()}`;
      setCompileRunId(stubRunId);
      setCompileStatus("running");

      // Simulate completion after 3s (stub behaviour per task notes)
      setTimeout(() => {
        setCompileStatus("complete");
        setIsCompiling(false);
        void queryClient.invalidateQueries({ queryKey: ["blog"] });
      }, 3_000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Compile failed";
      setCompileError(msg);
      setIsCompiling(false);
      setCompileStatus("failed");
    }
  }, [isCompiling, save, queryClient]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isNew = !currentPostId.current;

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="blog-title"
          className="text-xs font-medium text-muted-foreground"
        >
          Title
        </label>
        <input
          id="blog-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title"
          aria-required="true"
          className={cn(
            "rounded-md border bg-background px-3 py-2 text-lg font-semibold text-foreground",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "transition-colors",
          )}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Manual save */}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saveStatus === "saving" || !isDirty()}
            aria-label="Save post"
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-sm font-medium sm:h-8 sm:min-h-0",
              "transition-colors hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <Save aria-hidden="true" className="size-4" />
            Save
          </button>

          {/* Compile */}
          <button
            type="button"
            onClick={() => void handleCompile()}
            disabled={isCompiling || !title.trim()}
            aria-label={isCompiling ? "Compiling…" : "Compile post"}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 text-sm font-medium text-blue-700 dark:text-blue-300 sm:h-8 sm:min-h-0",
              "transition-colors hover:bg-blue-500/20",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {isCompiling ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Play aria-hidden="true" className="size-4" />
            )}
            {isCompiling ? "Compiling…" : "Compile"}
          </button>
        </div>

        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* Save error */}
      {saveStatus === "error" && saveError && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {saveError}
        </div>
      )}

      {/* Stage tracker (shown while/after compile) */}
      {compileRunId && (
        <div className="rounded-md border bg-card px-3 py-2">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Compile workflow
          </p>
          <StageTracker
            runId={compileRunId}
            templateId="compile_v1"
            status={compileStatus}
            currentStage={compileStatus === "complete" ? 5 : 1}
            variant="compact"
          />
          {compileError && (
            <p className="mt-1 text-xs text-destructive">{compileError}</p>
          )}
        </div>
      )}

      {/* Content editor */}
      <div className="flex flex-col gap-1 flex-1">
        <label
          htmlFor="blog-content"
          className="text-xs font-medium text-muted-foreground"
        >
          Content{" "}
          <span className="text-muted-foreground/60">(GFM markdown)</span>
        </label>
        <textarea
          id="blog-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your post in GFM markdown…"
          rows={24}
          aria-label="Post content in GFM markdown"
          className={cn(
            "min-h-[400px] w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-sm text-foreground",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "transition-colors",
          )}
        />
      </div>

      {/* Auto-save note */}
      <p className="text-[11px] text-muted-foreground">
        {isNew
          ? "Your post will be created on first save."
          : "Auto-saves every 30 seconds when there are unsaved changes."}
      </p>
    </div>
  );
}
