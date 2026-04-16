/**
 * UnifiedShell — three shell variants for Portal v1.
 *
 * Three variants matching the Stitch audit §2.1:
 *   standard  — Default: Inbox, Library, App Home, Review Queue.
 *               Sidebar 240px, top bar, breadcrumbs hidden.
 *               Stitch ID: 680324578c7240499e5079a0e4df826f
 *   compact   — Dense views: Workflow Status, filtered lists.
 *               Sidebar 200px, minimised top bar.
 *               Stitch ID: 895cb143f4e743d1959f980a360e87ce
 *   detail    — Deep-context: Artifact Detail, Workflow Detail.
 *               Breadcrumb-led, context rail enabled.
 *               Stitch ID: 81b3721afdb2438cbf199bcba3d93507
 *
 * Shell policy (audit §2.1, OQ-I resolved): default = standard.
 * Top-bar Workflow status indicator mounts in standard + compact; suppressed in detail.
 *
 * This module exports the shell props type for use by the layouts;
 * the actual render is composed in src/app/(main)/layout.tsx via ShellNav + ShellHeader.
 */

export type ShellVariant = "standard" | "compact" | "detail";

export interface UnifiedShellConfig {
  variant: ShellVariant;
  /** Page title surfaced in top bar */
  pageTitle?: string;
  /** Breadcrumb items for detail variant */
  breadcrumbs?: Array<{ label: string; href: string }>;
  /** Show workflow status indicator in top bar (auto-suppressed in detail) */
  showWorkflowIndicator?: boolean;
}

/** Sidebar widths per variant */
export const SHELL_SIDEBAR_WIDTH: Record<ShellVariant, string> = {
  standard: "w-60",  // 240px
  compact: "w-[200px]",
  detail: "w-60",
};
