"use client";

/**
 * RouteModal — workspace routing popover for inbox artifact triage.
 *
 * Opens as a dialog when the "Route" CTA is clicked on a needs_destination
 * inbox card. Lets the user move an artifact to one of the four destination
 * workspaces: research, projects, blog, or inbox (back to inbox).
 *
 * Behavior:
 *   - Lists 4 workspaces; current workspace highlighted with checked state.
 *   - Selection fires PATCH /api/artifacts/{id} with { workspace } field.
 *   - Closes on successful selection; shows success or error toast.
 *   - ETag is not required by patchArtifact for workspace-only moves when
 *     called from the inbox; we use the variant that hits a lightweight
 *     workspace endpoint instead of the full ETag-gated patchArtifact.
 *
 * Keyboard:
 *   - Tab cycles through all focusable elements.
 *   - ArrowUp / ArrowDown move focus between workspace options.
 *   - Enter / Space selects the focused option.
 *   - Escape closes without action.
 *
 * Focus management:
 *   - On open: focus lands on the first non-current workspace option.
 *   - On close: focus returns to the triggering Route button.
 *
 * WCAG 2.1 AA:
 *   - role="dialog", aria-modal="true", aria-labelledby.
 *   - Workspace options use role="radio" + aria-checked.
 *   - Focus trap active while open.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  FlaskConical,
  FolderOpen,
  BookOpen,
  Inbox,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import type { ArtifactWorkspace } from "@/types/artifact";

// ---------------------------------------------------------------------------
// Workspace routing options
// ---------------------------------------------------------------------------

interface WorkspaceOption {
  value: ArtifactWorkspace;
  label: string;
  description: string;
  icon: React.ElementType;
}

const WORKSPACE_OPTIONS: WorkspaceOption[] = [
  {
    value: "research",
    label: "Research",
    description: "Route into the research workflow",
    icon: FlaskConical,
  },
  {
    value: "projects",
    label: "Projects",
    description: "Associate with a project",
    icon: FolderOpen,
  },
  {
    value: "blog",
    label: "Blog",
    description: "Stage for publishing",
    icon: BookOpen,
  },
  {
    value: "inbox",
    label: "Inbox",
    description: "Keep in inbox for later",
    icon: Inbox,
  },
];

// ---------------------------------------------------------------------------
// Lightweight workspace PATCH — no ETag needed for workspace-only routing
// ---------------------------------------------------------------------------

async function patchArtifactWorkspace(
  id: string,
  workspace: ArtifactWorkspace,
): Promise<void> {
  await apiFetch(`/artifacts/${encodeURIComponent(id)}/workspace`, {
    method: "PATCH",
    body: JSON.stringify({ workspace }),
  });
}

// ---------------------------------------------------------------------------
// Focus trap helpers (mirrors dialog.tsx pattern)
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled])',
  '[role="radio"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS),
  ).filter((el) => el.offsetParent !== null);
}

// ---------------------------------------------------------------------------
// RouteModal props
// ---------------------------------------------------------------------------

export interface RouteModalProps {
  /** Artifact ID to patch */
  artifactId: string;
  /** Artifact title — used in toast messages */
  artifactTitle: string;
  /** Current workspace — highlighted in the option list */
  currentWorkspace: ArtifactWorkspace;
  /** Whether the modal is open */
  open: boolean;
  /** Called to open/close the modal */
  onOpenChange: (open: boolean) => void;
  /**
   * Ref to the Route button that triggered this modal.
   * Focus is returned here on close (WCAG 2.4.3).
   */
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

// ---------------------------------------------------------------------------
// RouteModal component
// ---------------------------------------------------------------------------

