/**
 * RouteModal unit tests.
 *
 * Covers:
 * 1. Renders nothing when open=false.
 * 2. Renders dialog with heading and all 4 workspace options when open=true.
 * 3. Current workspace option has aria-checked="true" and a visual check mark.
 * 4. Escape key closes the dialog without firing a mutation.
 * 5. Focus trap: Tab from last focusable wraps to first; Shift+Tab from first wraps to last.
 * 6. Arrow keys (ArrowDown / ArrowUp) cycle focus through workspace options.
 * 7. Clicking a non-current workspace fires patchArtifactWorkspace with correct args.
 * 8. Successful mutation closes modal and shows success toast.
 * 9. Failed mutation shows error toast and keeps modal open.
 * 10. Clicking the current workspace closes the modal without firing a mutation.
 * 11. ARIA: dialog has role="dialog", aria-modal="true", aria-labelledby.
 * 12. Backdrop click closes the dialog.
 *
 * Mocking strategy:
 *   patchArtifactWorkspace is mocked at the module boundary via the apiFetch
 *   layer. Since RouteModal calls apiFetch directly in its local helper, we
 *   mock "@/lib/api/client" so apiFetch is a jest.fn() spy.
 *
 *   The TanStack Query useMutation hook requires a QueryClientProvider wrapper.
 *   ToastProvider/ToastRenderer are included so toast assertions work.
 */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteModal } from "@/components/inbox/RouteModal";
import type { RouteModalProps } from "@/components/inbox/RouteModal";
import { ToastProvider } from "@/hooks/use-toast";
import { ToastRenderer } from "@/components/ui/toast-renderer";

// ---------------------------------------------------------------------------
// Mock apiFetch so patchArtifactWorkspace doesn't need a real server
// ---------------------------------------------------------------------------

jest.mock("@/lib/api/client", () => ({
  ...jest.requireActual("@/lib/api/client"),
  apiFetch: jest.fn(),
}));

import { apiFetch } from "@/lib/api/client";
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

interface RenderOptions {
  props?: Partial<RouteModalProps>;
}

const DEFAULT_PROPS: RouteModalProps = {
  artifactId: "art-001",
  artifactTitle: "Test Artifact",
  currentWorkspace: "inbox",
  open: true,
  onOpenChange: jest.fn(),
};

