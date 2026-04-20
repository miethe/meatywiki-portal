/**
 * OfflineQueueManager — IndexedDB-backed offline intake queue.
 *
 * Framework-agnostic TypeScript; no React imports.
 *
 * Security invariant: Authorization headers are NEVER stored.
 * On replay, the bearer token is re-read from the HttpOnly cookie
 * (browser sends it automatically on same-origin fetch).
 *
 * IndexedDB schema:
 *   DB name:    meatywiki-portal-offline
 *   version:    1
 *   stores:
 *     offline_queue  — pending items (keyPath: id, autoIncrement)
 *     failed_queue   — exhausted items (keyPath: id, autoIncrement)
 *
 * Retry policy: up to 3 attempts with exponential backoff (1s → 2s → 4s).
 * After 3 failures the record moves to failed_queue.
 *
 * Custom event dispatched on queue mutations:
 *   window.dispatchEvent(new CustomEvent('offline-queue-change'))
 * This lets useOfflineQueue hook react without polling.
 *
 * Traces FR-1.5-17, FR-1.5-18.
 */

const DB_NAME = "meatywiki-portal-offline";
const DB_VERSION = 1;
const STORE_QUEUED = "offline_queue";
const STORE_FAILED = "failed_queue";

/** Maximum retry attempts before moving to failed_queue. */
const MAX_RETRIES = 3;

/** Base backoff delay in ms. Actual delay = BASE_BACKOFF_MS * 2^attempt. */
const BASE_BACKOFF_MS = 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A serialisable record stored in IndexedDB.
 *
 * bodyJson and bodyBlob are mutually exclusive:
 *   - JSON bodies: bodyJson is set, bodyBlob is undefined
 *   - File/Blob bodies: bodyBlob is set, bodyJson is undefined
 *
 * Authorization header is NEVER stored (security invariant).
 * All other request headers are preserved in `headers`.
 */
export interface QueueRecord {
  /** Auto-assigned by IndexedDB. */
  id?: number;
  /** Relative path, e.g. "/api/intake/note". */
  endpoint: string;
  /** HTTP method, typically "POST". */
  method: string;
  /**
   * Serialised headers excluding Authorization.
   * Plain object for IndexedDB serialisability.
   */
  headers: Record<string, string>;
  /** JSON-serialisable body (used for note/url intake). */
  bodyJson?: unknown;
  /** Binary body for file/audio uploads. IndexedDB natively stores Blobs. */
  bodyBlob?: Blob;
  /** MIME type for Blob body. */
  contentType?: string;
  /** ISO timestamp of enqueue. */
  enqueuedAt: string;
  /** Number of attempts made so far (starts at 0). */
  retries: number;
}

/** Parameters for enqueueing a request. */
export interface EnqueueParams {
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
  bodyJson?: unknown;
  bodyBlob?: Blob;
  contentType?: string;
}

/** Result of a drain/replay operation. */
export interface DrainResult {
  replayed: number;
  failed: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Open (or upgrade) the IndexedDB database. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_QUEUED)) {
        db.createObjectStore(STORE_QUEUED, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
      if (!db.objectStoreNames.contains(STORE_FAILED)) {
        db.createObjectStore(STORE_FAILED, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Wrap an IDBRequest in a Promise. */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Strip Authorization header from a headers map (security invariant). */
function stripAuth(headers: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "authorization") {
      clean[key] = value;
    }
  }
  return clean;
}

/** Dispatch the change notification event (no-op in non-browser envs). */
function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("offline-queue-change"));
  }
}

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// OfflineQueueManager
// ---------------------------------------------------------------------------

/**
 * OfflineQueueManager — static-method-only utility (no instantiation needed).
 *
 * All methods are async and safe to call concurrently; each opens its own
 * short-lived transaction so the database connection is not held open.
 */
export class OfflineQueueManager {
  // --------------------------------------------------------------------------
  // enqueue
  // --------------------------------------------------------------------------

