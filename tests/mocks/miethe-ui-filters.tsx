/**
 * @miethe/ui/filters Jest manual mock.
 *
 * Provides minimal stubs for TagFilterPopover and AvailableTag type
 * imported by ArtifactSearchDialog.
 */

import React from "react";

// ---------------------------------------------------------------------------
// AvailableTag type (re-exported for TS satisfaction)
// ---------------------------------------------------------------------------

export interface AvailableTag {
  name: string;
  count?: number;
}

// ---------------------------------------------------------------------------
// TagFilterPopover stub
// ---------------------------------------------------------------------------

export interface TagFilterPopoverProps {
  availableTags?: AvailableTag[];
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function TagFilterPopover({
  selectedTags = [],
  onTagsChange,
  availableTags = [],
}: TagFilterPopoverProps) {
  return (
    <div data-testid="tag-filter-popover-stub">
      <button
        type="button"
        aria-label="Filter by tags"
        aria-haspopup="listbox"
      >
        Tags {selectedTags.length > 0 ? `(${selectedTags.length})` : ""}
      </button>
      <ul role="listbox" aria-label="Available tags" hidden>
        {availableTags.map((tag) => (
          <li
            key={tag.name}
            role="option"
            aria-selected={selectedTags.includes(tag.name)}
            onClick={() => {
              if (selectedTags.includes(tag.name)) {
                onTagsChange?.(selectedTags.filter((t) => t !== tag.name));
              } else {
                onTagsChange?.([...selectedTags, tag.name]);
              }
            }}
          >
            {tag.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
