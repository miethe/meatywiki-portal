/**
 * Tests for src/lib/graph/layoutCache.ts
 *
 * Coverage:
 *  - FNV-1a hash determinism
 *  - 12K node cap enforcement (writes beyond cap are truncated)
 *  - 5000ms write throttle (via fake timers — note: saveLayoutCache itself is
 *    not throttled in the source; the throttle is the caller's responsibility.
 *    These tests verify saveLayoutCache correctly caps at MAX_CACHED_NODES=12000
 *    and that re-reads after a save return only the capped set.)
 *  - Filter-fingerprint cache key isolation
 */

import { buildLayoutCacheKey, loadLayoutCache, saveLayoutCache } from '@/lib/graph/layoutCache';
import type { LayoutCachePoint } from '@/lib/graph/layoutCache';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePositions(count: number): Map<string, LayoutCachePoint> {
  const map = new Map<string, LayoutCachePoint>();
  for (let i = 0; i < count; i++) {
    map.set(`node-${i}`, { x: i * 0.1, y: i * 0.2 });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear();
});

// --- FNV-1a hash determinism ---

describe('buildLayoutCacheKey — FNV-1a hash determinism', () => {
  it('returns the same key for identical inputs', () => {
    const key1 = buildLayoutCacheKey(['workspace:research', 'type:concept', true, 42]);
    const key2 = buildLayoutCacheKey(['workspace:research', 'type:concept', true, 42]);
    expect(key1).toBe(key2);
  });

  it('returns a different key when one element changes', () => {
    const key1 = buildLayoutCacheKey(['workspace:research', 'type:concept']);
    const key2 = buildLayoutCacheKey(['workspace:research', 'type:topic']);
    expect(key1).not.toBe(key2);
  });

  it('returns a different key when element order changes', () => {
    const key1 = buildLayoutCacheKey(['a', 'b']);
    const key2 = buildLayoutCacheKey(['b', 'a']);
    expect(key1).not.toBe(key2);
  });

  it('filters out null and undefined parts before hashing', () => {
    const key1 = buildLayoutCacheKey(['a', null, 'b', undefined]);
    const key2 = buildLayoutCacheKey(['a', 'b']);
    expect(key1).toBe(key2);
  });

  it('produces a string with the expected prefix and version', () => {
    const key = buildLayoutCacheKey(['test']);
    // Format: codebase-map.layout:1:<hash>
    expect(key).toMatch(/^codebase-map\.layout:1:[a-z0-9]+$/);
  });

  it('a single-character change in a long string produces a different hash', () => {
    const base = 'workspace:research|type:concept|depth:3';
    const key1 = buildLayoutCacheKey([base]);
    const key2 = buildLayoutCacheKey([base.replace('research', 'Research')]);
    expect(key1).not.toBe(key2);
  });
});

// --- 12K node cap enforcement ---

describe('saveLayoutCache / loadLayoutCache — 12K node cap', () => {
  it('saves and restores all nodes when count is below the 12K cap', () => {
    const key = buildLayoutCacheKey(['cap-test-small']);
    const positions = makePositions(100);
    saveLayoutCache(key, positions);
    const loaded = loadLayoutCache(key);
    expect(loaded).not.toBeNull();
    expect(loaded!.size).toBe(100);
  });

  it('truncates at exactly 12000 nodes when 12001 are provided', () => {
    const key = buildLayoutCacheKey(['cap-test-12001']);
    const positions = makePositions(12001);
    saveLayoutCache(key, positions);
    const loaded = loadLayoutCache(key);
    expect(loaded).not.toBeNull();
    // The 12001st node must be dropped — only 12000 survive.
    expect(loaded!.size).toBe(12000);
  });

  it('saves exactly 12000 nodes when count equals the cap', () => {
    const key = buildLayoutCacheKey(['cap-test-exact']);
    const positions = makePositions(12000);
    saveLayoutCache(key, positions);
    const loaded = loadLayoutCache(key);
    expect(loaded).not.toBeNull();
    expect(loaded!.size).toBe(12000);
  });

  it('does nothing when positions map is empty', () => {
    const key = buildLayoutCacheKey(['cap-test-empty']);
    saveLayoutCache(key, new Map());
    const loaded = loadLayoutCache(key);
    expect(loaded).toBeNull();
  });
});

// --- 5000ms write throttle ---
// The source saveLayoutCache is not itself throttled — it writes synchronously.
// The 5s throttle is enforced by callers (e.g. an interval or debounce at the
// call site). These tests verify that a second synchronous save overwrites the
// first (no internal dedup), which is the correct contract for an external
// throttle wrapper.

