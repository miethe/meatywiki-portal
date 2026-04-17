/**
 * Framework-agnostic SSE client.
 *
 * Wraps the native browser EventSource with:
 * - Auto-reconnect with exponential backoff (initial 1s, cap 30s, max 10 retries)
 * - Last-Event-ID header replay on reconnect (P2-05 contract)
 * - AbortSignal-based cleanup
 * - Typed event payloads via generic TEvent
 *
 * INVARIANT: uses native EventSource only — no external SSE libraries.
 *
 * Limitations of native EventSource (documented):
 * - Does not support custom request headers (e.g., Authorization).
 *   Auth in v1 is bearer-token via HttpOnly cookie, so server-side auth works
 *   without an explicit header.  If a header is ever needed, replace with a
 *   fetch-based ReadableStream approach (compatible shim point).
 * - Last-Event-ID is sent automatically by the browser on reconnect after a
 *   network drop.  For manual reconnect (user-triggered or abort→restart), we
 *   reconstruct the URL with `?lastEventId=<id>` as a fallback because
 *   EventSource doesn't expose a constructor option for the header.
 * - TypeScript's DOM lib does not expose `EventSource.lastEventId` as a typed
 *   property (it IS present in browsers).  We read it from `MessageEvent.lastEventId`
 *   instead, which IS typed and carries the same value.
 */

import { TERMINAL_EVENT_TYPES, type SSEStatus } from "./types";

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface SSEConnectionOptions<TEvent> {
  /** Full URL of the SSE endpoint (e.g., /api/workflows/:run_id/stream). */
  url: string;
  /**
   * Last received event ID for replay on reconnect (P2-05).
   * Passed as `?lastEventId=<id>` query param on initial connect when provided.
   */
  lastEventId?: string;
  /** Called once the EventSource transitions to OPEN. */
  onOpen?: () => void;
  /** Called for each parsed event payload. */
  onEvent: (event: TEvent) => void;
  /** Called on error or max retries exceeded. */
  onError?: (error: SSEClientError) => void;
  /** Called whenever connection status changes. */
  onStatusChange?: (status: SSEStatus) => void;
  /**
   * AbortSignal to tear down the connection externally.
   * Closing via signal will NOT trigger reconnect.
   */
  signal?: AbortSignal;
  /** Override default backoff config. */
  backoff?: Partial<BackoffConfig>;
}

export interface SSEClientError {
  type: "parse_error" | "max_retries" | "connection_error" | "aborted";
  message: string;
  cause?: unknown;
}

export interface SSEConnection {
  /** Manually close the connection (no reconnect). */
  close(): void;
  /** Current connection status. */
  readonly status: SSEStatus;
  /** Last received event ID (for external state persistence). */
  readonly lastEventId: string | undefined;
}

// ---------------------------------------------------------------------------
// Internal backoff config
// ---------------------------------------------------------------------------

interface BackoffConfig {
  /** Base delay in ms. Default: 1000. */
  baseMs: number;
  /** Maximum delay in ms. Default: 30_000. */
  maxMs: number;
  /** Maximum retry attempts before giving up. Default: 10. */
  maxRetries: number;
  /** Multiplier per retry. Default: 2 (exponential). */
  factor: number;
}

const DEFAULT_BACKOFF: BackoffConfig = {
  baseMs: 1_000,
  maxMs: 30_000,
  maxRetries: 10,
  factor: 2,
};

function computeDelay(attempt: number, cfg: BackoffConfig): number {
  const delay = cfg.baseMs * Math.pow(cfg.factor, attempt);
  return Math.min(delay, cfg.maxMs);
}

// ---------------------------------------------------------------------------
// createSSEConnection
// ---------------------------------------------------------------------------

/**
 * Opens an SSE connection to `url`, managing reconnects and cleanup.
 *
 * @example
 * const conn = createSSEConnection<SSEWorkflowEvent>({
 *   url: `/api/workflows/${runId}/stream`,
 *   onEvent: (e) => dispatch(e),
 *   onError: (err) => console.error(err),
 *   signal: abortController.signal,
 * });
 * // later:
 * conn.close();
 */
