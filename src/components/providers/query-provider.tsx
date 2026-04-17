"use client";

/**
 * QueryProvider — wraps the app with TanStack Query's QueryClientProvider.
 *
 * Placed in (main) layout so server components outside (main) are not affected.
 * Uses a stable QueryClient instance per browser tab (React.useState pattern
 * from TanStack docs — avoids creating a new client on each render).
 *
 * Devtools are rendered only in development to keep the production bundle lean.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 60 s stale time — artifact list data changes infrequently
            staleTime: 60_000,
            // Retry once on failure before surfacing error state
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
