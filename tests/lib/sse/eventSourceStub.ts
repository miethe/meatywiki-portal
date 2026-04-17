/**
 * Minimal EventSource stub for Jest / jsdom.
 *
 * jsdom does not implement EventSource.  This stub provides a controllable
 * test double that lets tests:
 * - Simulate message events       → stub.emit(data, id?)
 * - Simulate errors               → stub.triggerError()
 * - Inspect opened URLs           → MockEventSource.lastUrl
 * - Inspect the Last-Event-ID sent on reconnect → captured in the URL
 *   (because createSSEConnection appends ?lastEventId=... on manual reconnect)
 * - Count how many instances were created → MockEventSource.instances
 *
 * Install via:
 *   beforeEach(() => MockEventSource.install());
 *   afterEach(() => MockEventSource.uninstall());
 */

type EventHandler = ((event: MessageEvent | Event) => void) | null;

export class MockEventSource {
  // -----------------------------------------------------------------------
  // Class-level tracking
  // -----------------------------------------------------------------------

  static instances: MockEventSource[] = [];
  static _original: typeof EventSource | undefined;

  static install(): void {
    MockEventSource.instances = [];
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  }

  static uninstall(): void {
    if (MockEventSource._original !== undefined) {
      globalThis.EventSource = MockEventSource._original;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).EventSource;
    }
  }

  /** Convenience: the most recently created instance. */
  static get latest(): MockEventSource {
    const inst = MockEventSource.instances.at(-1);
    if (!inst) throw new Error("No MockEventSource instances created yet");
    return inst;
  }

  // -----------------------------------------------------------------------
  // Instance shape (mirrors EventSource interface)
  // -----------------------------------------------------------------------

  readonly url: string;
  readyState: number;

  // EventSource ready-state constants
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  onopen: EventHandler = null;
  onmessage: EventHandler = null;
  onerror: EventHandler = null;

  // Track whether close() was called
  private _closed = false;
  get isClosed(): boolean {
    return this._closed;
  }

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  constructor(url: string) {
    this.url = url;
    this.readyState = MockEventSource.CONNECTING;
    MockEventSource.instances.push(this);
    // Simulate async open (deferred to next microtask)
    Promise.resolve().then(() => this._open());
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private _open(): void {
    if (this._closed) return;
    this.readyState = MockEventSource.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  // -----------------------------------------------------------------------
  // Test controls
  // -----------------------------------------------------------------------

  /**
   * Emit a message to the onmessage handler.
   * @param data  String data (typically JSON).
   * @param id    Optional event ID (simulates `id:` SSE field).
   */
  emit(data: string, id?: string): void {
    if (this._closed) return;
    const event = new MessageEvent("message", { data, lastEventId: id ?? "" });
    if (this.onmessage) {
      this.onmessage(event);
    }
  }

  /**
   * Trigger an error on this connection (simulates network drop).
   * Sets readyState to CLOSED so the client's onerror handler sees CLOSED.
   */
  triggerError(setStateClosed = true): void {
    if (this._closed) return;
    if (setStateClosed) {
      this.readyState = MockEventSource.CLOSED;
    }
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }

  // -----------------------------------------------------------------------
  // EventSource interface
  // -----------------------------------------------------------------------

  close(): void {
    this._closed = true;
    this.readyState = MockEventSource.CLOSED;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
  }

  /** Minimal addEventListener (not used by client.ts but required by the interface shape). */
  addEventListener(
    _type: string,
    _listener: EventListenerOrEventListenerObject,
  ): void {
    /* no-op for stub */
  }

  removeEventListener(
    _type: string,
    _listener: EventListenerOrEventListenerObject,
  ): void {
    /* no-op for stub */
  }

  dispatchEvent(_event: Event): boolean {
    return false;
  }

  // SSE-specific (not on EventTarget but on EventSource)
  get lastEventId(): string {
    return "";
  }
}