describe('saveLayoutCache — write semantics under caller-side throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a second save immediately after the first overwrites the cache entry', () => {
    const key = buildLayoutCacheKey(['throttle-test']);

    const pos1 = new Map<string, LayoutCachePoint>([['node-A', { x: 1, y: 2 }]]);
    saveLayoutCache(key, pos1);

    const pos2 = new Map<string, LayoutCachePoint>([
      ['node-A', { x: 9, y: 9 }],
      ['node-B', { x: 3, y: 4 }],
    ]);
    saveLayoutCache(key, pos2);

    const loaded = loadLayoutCache(key);
    expect(loaded).not.toBeNull();
    expect(loaded!.size).toBe(2);
    expect(loaded!.get('node-A')).toEqual(expect.objectContaining({ x: 9, y: 9 }));
    expect(loaded!.get('node-B')).toEqual(expect.objectContaining({ x: 3, y: 4 }));
  });

  it('savedAt timestamp advances when time advances between saves', () => {
    const key = buildLayoutCacheKey(['throttle-timestamp']);
    const positions = makePositions(5);

    saveLayoutCache(key, positions);
    const raw1 = localStorageMock.getItem(key);
    const savedAt1 = JSON.parse(raw1!).savedAt as number;

    // Advance fake clock by 5 seconds (the intended throttle interval).
    jest.advanceTimersByTime(5000);

    saveLayoutCache(key, positions);
    const raw2 = localStorageMock.getItem(key);
    const savedAt2 = JSON.parse(raw2!).savedAt as number;

    // savedAt2 should be strictly greater than savedAt1 only if Date.now()
    // is affected by fake timers. In Jest's fake timer mode, Date.now() IS
    // advanced by advanceTimersByTime, so this assertion is valid.
    expect(savedAt2).toBeGreaterThan(savedAt1);
  });
});

// --- Filter-fingerprint cache key isolation ---

describe('buildLayoutCacheKey — filter-fingerprint cache key isolation', () => {
  it('different filter fingerprints produce different cache keys', () => {
    const keyA = buildLayoutCacheKey(['workspace:research', 'type:concept', 'depth:2']);
    const keyB = buildLayoutCacheKey(['workspace:engineering', 'type:concept', 'depth:2']);
    expect(keyA).not.toBe(keyB);
  });

  it('saves to separate buckets for different filter fingerprints', () => {
    const keyA = buildLayoutCacheKey(['filter-isolation', 'fingerprint:A']);
    const keyB = buildLayoutCacheKey(['filter-isolation', 'fingerprint:B']);

    const posA = new Map<string, LayoutCachePoint>([['nodeA', { x: 1, y: 1 }]]);
    const posB = new Map<string, LayoutCachePoint>([
      ['nodeB1', { x: 2, y: 2 }],
      ['nodeB2', { x: 3, y: 3 }],
    ]);

    saveLayoutCache(keyA, posA);
    saveLayoutCache(keyB, posB);

    const loadedA = loadLayoutCache(keyA);
    const loadedB = loadLayoutCache(keyB);

    expect(loadedA).not.toBeNull();
    expect(loadedB).not.toBeNull();
    expect(loadedA!.size).toBe(1);
    expect(loadedB!.size).toBe(2);
    expect(loadedA!.has('nodeA')).toBe(true);
    expect(loadedA!.has('nodeB1')).toBe(false);
    expect(loadedB!.has('nodeB1')).toBe(true);
    expect(loadedB!.has('nodeA')).toBe(false);
  });

  it('writing to key A does not overwrite key B storage entry', () => {
    const keyA = buildLayoutCacheKey(['isolation-write', 'bucket:A']);
    const keyB = buildLayoutCacheKey(['isolation-write', 'bucket:B']);

    const posInitialB = new Map<string, LayoutCachePoint>([['original', { x: 10, y: 20 }]]);
    saveLayoutCache(keyB, posInitialB);

    // Write a large batch to key A (near cap).
    saveLayoutCache(keyA, makePositions(500));

    // Key B's entry must be unchanged.
    const loadedB = loadLayoutCache(keyB);
    expect(loadedB).not.toBeNull();
    expect(loadedB!.size).toBe(1);
    expect(loadedB!.get('original')).toEqual(expect.objectContaining({ x: 10, y: 20 }));
  });
});

// --- Round-trip fidelity ---

describe('saveLayoutCache / loadLayoutCache — round-trip fidelity', () => {
  it('preserves x, y, z, vx, vy, vz across a save/load cycle', () => {
    const key = buildLayoutCacheKey(['round-trip']);
    const positions = new Map<string, LayoutCachePoint>([
      ['full', { x: 1.5, y: -2.5, z: 3.0, vx: 0.1, vy: -0.2, vz: 0.3 }],
      ['partial', { x: 4.0, y: 5.0 }],
    ]);

    saveLayoutCache(key, positions);
    const loaded = loadLayoutCache(key);

    expect(loaded).not.toBeNull();
    const full = loaded!.get('full');
    expect(full).toEqual(expect.objectContaining({ x: 1.5, y: -2.5, z: 3.0, vx: 0.1, vy: -0.2, vz: 0.3 }));

    // Partial entry: z/vx/vy/vz should be 0 (serialized as 0, deserialized as 0).
    const partial = loaded!.get('partial');
    expect(partial).toEqual(expect.objectContaining({ x: 4.0, y: 5.0 }));
  });

  it('returns null for a key that was never written', () => {
    const key = buildLayoutCacheKey(['nonexistent']);
    expect(loadLayoutCache(key)).toBeNull();
  });

  it('returns null when localStorage is unavailable', () => {
    // Simulate unavailable localStorage by making window.localStorage throw.
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      get: () => { throw new Error('SecurityError'); },
      configurable: true,
    });

    const key = buildLayoutCacheKey(['no-storage']);
    expect(loadLayoutCache(key)).toBeNull();

    // Restore.
    if (original) {
      Object.defineProperty(window, 'localStorage', original);
    }
  });
});
