/**
 * @miethe/ui Jest manual mock.
 *
 * @miethe/ui ships as ESM-only with deeply nested ESM transitive dependencies
 * (react-markdown, remark-*, rehype-*, unified) that cannot be reliably
 * transpiled by Jest's SWC transform in the jsdom environment.
 *
 * This stub replaces the entire @miethe/ui import surface with minimal
 * React components/functions sufficient for test rendering. Components that
 * use @miethe/ui will render lightweight stubs — enough for RTL assertions
 * on surrounding UI (buttons, toasts, metadata) without needing the full
 * markdown rendering pipeline.
 *
 * When @miethe/ui ships a CJS-compatible build or the test infra moves to
 * ESM jest config, remove this file and the moduleNameMapper entry.
 */

import React from "react";

// ---------------------------------------------------------------------------
// ArticleViewer stub — renders content as plain text in a div
// ---------------------------------------------------------------------------

export interface ArticleViewerProps {
  content?: string;
  format?: string;
  variant?: string;
  frontmatter?: string;
  sanitize?: boolean;
  generateHeadingIds?: boolean;
}

export function ArticleViewer({ content }: ArticleViewerProps) {
  return (
    <div data-testid="article-viewer-stub">
      {content ?? ""}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentPane stub
// ---------------------------------------------------------------------------

export interface ContentPaneProps {
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function ContentPane({ children }: ContentPaneProps) {
  return <div data-testid="content-pane-stub">{children}</div>;
}

// ---------------------------------------------------------------------------
// Re-export anything else that might be imported from @miethe/ui
// (extend as needed when new imports are added)
// ---------------------------------------------------------------------------

export const useDiffViewer = () => ({ diff: null });
