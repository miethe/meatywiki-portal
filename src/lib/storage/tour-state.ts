export const TOUR_STORAGE_PREFIX = "meatywiki:tour:v1:" as const;

export type TourState = {
  completed: boolean;
  lastStepIndex: number;
  completedAt?: string;
};

/**
 * Returns true when localStorage is available (browser context, not SSR).
 */
function isStorageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

/**
 * Retrieves persisted tour state for the given tourId.
 * Returns null if the tourId has no stored state or localStorage is unavailable.
 */
export function getTourState(tourId: string): TourState | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(`${TOUR_STORAGE_PREFIX}${tourId}`);
    if (raw === null) return null;
    return JSON.parse(raw) as TourState;
  } catch {
    return null;
  }
}

/**
 * Persists tour state for the given tourId.
 * No-ops silently when localStorage is unavailable (SSR or storage quota exceeded).
 */
export function setTourState(tourId: string, value: TourState): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(`${TOUR_STORAGE_PREFIX}${tourId}`, JSON.stringify(value));
  } catch {
    // quota exceeded or storage blocked — silently ignore
  }
}

/**
 * Removes all tour state entries that match the namespace prefix.
 * Other localStorage keys are left untouched.
 */
export function resetAllTourState(): void {
  if (!isStorageAvailable()) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key !== null && key.startsWith(TOUR_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // storage blocked — silently ignore
  }
}
