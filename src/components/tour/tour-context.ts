'use client';

import { createContext, useContext } from 'react';

export type TourContextValue = {
  currentTour: string | null;
  start: (tourId: string) => void;
  stop: () => void;
  requestTour: (tourId: string) => void;
};

export const TourContext = createContext<TourContextValue | null>(null);

export function useTourContext() {
  return useContext(TourContext);
}
