"use client";

/**
 * Backlinks Explorer — artifact edge explorer page.
 *
 * Allows the user to enter an artifact ID and view its incoming + outgoing
 * edges via BacklinksPanel.
 *
 * P4-01: placeholder. P4-03: real implementation.
 *
 * Stitch reference: "Backlinks Panel" (P4-03 scope)
 */

import { useState, useCallback } from "react";
import { BacklinksPanel } from "@/components/research/backlinks-panel";

// ---------------------------------------------------------------------------
// Artifact ID input form
// ---------------------------------------------------------------------------

interface ArtifactIdInputProps {
  onLookup: (id: string) => void;
}

function ArtifactIdInput({ onLookup }: ArtifactIdInputProps) {
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const id = (formData.get("artifactId") as string | null)?.trim() ?? "";
      if (id) onLookup(id);
    },
    [onLookup],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      aria-label="Artifact ID lookup"
    >
      <div className="flex flex-1 flex-col gap-1">
        <label
          htmlFor="artifactId"
          className="text-xs font-medium text-muted-foreground"
        >
          Artifact ID
        </label>
        <input
          id="artifactId"
          name="artifactId"
          type="text"
          placeholder="Enter artifact ID…"
          aria-describedby="artifactId-hint"
          className={[
            "h-9 w-full rounded-md border bg-background px-3 py-2",
            "font-mono text-sm placeholder:text-muted-foreground/60",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "transition-colors",
          ].join(" ")}
        />
        <p id="artifactId-hint" className="text-[11px] text-muted-foreground">
          Paste a ULID or UUID to explore its connections.
        </p>
      </div>
      <button
        type="submit"
        className={[
          "inline-flex h-9 shrink-0 items-center rounded-md border border-input px-4 text-sm font-medium",
          "bg-background text-foreground transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        ].join(" ")}
      >
        View backlinks
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BacklinksPage() {
  const [artifactId, setArtifactId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backlinks</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Explore inbound and outbound connections between research artifacts.
        </p>
      </div>

      {/* Lookup input */}
      <ArtifactIdInput onLookup={setArtifactId} />

      {/* Panel — renders idle/empty state until an ID is provided */}
      <BacklinksPanel artifactId={artifactId} />
    </div>
  );
}