  /**
   * Enqueue a request for later replay.
   *
   * Security: Authorization header is stripped before storage.
   * Token is re-added from the browser cookie on replay.
   */
  static async enqueue(params: EnqueueParams): Promise<number> {
    const db = await openDb();

    const record: QueueRecord = {
      endpoint: params.endpoint,
      method: params.method,
      // Strip auth before persisting — security invariant.
      headers: stripAuth(params.headers ?? {}),
      bodyJson: params.bodyJson,
      bodyBlob: params.bodyBlob,
      contentType: params.contentType,
      enqueuedAt: new Date().toISOString(),
      retries: 0,
    };

    const tx = db.transaction(STORE_QUEUED, "readwrite");
    const store = tx.objectStore(STORE_QUEUED);
    const id = await promisifyRequest<number>(store.add(record) as IDBRequest<number>);

    db.close();
    notifyChange();
    console.info("[OfflineQueue] Enqueued:", params.endpoint, "id:", id);
    return id;
  }

  // --------------------------------------------------------------------------
  // listQueued / listFailed
  // --------------------------------------------------------------------------

  /** Return all records in offline_queue (FIFO order). */
  static async listQueued(): Promise<QueueRecord[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_QUEUED, "readonly");
    const store = tx.objectStore(STORE_QUEUED);
    const result = await promisifyRequest<QueueRecord[]>(store.getAll() as IDBRequest<QueueRecord[]>);
    db.close();
    return result;
  }

  /** Return all records in failed_queue. */
  static async listFailed(): Promise<QueueRecord[]> {
    const db = await openDb();
    const tx = db.transaction(STORE_FAILED, "readonly");
    const store = tx.objectStore(STORE_FAILED);
    const result = await promisifyRequest<QueueRecord[]>(store.getAll() as IDBRequest<QueueRecord[]>);
    db.close();
    return result;
  }

  // --------------------------------------------------------------------------
  // count
  // --------------------------------------------------------------------------

  /** Return { queued, failed } record counts. */
  static async count(): Promise<{ queued: number; failed: number }> {
    const db = await openDb();

    const txQ = db.transaction(STORE_QUEUED, "readonly");
    const queued = await promisifyRequest<number>(
      txQ.objectStore(STORE_QUEUED).count() as IDBRequest<number>,
    );

    const txF = db.transaction(STORE_FAILED, "readonly");
    const failed = await promisifyRequest<number>(
      txF.objectStore(STORE_FAILED).count() as IDBRequest<number>,
    );

    db.close();
    return { queued, failed };
  }

  // --------------------------------------------------------------------------
  // dequeueNext
  // --------------------------------------------------------------------------

  /**
   * Remove and return the oldest record from offline_queue (FIFO).
   * Returns undefined when the queue is empty.
   */
  static async dequeueNext(): Promise<QueueRecord | undefined> {
    const db = await openDb();
    const tx = db.transaction(STORE_QUEUED, "readwrite");
    const store = tx.objectStore(STORE_QUEUED);

    // Cursor opens at the lowest key (oldest entry).
    const cursorRequest = store.openCursor();
    const record = await new Promise<QueueRecord | undefined>((resolve, reject) => {
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) {
          resolve(undefined);
          return;
        }
        const item = cursor.value as QueueRecord;
        cursor.delete();
        resolve(item);
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });

    db.close();
    if (record) notifyChange();
    return record;
  }

  // --------------------------------------------------------------------------
  // markFailed
  // --------------------------------------------------------------------------

  /**
   * Move record by id from offline_queue to failed_queue.
   * Called after MAX_RETRIES exhausted.
   */
  static async markFailed(id: number): Promise<void> {
    const db = await openDb();

    // Read from queued
    const txRead = db.transaction(STORE_QUEUED, "readwrite");
    const queuedStore = txRead.objectStore(STORE_QUEUED);
    const record = await promisifyRequest<QueueRecord>(
      queuedStore.get(id) as IDBRequest<QueueRecord>,
    );

    if (!record) {
      db.close();
      return;
    }

    // Delete from queued store
    await promisifyRequest<undefined>(queuedStore.delete(id) as IDBRequest<undefined>);

    // Write to failed store (drop the id so autoIncrement assigns a new one)
    const { id: _dropId, ...rest } = record;
    void _dropId; // suppress unused-var lint
    const txWrite = db.transaction(STORE_FAILED, "readwrite");
    await promisifyRequest<number>(
      txWrite.objectStore(STORE_FAILED).add(rest) as IDBRequest<number>,
    );

    db.close();
    notifyChange();
    console.warn("[OfflineQueue] Moved to failed_queue, original id:", id);
  }

  // --------------------------------------------------------------------------
  // drain
  // --------------------------------------------------------------------------

  /**
   * Replay all pending items in FIFO order.
   *
   * For each record:
   *   1. Attempt fetch (Authorization header not stored; browser cookie is sent).
   *   2. On 2xx: discard record (already removed by dequeueNext).
   *   3. On non-2xx or network error: increment retries.
   *      - If retries < MAX_RETRIES: re-enqueue with updated retry count.
   *      - If retries >= MAX_RETRIES: move to failed_queue.
   *   4. Exponential backoff between retries: BASE_BACKOFF_MS * 2^retries.
   *
   * Returns { replayed, failed } summary.
   */
  static async drain(): Promise<DrainResult> {
    let replayed = 0;
    let failed = 0;

    // Snapshot the count so we don't loop endlessly on re-enqueued retries.
    const { queued: initialCount } = await OfflineQueueManager.count();

    for (let i = 0; i < initialCount; i++) {
      const record = await OfflineQueueManager.dequeueNext();
      if (!record) break;

      const success = await OfflineQueueManager._replayOne(record);
      if (success) {
        replayed++;
      } else {
        failed++;
      }
    }

    notifyChange();
    console.info("[OfflineQueue] Drain complete. Replayed:", replayed, "Failed:", failed);
    return { replayed, failed };
  }

  // --------------------------------------------------------------------------
  // _replayOne (internal)
  // --------------------------------------------------------------------------

  /**
   * Attempt to replay a single record.
   * Handles retry + backoff + failure promotion internally.
   * Returns true on success, false after exhaustion.
   */
  private static async _replayOne(record: QueueRecord): Promise<boolean> {
    const attempt = record.retries;

    // Backoff before retry (not before the first attempt)
    if (attempt > 0) {
      const delayMs = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(delayMs);
    }

    try {
      const headers = new Headers(record.headers);
      // Do NOT re-add Authorization header — browser sends the HttpOnly cookie
      // automatically on same-origin requests. This is intentional per spec.

      let body: BodyInit | undefined;
      if (record.bodyBlob) {
        body = record.bodyBlob;
        if (record.contentType) {
          headers.set("Content-Type", record.contentType);
        }
      } else if (record.bodyJson !== undefined) {
        body = JSON.stringify(record.bodyJson);
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      }

      const response = await fetch(record.endpoint, {
        method: record.method,
        headers,
        body,
      });

      if (response.ok || (response.status >= 200 && response.status < 300)) {
        console.info("[OfflineQueue] Replayed successfully:", record.endpoint);
        return true;
      }

      // Non-2xx — treat as failure
      console.warn(
        "[OfflineQueue] Replay got non-2xx:",
        response.status,
        record.endpoint,
      );
    } catch (err) {
      console.warn("[OfflineQueue] Replay fetch error:", err, record.endpoint);
    }

    // On failure: check retry budget
    const nextRetries = attempt + 1;
    if (nextRetries >= MAX_RETRIES) {
      // Exhausted — promote to failed_queue
      // Record was already removed from queued by dequeueNext; re-add to failed.
      const db = await openDb();
      const tx = db.transaction(STORE_FAILED, "readwrite");
      const { id: _drop, ...rest } = record;
      void _drop;
      await promisifyRequest<number>(
        tx.objectStore(STORE_FAILED).add({ ...rest, retries: nextRetries }) as IDBRequest<number>,
      );
      db.close();
      notifyChange();
      return false;
    } else {
      // Re-enqueue with incremented retry count (back to end of queue)
      await OfflineQueueManager.enqueue({
        endpoint: record.endpoint,
        method: record.method,
        headers: record.headers,
        bodyJson: record.bodyJson,
        bodyBlob: record.bodyBlob,
        contentType: record.contentType,
      });
      // Patch retries on the newly queued record
      const db = await openDb();
      const tx = db.transaction(STORE_QUEUED, "readwrite");
      const store = tx.objectStore(STORE_QUEUED);
      // Get the last-added record (highest key) and update its retry count
      const cursorReq = store.openCursor(null, "prev");
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            const updated = { ...(cursor.value as QueueRecord), retries: nextRetries };
            cursor.update(updated);
          }
          resolve();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
      db.close();
      return false;
    }
  }
}