export function RouteModal({
  artifactId,
  artifactTitle,
  currentWorkspace,
  open,
  onOpenChange,
  triggerRef,
}: RouteModalProps) {
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const { add: addToast } = useToast();
  const queryClient = useQueryClient();

  // Track which option has arrow-key focus (separate from DOM focus)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const optionRefs = useRef<(HTMLElement | null)[]>([]);

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  const mutation = useMutation({
    mutationFn: ({ workspace }: { workspace: ArtifactWorkspace }) =>
      patchArtifactWorkspace(artifactId, workspace),
    onSuccess: (_data, { workspace }) => {
      const label =
        WORKSPACE_OPTIONS.find((o) => o.value === workspace)?.label ?? workspace;
      addToast({
        type: "success",
        message: `"${artifactTitle}" moved to ${label}`,
      });
      // Invalidate inbox list so the moved artifact disappears
      void queryClient.invalidateQueries({ queryKey: ["artifacts", "inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      handleClose();
    },
    onError: () => {
      addToast({
        type: "error",
        message: `Failed to route "${artifactTitle}". Please try again.`,
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Open/close lifecycle
  // ---------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    onOpenChange(false);
    mutation.reset();
  }, [onOpenChange, mutation]);

  // Return focus to trigger on close
  useEffect(() => {
    if (!open) {
      triggerRef?.current?.focus();
    }
  }, [open, triggerRef]);

  // Scroll lock while open (mirrors dialog.tsx)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Global Escape handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose]);

  // Focus first non-current option on open
  useEffect(() => {
    if (!open) return;
    const firstNonCurrent = WORKSPACE_OPTIONS.findIndex(
      (o) => o.value !== currentWorkspace,
    );
    const targetIndex = firstNonCurrent >= 0 ? firstNonCurrent : 0;
    setFocusedIndex(targetIndex);
    // Small delay to ensure the DOM is mounted
    const id = setTimeout(() => {
      optionRefs.current[targetIndex]?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [open, currentWorkspace]);

  // ---------------------------------------------------------------------------
  // Keyboard navigation (Tab focus trap + arrow keys)
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Tab") {
        const el = contentRef.current;
        if (!el) return;
        const focusable = getFocusable(el);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = (focusedIndex + 1) % WORKSPACE_OPTIONS.length;
        setFocusedIndex(next);
        optionRefs.current[next]?.focus();
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev =
          (focusedIndex - 1 + WORKSPACE_OPTIONS.length) % WORKSPACE_OPTIONS.length;
        setFocusedIndex(prev);
        optionRefs.current[prev]?.focus();
      }
    },
    [focusedIndex],
  );

  // ---------------------------------------------------------------------------
  // Selection handler
  // ---------------------------------------------------------------------------

  const handleSelect = useCallback(
    (workspace: ArtifactWorkspace) => {
      if (mutation.isPending) return;
      if (workspace === currentWorkspace) {
        handleClose();
        return;
      }
      mutation.mutate({ workspace });
    },
    [mutation, currentWorkspace, handleClose],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative z-50 w-full max-w-xs overflow-hidden rounded-xl bg-background shadow-2xl ring-1 ring-border",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2
            id={titleId}
            className="text-sm font-semibold leading-none tracking-tight"
          >
            Move to workspace
          </h2>
          <button
            type="button"
            aria-label="Close route dialog"
            onClick={handleClose}
            disabled={mutation.isPending}
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground",
              "transition-colors hover:bg-muted hover:text-foreground",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </div>

        {/* Artifact name context */}
        <div className="border-b px-4 py-2">
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{artifactTitle}</span>
          </p>
        </div>

        {/* Workspace options — role="radiogroup" for grouped radio semantics */}
        <div
          role="radiogroup"
          aria-label="Choose destination workspace"
          className="py-1"
        >
          {WORKSPACE_OPTIONS.map((option, index) => {
            const isSelected = option.value === currentWorkspace;
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${option.label} — ${option.description}`}
                type="button"
                disabled={mutation.isPending}
                onClick={() => handleSelect(option.value)}
                onFocus={() => setFocusedIndex(index)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                  "transition-colors",
                  "focus:outline-none focus-visible:bg-muted/60",
                  "disabled:pointer-events-none disabled:opacity-60",
                  isSelected
                    ? "bg-primary/8 text-primary"
                    : "text-foreground hover:bg-muted/50",
                )}
              >
                {/* Icon */}
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                />

                {/* Label + description */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium leading-none",
                      isSelected && "text-primary",
                    )}
                  >
                    {option.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>

                {/* Check mark for current workspace */}
                {isSelected && (
                  <Check
                    aria-hidden="true"
                    className="size-4 shrink-0 text-primary"
                  />
                )}

                {/* Loading spinner for the option being mutated */}
                {mutation.isPending &&
                  mutation.variables?.workspace === option.value && (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 shrink-0 animate-spin text-muted-foreground"
                    />
                  )}
              </button>
            );
          })}
        </div>

        {/* Error inline state (supplemental to toast) */}
        {mutation.isError && (
          <div
            role="alert"
            aria-live="assertive"
            className="border-t px-4 py-2.5"
          >
            <p className="text-xs text-destructive">
              Routing failed — please try again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// useRouteModal — convenience hook for wiring the modal to a trigger button
// ---------------------------------------------------------------------------

export interface UseRouteModalReturn {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * useRouteModal encapsulates the open/close state and trigger ref required
 * by RouteModal. Wire the returned `triggerRef` to the Route button and
 * spread `open`/`onOpenChange` onto RouteModal.
 *
 * @example
 * const route = useRouteModal();
 * <button ref={route.triggerRef} onClick={route.openModal}>Route</button>
 * <RouteModal open={route.open} onOpenChange={route.closeModal} ... />
 */
export function useRouteModal(): UseRouteModalReturn {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return { open, openModal, closeModal, triggerRef };
}
