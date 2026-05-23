import {
  getTourState,
  setTourState,
  resetAllTourState,
  TOUR_STORAGE_PREFIX,
  type TourState,
} from "@/lib/storage/tour-state";

// ---------------------------------------------------------------------------
// In-memory localStorage mock
// ---------------------------------------------------------------------------

type StorageMock = {
  getItem: jest.MockedFunction<(key: string) => string | null>;
  setItem: jest.MockedFunction<(key: string, value: string) => void>;
  removeItem: jest.MockedFunction<(key: string) => void>;
  clear: jest.MockedFunction<() => void>;
  key: jest.MockedFunction<(index: number) => string | null>;
  readonly length: number;
  _store: () => Record<string, string>;
};

function makeLocalStorageMock(): StorageMock {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string): string | null => store[key] ?? null),
    setItem: jest.fn((key: string, value: string): void => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string): void => {
      delete store[key];
    }),
    clear: jest.fn((): void => {
      store = {};
    }),
    key: jest.fn((index: number): string | null => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
    _store: () => store,
  };
}

let storageMock: StorageMock;

beforeEach(() => {
  storageMock = makeLocalStorageMock();
  Object.defineProperty(window, "localStorage", {
    value: storageMock,
    writable: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getTourState
// ---------------------------------------------------------------------------

describe("getTourState", () => {
  it("returns null for an unknown tourId", () => {
    expect(getTourState("nonexistent-tour")).toBeNull();
  });

  it("returns null when no value is stored for the tourId", () => {
    storageMock.getItem.mockReturnValue(null);
    expect(getTourState("my-tour")).toBeNull();
  });

  it("returns null when the stored value is not valid JSON", () => {
    storageMock.getItem.mockReturnValue("not-json{{{");
    expect(getTourState("bad-tour")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setTourState + getTourState roundtrip
// ---------------------------------------------------------------------------

describe("setTourState / getTourState roundtrip", () => {
  it("persists and retrieves a completed tour state", () => {
    const state: TourState = { completed: true, lastStepIndex: 4, completedAt: "2026-05-23T10:00:00Z" };
    setTourState("intro-tour", state);

    expect(storageMock.setItem).toHaveBeenCalledWith(
      `${TOUR_STORAGE_PREFIX}intro-tour`,
      JSON.stringify(state),
    );

    // Wire the mock to return what was stored
    storageMock.getItem.mockImplementation((key: string): string | null => {
      return key === `${TOUR_STORAGE_PREFIX}intro-tour` ? JSON.stringify(state) : null;
    });

    expect(getTourState("intro-tour")).toEqual(state);
  });

  it("persists and retrieves an in-progress tour state without completedAt", () => {
    const state: TourState = { completed: false, lastStepIndex: 2 };
    setTourState("graph-tour", state);

    storageMock.getItem.mockImplementation((key: string): string | null =>
      key === `${TOUR_STORAGE_PREFIX}graph-tour` ? JSON.stringify(state) : null,
    );

    const retrieved = getTourState("graph-tour");
    expect(retrieved).toEqual(state);
    expect(retrieved?.completedAt).toBeUndefined();
  });

  it("stores values under the correct namespaced key", () => {
    const state: TourState = { completed: false, lastStepIndex: 0 };
    setTourState("settings-tour", state);

    expect(storageMock.setItem).toHaveBeenCalledWith(
      "meatywiki:tour:v1:settings-tour",
      expect.any(String),
    );
  });
});

// ---------------------------------------------------------------------------
// resetAllTourState
// ---------------------------------------------------------------------------

describe("resetAllTourState", () => {
  it("removes all keys matching the tour namespace prefix", () => {
    // Pre-populate the mock store with mixed keys
    const storeData: Record<string, string> = {
      [`${TOUR_STORAGE_PREFIX}intro`]: JSON.stringify({ completed: true, lastStepIndex: 3 }),
      [`${TOUR_STORAGE_PREFIX}graph`]: JSON.stringify({ completed: false, lastStepIndex: 1 }),
      "some-other-app-key": "keep-me",
      "meatywiki:settings": "also-keep-me",
    };

    const freshMock = makeLocalStorageMock();
    // Seed via setItem so _store reflects data
    for (const [k, v] of Object.entries(storeData)) {
      freshMock.setItem(k, v);
    }
    // Clear call tracking after seeding so assertions are clean
    freshMock.setItem.mockClear();
    freshMock.removeItem.mockClear();

    Object.defineProperty(window, "localStorage", { value: freshMock, writable: true });

    resetAllTourState();

    // Only tour-namespaced keys should have been removed
    expect(freshMock.removeItem).toHaveBeenCalledWith(`${TOUR_STORAGE_PREFIX}intro`);
    expect(freshMock.removeItem).toHaveBeenCalledWith(`${TOUR_STORAGE_PREFIX}graph`);
    expect(freshMock.removeItem).not.toHaveBeenCalledWith("some-other-app-key");
    expect(freshMock.removeItem).not.toHaveBeenCalledWith("meatywiki:settings");
  });

  it("is a no-op when no tour keys are present", () => {
    resetAllTourState();
    expect(storageMock.removeItem).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// SSR safety — window / localStorage unavailability
// ---------------------------------------------------------------------------

describe("SSR safety", () => {
  it("getTourState returns null when window is undefined", () => {
    jest.spyOn(global, "window", "get").mockReturnValue(undefined as unknown as Window & typeof globalThis);
    expect(getTourState("any-tour")).toBeNull();
  });

  it("setTourState is a no-op when window is undefined", () => {
    jest.spyOn(global, "window", "get").mockReturnValue(undefined as unknown as Window & typeof globalThis);
    expect(() => setTourState("any-tour", { completed: false, lastStepIndex: 0 })).not.toThrow();
  });

  it("resetAllTourState is a no-op when window is undefined", () => {
    jest.spyOn(global, "window", "get").mockReturnValue(undefined as unknown as Window & typeof globalThis);
    expect(() => resetAllTourState()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// TOUR_STORAGE_PREFIX constant
// ---------------------------------------------------------------------------

describe("TOUR_STORAGE_PREFIX", () => {
  it("has the expected value", () => {
    expect(TOUR_STORAGE_PREFIX).toBe("meatywiki:tour:v1:");
  });
});