export function createSSEConnection<TEvent>(
  options: SSEConnectionOptions<TEvent>,
): SSEConnection {
  const backoffCfg: BackoffConfig = {
    ...DEFAULT_BACKOFF,
    ...options.backoff,
  };

  let es: EventSource | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let currentStatus: SSEStatus = "idle";
  let lastEventId: string | undefined = options.lastEventId;

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  function setStatus(next: SSEStatus): void {
    if (currentStatus === next) return;
    currentStatus = next;
    options.onStatusChange?.(next);
  }

  function emitError(err: SSEClientError): void {
    options.onError?.(err);
  }

  function buildUrl(): string {
    const base = options.url;
    if (lastEventId === undefined) return base;
    // Append lastEventId as query param — EventSource doesn't support
    // setting the Last-Event-ID header manually, but the backend (P2-05)
    // also accepts ?lastEventId for the same replay semantics.
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}lastEventId=${encodeURIComponent(lastEventId)}`;
  }

  // ------------------------------------------------------------------
  // Core connect / disconnect
  // ------------------------------------------------------------------

  function connect(): void {
    if (closed) return;

    setStatus(retryCount === 0 ? "connecting" : "reconnecting");

    const url = buildUrl();
    es = new EventSource(url);

    es.onopen = (): void => {
      retryCount = 0;
      setStatus("open");
      options.onOpen?.();
    };

    es.onmessage = (msgEvent: MessageEvent<string>): void => {
      // `MessageEvent.lastEventId` is the browser-managed value of the `id:` field
      // from the most recent SSE event — this IS typed in TypeScript's DOM lib.
      // We use it to track the last received event ID for Last-Event-ID replay.
      if (msgEvent.lastEventId) {
        lastEventId = msgEvent.lastEventId;
      }

      let parsed: TEvent;
      try {
        parsed = JSON.parse(msgEvent.data) as TEvent;
      } catch (cause) {
        emitError({
          type: "parse_error",
          message: `Failed to parse SSE event data: ${msgEvent.data}`,
          cause,
        });
        return;
      }

      options.onEvent(parsed);

      // Auto-close on terminal events (workflow_completed / workflow_failed)
      // Cast to check discriminant — safe because caller types TEvent appropriately.
      const maybeTyped = parsed as { type?: string };
      if (
        typeof maybeTyped.type === "string" &&
        TERMINAL_EVENT_TYPES.has(
          maybeTyped.type as Parameters<typeof TERMINAL_EVENT_TYPES["has"]>[0],
        )
      ) {
        closeInternal(/* reconnect */ false);
        setStatus("closed");
      }
    };

    es.onerror = (_errorEvent: Event): void => {
      // EventSource fires onerror both for transient network issues (where it
      // will self-reconnect) and for permanent failures (readyState=CLOSED).
      // We take control of reconnect to implement our backoff strategy.
      if (closed) return;

      const readyState = es?.readyState;

      // Close the current EventSource to prevent its own reconnect loop.
      closeInternal(/* reconnect */ false);

      if (readyState === EventSource.CLOSED || readyState === undefined) {
        scheduleReconnect();
      }
      // If readyState was CONNECTING, the browser already gave up — retry.
      else {
        scheduleReconnect();
      }
    };
  }

  function closeInternal(reconnect: boolean): void {
    if (es) {
      es.onopen = null;
      es.onmessage = null;
      es.onerror = null;
      es.close();
      es = null;
    }
    if (!reconnect) {
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    }
  }

  function scheduleReconnect(): void {
    if (closed) return;
    if (retryCount >= backoffCfg.maxRetries) {
      setStatus("error");
      emitError({
        type: "max_retries",
        message: `SSE connection failed after ${backoffCfg.maxRetries} retries`,
      });
      return;
    }

    const delay = computeDelay(retryCount, backoffCfg);
    retryCount += 1;
    setStatus("reconnecting");

    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      connect();
    }, delay);
  }

  // ------------------------------------------------------------------
  // AbortSignal integration
  // ------------------------------------------------------------------

  if (options.signal) {
    if (options.signal.aborted) {
      // Already aborted before we started — return a no-op closed handle.
      return {
        close() {
          /* no-op */
        },
        get status() {
          return "closed" as SSEStatus;
        },
        get lastEventId() {
          return lastEventId;
        },
      };
    }

    options.signal.addEventListener("abort", () => {
      if (!closed) {
        closed = true;
        closeInternal(/* reconnect */ false);
        setStatus("closed");
        emitError({ type: "aborted", message: "SSE connection aborted via signal" });
      }
    });
  }

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------

  connect();

  // ------------------------------------------------------------------
  // Public handle
  // ------------------------------------------------------------------

  return {
    close(): void {
      if (!closed) {
        closed = true;
        closeInternal(/* reconnect */ false);
        setStatus("closed");
      }
    },
    get status(): SSEStatus {
      return currentStatus;
    },
    get lastEventId(): string | undefined {
      return lastEventId;
    },
  };
}
