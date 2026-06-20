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
// BaseArtifactModal stub — renders a minimal dialog wrapper with tabs
// ---------------------------------------------------------------------------

export interface ModalTab {
  value: string;
  label: string;
  icon?: React.ElementType;
}

export interface ArtifactTypeConfig {
  icon: string;
  color: string;
}

export interface BaseArtifactModalProps {
  artifact?: { name?: string; type?: string; description?: string };
  open?: boolean;
  onClose?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  tabs?: ModalTab[];
  headerActions?: React.ReactNode;
  aboveTabsContent?: React.ReactNode;
  getTypeConfig?: (type: string) => ArtifactTypeConfig | undefined;
  maxWidth?: string;
  children?: React.ReactNode;
}

export function BaseArtifactModal({
  artifact,
  open,
  onClose,
  activeTab,
  onTabChange,
  tabs = [],
  headerActions,
  aboveTabsContent,
  children,
}: BaseArtifactModalProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={artifact?.name ?? "Artifact modal"}
      data-testid="base-artifact-modal-stub"
    >
      <button type="button" aria-label="Close" onClick={onClose}>
        ×
      </button>
      {headerActions}
      <div role="tablist" aria-label="Artifact tabs">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => onTabChange?.(tab.value)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {aboveTabsContent}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabsContent stub
// ---------------------------------------------------------------------------

export interface TabsContentProps {
  value: string;
  className?: string;
  children?: React.ReactNode;
}

export function TabsContent({ value, children }: TabsContentProps) {
  return (
    <div data-testid={`tabs-content-${value}`} role="tabpanel" aria-label={value}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SearchableCombobox stub
// ---------------------------------------------------------------------------

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

export interface SearchableComboboxProps {
  // Generic items API (used by ProjectComboboxField)
  items?: unknown[];
  getItemKey?: (item: unknown) => string;
  renderItem?: (item: unknown) => React.ReactNode;
  onSearch?: (query: string) => void;
  onSelect?: (item: unknown) => void;
  emptyMessage?: string;
  // Simple options API (alternative shape)
  options?: ComboboxOption[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  label?: string;
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export function SearchableCombobox({
  items,
  getItemKey,
  renderItem,
  onSelect,
  options = [],
  value,
  placeholder = "Search…",
  disabled = false,
  isLoading = false,
  label,
  "aria-label": ariaLabel,
}: SearchableComboboxProps) {
  const accessibleLabel = ariaLabel ?? label ?? placeholder;
  const displayItems = items ?? options;

  return (
    <div data-testid="searchable-combobox-stub">
      <button
        type="button"
        role="combobox"
        aria-expanded={false}
        aria-label={accessibleLabel}
        disabled={disabled || isLoading}
      >
        {value ?? placeholder}
      </button>
      <ul role="listbox" aria-label={accessibleLabel}>
        {displayItems.map((item, idx) => {
          const key = getItemKey ? getItemKey(item) : (item as ComboboxOption).value ?? String(idx);
          return (
            <li
              key={key}
              role="option"
              aria-selected={false}
              onClick={() => onSelect?.(item)}
            >
              {renderItem ? renderItem(item) : (item as ComboboxOption).label ?? key}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupedSelect stub
// ---------------------------------------------------------------------------

export interface GroupedSelectItem {
  value: string;
  label: string;
}

export interface GroupedSelectGroup {
  label: string;
  items: GroupedSelectItem[];
}

export interface GroupedSelectProps {
  groups?: GroupedSelectGroup[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function GroupedSelect({
  groups = [],
  value,
  onValueChange,
  placeholder = "Select…",
  disabled = false,
}: GroupedSelectProps) {
  return (
    <select
      aria-label={placeholder}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
      data-testid="grouped-select-stub"
    >
      <option value="">{placeholder}</option>
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Re-export anything else that might be imported from @miethe/ui
// (extend as needed when new imports are added)
// ---------------------------------------------------------------------------

export const useDiffViewer = () => ({ diff: null });
