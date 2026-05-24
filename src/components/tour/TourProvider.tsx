'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { EventData, Step } from 'react-joyride';
import { STATUS } from 'react-joyride';

import { TourContext } from './tour-context';
import { setTourState } from '@/lib/storage/tour-state';
import { TOURS, type TourStep } from '@/lib/copy/tours';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

// Lazy-load react-joyride client-side only — it references DOM APIs at import time.
// Extract the named export so next/dynamic receives a default-export component.
const Joyride = dynamic(
  () => import('react-joyride').then((mod) => ({ default: mod.Joyride })),
  { ssr: false },
);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [currentTour, setCurrentTour] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [run, setRun] = useState(false);

  const prefersReducedMotion = usePrefersReducedMotion();
  const pendingTourRef = useRef<string | null>(null);
  const pathname = usePathname();

  const start = useCallback((tourId: string) => {
    const tourDefinitions = TOURS as Record<string, readonly TourStep[]>;
    const tourSteps = tourDefinitions[tourId];
    if (!tourSteps || tourSteps.length === 0) return;

    setCurrentTour(tourId);
    setSteps(tourSteps as Step[]);
    setRun(true);
  }, []);

  const stop = useCallback(() => {
    setRun(false);
    if (currentTour) {
      setTourState(currentTour, {
        completed: true,
        lastStepIndex: 0,
        completedAt: new Date().toISOString(),
      });
    }
    setCurrentTour(null);
    setSteps([]);
  }, [currentTour]);

  const handleJoyrideEvent = useCallback(
    (data: EventData) => {
      const { status } = data;
      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        stop();
      }
    },
    [stop],
  );

  const requestTour = useCallback((tourId: string) => {
    pendingTourRef.current = tourId;
  }, []);

  // Start a pending tour after route navigation has settled.
  useEffect(() => {
    if (!pendingTourRef.current) return;
    const tourId = pendingTourRef.current;
    const timer = setTimeout(() => {
      if (pendingTourRef.current === tourId) {
        start(tourId);
        pendingTourRef.current = null;
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [pathname, start]);

  return (
    <TourContext.Provider value={{ currentTour, start, stop, requestTour }}>
      {children}
      <Joyride
        steps={steps}
        run={run}
        continuous={true}
        onEvent={handleJoyrideEvent}
        options={{
          showProgress: true,
          skipScroll: prefersReducedMotion,
          buttons: ['back', 'close', 'primary', 'skip'],
          primaryColor: 'hsl(var(--primary))',
          backgroundColor: 'hsl(var(--background))',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          textColor: 'hsl(var(--foreground))',
          arrowColor: 'hsl(var(--background))',
          zIndex: 10000,
        }}
      />
    </TourContext.Provider>
  );
}