function renderModal(opts: RenderOptions = {}) {
  const props: RouteModalProps = { ...DEFAULT_PROPS, ...opts.props };
  const queryClient = makeQueryClient();

  return render(
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <RouteModal {...props} />
      </QueryClientProvider>
      <ToastRenderer />
    </ToastProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RouteModal", () => {
  beforeEach(() => {
    // Default: successful PATCH
    mockApiFetch.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test 1: renders nothing when closed
  // ---------------------------------------------------------------------------
  it("renders nothing when open=false", () => {
    renderModal({ props: { open: false } });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Test 2: renders dialog with heading and 4 workspace options
  // ---------------------------------------------------------------------------
  it("renders dialog with heading and all 4 workspace options when open=true", () => {
    renderModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    // Heading
    expect(screen.getByText("Move to workspace")).toBeInTheDocument();

    // All 4 workspace options
    expect(screen.getByRole("radio", { name: /research/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /projects/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /blog/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /inbox/i })).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Test 3: current workspace is aria-checked and visually marked
  // ---------------------------------------------------------------------------
  it("marks the current workspace option as aria-checked", () => {
    renderModal({ props: { currentWorkspace: "research" } });

    const researchOption = screen.getByRole("radio", { name: /research/i });
    expect(researchOption).toHaveAttribute("aria-checked", "true");

    // Other options should not be checked
    const inboxOption = screen.getByRole("radio", { name: /inbox/i });
    expect(inboxOption).toHaveAttribute("aria-checked", "false");
  });

  // ---------------------------------------------------------------------------
  // Test 4: Escape closes without firing mutation
  // ---------------------------------------------------------------------------
  it("closes on Escape key without firing a mutation", async () => {
    const onOpenChange = jest.fn();
    const user = userEvent.setup();

    renderModal({ props: { onOpenChange } });

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Test 5: Focus trap — Tab wraps around
  // ---------------------------------------------------------------------------
  it("traps focus within the dialog on Tab and Shift+Tab", async () => {
    const user = userEvent.setup();
    renderModal();

    const dialog = screen.getByRole("dialog");
    const focusable = within(dialog).getAllByRole("button");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Tab from last should wrap to first
    last.focus();
    await user.tab();
    expect(document.activeElement).toBe(first);

    // Shift+Tab from first should wrap to last
    first.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  // ---------------------------------------------------------------------------
  // Test 6: Arrow keys cycle through workspace options
  // ---------------------------------------------------------------------------
  it("ArrowDown / ArrowUp cycle focus through workspace options", async () => {
    const user = userEvent.setup();
    renderModal();

    const options = screen.getAllByRole("radio");
    // Focus first option manually
    options[0].focus();

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[1]);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options[2]);

    // ArrowUp back
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options[1]);
  });

  // ---------------------------------------------------------------------------
  // Test 7: Clicking a non-current workspace fires the mutation
  // ---------------------------------------------------------------------------
  it("clicking a non-current workspace fires patchArtifactWorkspace", async () => {
    const user = userEvent.setup();
    renderModal({ props: { currentWorkspace: "inbox" } });

    const researchOption = screen.getByRole("radio", { name: /research/i });
    await user.click(researchOption);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/artifacts/art-001/workspace",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ workspace: "research" }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Test 8: Successful mutation closes modal and shows success toast
  // ---------------------------------------------------------------------------
  it("shows success toast and closes modal after successful mutation", async () => {
    const onOpenChange = jest.fn();
    const user = userEvent.setup();

    mockApiFetch.mockResolvedValue(undefined);

    renderModal({ props: { currentWorkspace: "inbox", onOpenChange } });

    const projectsOption = screen.getByRole("radio", { name: /projects/i });
    await user.click(projectsOption);

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    expect(screen.getByRole("status")).toHaveTextContent(/projects/i);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ---------------------------------------------------------------------------
  // Test 9: Failed mutation shows error toast and keeps modal open
  // ---------------------------------------------------------------------------
  it("shows error toast and keeps modal open on mutation failure", async () => {
    const onOpenChange = jest.fn();
    const user = userEvent.setup();

    mockApiFetch.mockRejectedValue(new Error("Network error"));

    renderModal({ props: { currentWorkspace: "inbox", onOpenChange } });

    const researchOption = screen.getByRole("radio", { name: /research/i });
    await user.click(researchOption);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/failed/i);
    // Modal should remain open
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Test 10: Clicking the current workspace closes without mutation
  // ---------------------------------------------------------------------------
  it("clicking the current workspace closes the modal without firing a mutation", async () => {
    const onOpenChange = jest.fn();
    const user = userEvent.setup();

    renderModal({
      props: { currentWorkspace: "inbox", onOpenChange },
    });

    const inboxOption = screen.getByRole("radio", { name: /^Inbox/i });
    await user.click(inboxOption);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Test 11: ARIA attributes
  // ---------------------------------------------------------------------------
  it("dialog has role=dialog, aria-modal=true, and aria-labelledby pointing to heading", () => {
    renderModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();

    const heading = document.getElementById(labelId!);
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("Move to workspace");
  });

  // ---------------------------------------------------------------------------
  // Test 12: Backdrop click closes dialog
  // ---------------------------------------------------------------------------
  it("closes dialog when backdrop is clicked", async () => {
    const onOpenChange = jest.fn();
    const user = userEvent.setup();

    renderModal({ props: { onOpenChange } });

    // The backdrop is the sibling div with aria-hidden
    const backdrop = document.querySelector("[aria-hidden='true']");
    expect(backdrop).not.toBeNull();

    await user.click(backdrop!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
