"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 60 seconds before a background refetch.
        staleTime: 60 * 1000,
        // Never cache server errors — always retry on next mount.
        retry: (failureCount, error) => {
          if (
            typeof error === "object" &&
            error !== null &&
            "status" in error &&
            typeof (error as { status: unknown }).status === "number"
          ) {
            const status = (error as { status: number }).status;
            if (status >= 400 && status < 500) return false;
          }
          return failureCount < 2;
        },
      },
    },
  });
}

// Singleton for the server — a new instance per request on the client.
let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export { getQueryClient };

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState ensures the client is not re-created on every render.
  const [queryClient] = useState(getQueryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
