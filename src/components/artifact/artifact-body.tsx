"use client";

import DOMPurify from "isomorphic-dompurify";

/**
 * ArtifactBody — editorial prose renderer for Knowledge and Draft tab content.
 *
 * Pipeline decision (P4-02):
 *   The portal has NO react-markdown or @tailwindcss/typography installed.
 *   compiled_content from the engine is typically HTML (starts with "<"), which
 *   is rendered via dangerouslySetInnerHTML with overridden typography classes.
 *   raw_content / plain markdown (no leading "<") is rendered via a lightweight
 *   regex-based renderer here — no new deps, no bundler change required.
 *
 * Callout fences:
 *   Parses `::: <type>` … `:::` blocks from the plain-text path, where <type>
 *   is one of: note | reference | warning | info.
 *   Falls back to a neutral "note" callout for unknown types.
 *
 * Typography utilities reused from P4-01 (globals.css @layer utilities):
 *   .text-display-md  → h1, h2 (28/36, display serif)
 *   .text-quote       → blockquote (22/32, italic serif)
 *   .text-meta        → figure captions, footnotes
 */

import { Info, Link2, AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Callout configuration
// ---------------------------------------------------------------------------

type CalloutType = "note" | "reference" | "warning" | "info";

interface CalloutConfig {
  borderColor: string;   // Tailwind border-* class (dark-mode-aware via CSS var)
  bgColor: string;       // subtle tinted background
  labelColor: string;    // label + icon colour
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const CALLOUT_CONFIG: Record<CalloutType, CalloutConfig> = {
  note: {
    borderColor: "border-blue-500",
    bgColor: "bg-blue-50/60 dark:bg-blue-950/30",
    labelColor: "text-blue-700 dark:text-blue-400",
    label: "Note",
    Icon: Info,
  },
  reference: {
    borderColor: "border-violet-500",
    bgColor: "bg-violet-50/60 dark:bg-violet-950/30",
    labelColor: "text-violet-700 dark:text-violet-400",
    label: "Reference",
    Icon: Link2,
  },
  warning: {
    borderColor: "border-amber-500",
    bgColor: "bg-amber-50/60 dark:bg-amber-950/30",
    labelColor: "text-amber-700 dark:text-amber-400",
    label: "Warning",
    Icon: AlertTriangle,
  },
  info: {
    borderColor: "border-emerald-500",
    bgColor: "bg-emerald-50/60 dark:bg-emerald-950/30",
    labelColor: "text-emerald-700 dark:text-emerald-400",
    label: "Info",
    Icon: Lightbulb,
  },
};

function isCalloutType(s: string): s is CalloutType {
  return s in CALLOUT_CONFIG;
}

// ---------------------------------------------------------------------------
// Callout box component
// ---------------------------------------------------------------------------

function CalloutBox({
  type,
  children,
}: {
  type: CalloutType;
  children: ReactNode;
}) {
  const cfg = CALLOUT_CONFIG[type];
  const { Icon } = cfg;
  return (
    <aside
      aria-label={`${cfg.label} callout`}
      className={cn(
        "my-4 rounded-r-md border-l-[4px] px-4 py-3",
        cfg.borderColor,
        cfg.bgColor,
      )}
    >
      {/* Label row */}
      <div className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", cfg.labelColor)}>
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {cfg.label}
      </div>
      {/* Body */}
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Inline HTML entities + basic inline rendering
// ---------------------------------------------------------------------------

/** Apply minimal inline formatting: **bold**, *italic*, `code`, [link](url). */
function renderInline(text: string): ReactNode {
  // Split on bold, italic, code, and link patterns.
  // We process left-to-right with a simple tokenizer.
  // Note: /s flag (dotAll) is not used — [\s\S] used instead for ES2017 compat.
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const bold = remaining.match(/^([\s\S]*?)\*\*([\s\S]*?)\*\*([\s\S]*)/);
    // Italic *text*
    const italic = remaining.match(/^([\s\S]*?)\*([\s\S]*?)\*([\s\S]*)/);
    // Inline code `text`
    const code = remaining.match(/^([\s\S]*?)`([^`]+)`([\s\S]*)/);
    // Link [text](url)
    const link = remaining.match(/^([\s\S]*?)\[([^\]]+)\]\(([^)]+)\)([\s\S]*)/);

    // Find earliest match
    const candidates: Array<{ idx: number; kind: string; match: RegExpMatchArray }> = [];
    if (bold) candidates.push({ idx: bold[1].length, kind: "bold", match: bold });
    if (italic) candidates.push({ idx: italic[1].length, kind: "italic", match: italic });
    if (code) candidates.push({ idx: code[1].length, kind: "code", match: code });
    if (link) candidates.push({ idx: link[1].length, kind: "link", match: link });

    if (candidates.length === 0) {
      parts.push(remaining);
      break;
    }

    candidates.sort((a, b) => a.idx - b.idx);
    const { kind, match } = candidates[0];

    if (kind === "bold") {
      if (match[1]) parts.push(match[1]);
      parts.push(<strong key={key++}>{renderInline(match[2])}</strong>);
      remaining = match[3];
    } else if (kind === "italic") {
      if (match[1]) parts.push(match[1]);
      parts.push(<em key={key++}>{renderInline(match[2])}</em>);
      remaining = match[3];
    } else if (kind === "code") {
      if (match[1]) parts.push(match[1]);
      parts.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
        >
          {match[2]}
        </code>,
      );
      remaining = match[3];
    } else if (kind === "link") {
      if (match[1]) parts.push(match[1]);
      parts.push(
        <a
          key={key++}
          href={match[3]}
          className="text-primary underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[2]}
        </a>,
      );
      remaining = match[4];
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Block-level segment types
// ---------------------------------------------------------------------------

type Segment =
  | { kind: "h1" | "h2" | "h3" | "h4"; text: string }
  | { kind: "p"; lines: string[] }
  | { kind: "blockquote"; lines: string[] }
  | { kind: "callout"; calloutType: CalloutType; lines: string[] }
  | { kind: "pre"; lang: string; code: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "hr" };

// ---------------------------------------------------------------------------
// Parser — convert raw markdown string → Segment[]
// ---------------------------------------------------------------------------

function parseMarkdown(md: string): Segment[] {
  const lines = md.split("\n");
  const segments: Segment[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines at top level (they serve as implicit separators)
    if (trimmed === "") {
      i++;
      continue;
    }

    // ---- Callout fence ::: type ---- :::
    const calloutOpen = trimmed.match(/^:::\s*(\w+)\s*$/);
    if (calloutOpen) {
      const rawType = calloutOpen[1].toLowerCase();
      const calloutType: CalloutType = isCalloutType(rawType) ? rawType : "note";
      const calloutLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") {
        calloutLines.push(lines[i]);
        i++;
      }
      i++; // consume closing :::
      segments.push({ kind: "callout", calloutType, lines: calloutLines });
      continue;
    }

    // ---- Fenced code block ```lang
    const fenceOpen = trimmed.match(/^```(\w*)/);
    if (fenceOpen) {
      const lang = fenceOpen[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      segments.push({ kind: "pre", lang, code: codeLines.join("\n") });
      continue;
    }

    // ---- ATX headings
    const h1 = trimmed.match(/^#\s+(.+)/);
    if (h1) { segments.push({ kind: "h1", text: h1[1] }); i++; continue; }
    const h2 = trimmed.match(/^##\s+(.+)/);
    if (h2) { segments.push({ kind: "h2", text: h2[1] }); i++; continue; }
    const h3 = trimmed.match(/^###\s+(.+)/);
    if (h3) { segments.push({ kind: "h3", text: h3[1] }); i++; continue; }
    const h4 = trimmed.match(/^####\s+(.+)/);
    if (h4) { segments.push({ kind: "h4", text: h4[1] }); i++; continue; }

    // ---- Blockquote >
    if (trimmed.startsWith(">")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        bqLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      segments.push({ kind: "blockquote", lines: bqLines });
      continue;
    }

    // ---- Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      segments.push({ kind: "hr" });
      i++;
      continue;
    }

    // ---- Unordered list
    if (/^[-*+]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s/, ""));
        i++;
      }
      segments.push({ kind: "ul", items });
      continue;
    }

    // ---- Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, ""));
        i++;
      }
      segments.push({ kind: "ol", items });
      continue;
    }

    // ---- Paragraph — collect until blank line or block-level marker
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,6}\s/.test(lines[i].trim()) &&
      !/^:::\s*\w/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*+]\s/.test(lines[i].trim()) &&
      !/^\d+\.\s/.test(lines[i].trim()) &&
      !/^[-*_]{3,}$/.test(lines[i].trim())
    ) {
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length > 0) {
      segments.push({ kind: "p", lines: pLines });
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Renderer — Segment[] → JSX
// ---------------------------------------------------------------------------

function renderSegment(seg: Segment, idx: number): ReactNode {
  switch (seg.kind) {
    case "h1":
      return (
        <h1 key={idx} className="text-display-md mb-3 mt-6 text-foreground first:mt-0">
          {renderInline(seg.text)}
        </h1>
      );
    case "h2":
      return (
        <h2 key={idx} className="text-display-md mb-2 mt-6 text-foreground first:mt-0">
          {renderInline(seg.text)}
        </h2>
      );
    case "h3":
      return (
        <h3
          key={idx}
          className="mb-2 mt-5 font-family-[var(--portal-brand-display)] text-xl font-medium leading-tight text-foreground"
          style={{ fontFamily: "var(--portal-brand-display)" }}
        >
          {renderInline(seg.text)}
        </h3>
      );
    case "h4":
      return (
        <h4
          key={idx}
          className="mb-1.5 mt-4 text-base font-semibold text-foreground"
          style={{ fontFamily: "var(--portal-brand-display)" }}
        >
          {renderInline(seg.text)}
        </h4>
      );
    case "p":
      return (
        <p key={idx} className="mb-3 text-sm leading-relaxed text-foreground/90">
          {renderInline(seg.lines.join(" "))}
        </p>
      );
    case "blockquote":
      return (
        <blockquote key={idx} className="text-quote my-4 border-l-[3px] border-border pl-4 text-[hsl(var(--portal-editorial-quote))]">
          {seg.lines.map((l, li) => (
            <p key={li} className="mb-1 last:mb-0">
              {renderInline(l)}
            </p>
          ))}
        </blockquote>
      );
    case "callout": {
      const body = seg.lines.join("\n");
      return (
        <CalloutBox key={idx} type={seg.calloutType}>
          {body.trim()}
        </CalloutBox>
      );
    }
    case "pre":
      return (
        <pre
          key={idx}
          className="my-4 overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed"
        >
          <code className="font-mono">{seg.code}</code>
        </pre>
      );
    case "ul":
      return (
        <ul key={idx} className="mb-3 list-disc pl-5 text-sm leading-relaxed">
          {seg.items.map((item, ii) => (
            <li key={ii} className="mb-1 text-foreground/90">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={idx} className="mb-3 list-decimal pl-5 text-sm leading-relaxed">
          {seg.items.map((item, ii) => (
            <li key={ii} className="mb-1 text-foreground/90">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
    case "hr":
      return <hr key={idx} className="my-6 border-border" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// HTML prose override classes
// Applies to dangerouslySetInnerHTML content (HTML from engine compile step).
// Upgrades headings to display serif, blockquotes to .text-quote, etc.
// ---------------------------------------------------------------------------

const HTML_PROSE_CLASSES = cn(
  "rounded-md border bg-card p-6",
  // Headings — display serif via .text-display-md (defined in globals.css)
  "[&_h1]:text-display-md [&_h1]:mb-4 [&_h1]:mt-0 [&_h1]:text-foreground",
  "[&_h2]:text-display-md [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-foreground",
  // h3/h4 — display serif, slightly smaller (inline style workaround not needed;
  // we rely on font-family inherit from --portal-brand-display cascade)
  "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-medium [&_h3]:text-foreground",
  "[&_h4]:mb-1.5 [&_h4]:mt-3 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-foreground",
  // Paragraphs
  "[&_p]:mb-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/90",
  // Blockquote — .text-quote specs (22/32, italic, display serif)
  "[&_blockquote]:text-quote [&_blockquote]:my-4 [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:[color:hsl(var(--portal-editorial-quote))]",
  // Lists
  "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-sm",
  "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-sm",
  "[&_li]:mb-1 [&_li]:text-foreground/90",
  // Code + pre
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
  "[&_pre]:my-4 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-xs",
  // Links
  "[&_a]:text-primary [&_a]:underline-offset-2 [&_a]:hover:underline",
  // HR
  "[&_hr]:my-6 [&_hr]:border-border",
  // Tables
  "[&_table]:w-full [&_table]:text-sm",
  "[&_th]:border-b [&_th]:pb-2 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-b [&_td]:border-border/50 [&_td]:py-1.5",
);

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-center"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground/60">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface ArtifactBodyProps {
  /** Raw HTML or plain markdown string from the API. */
  content: string | null | undefined;
  /** Controls which empty-state copy is shown. */
  variant?: "knowledge" | "draft";
  className?: string;
}

/**
 * ArtifactBody renders artifact body content with editorial prose styling.
 *
 * - HTML content (starts with "<"): rendered via dangerouslySetInnerHTML with
 *   Tailwind child-selector overrides that apply P4-01 typography utilities.
 * - Plain markdown: parsed in-browser with a zero-dep regex tokenizer.
 *   Callout fences (`::: note`, `::: reference`, `::: warning`, `::: info`)
 *   are rendered as styled aside boxes with left-border accent + icon.
 *   Blockquotes become `.text-quote` (italic display serif, 22/32).
 *
 * Design tokens used: --portal-brand-display, --portal-editorial-quote,
 * --muted, --foreground, --border — all defined in globals.css; no new vars.
 */
export function ArtifactBody({ content, variant = "knowledge", className }: ArtifactBodyProps) {
  if (!content) {
    const cfg =
      variant === "draft"
        ? {
            label: "No draft content",
            hint: "Draft content appears here for synthesis and staged artifacts.",
          }
        : {
            label: "No compiled content yet.",
            hint: "Run Compile to generate the knowledge reader output.",
          };
    return <EmptyState {...cfg} />;
  }

  // --- HTML path ---
  if (content.trimStart().startsWith("<")) {
    // HTML sanitized via DOMPurify (P6-03/P6-04 — sanitization gate for PORTAL_ALLOW_NETWORK=1).
    const sanitized = DOMPurify.sanitize(content, { USE_PROFILES: { html: true } });
    return (
      <div
        className={cn(HTML_PROSE_CLASSES, className)}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  // --- Plain markdown path ---
  const segments = parseMarkdown(content);

  return (
    <article
      className={cn(
        "rounded-md border bg-card p-6",
        "[&_h1,&_h2]:font-[var(--portal-brand-display)]", // cascade display serif into headings
        className,
      )}
      aria-label="Artifact body"
    >
      {segments.map((seg, idx) => renderSegment(seg, idx))}
    </article>
  );
}
