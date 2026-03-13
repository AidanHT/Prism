"use client";

/**
 * Returns the `ApiOptions` object required by every API call.
 *
 * The hook reads the current user's ID from the Zustand auth store and wraps
 * it in the shape the API client expects.  All client components that need to
 * call the backend should obtain their options here rather than reading the
 * store directly.
 *
 * For end-to-end testing: update `useAuthStore` with a real user UUID from
 * the seeded database (`backend/app/db/seed.py`), e.g.:
 *   useAuthStore.setState({ user: { id: "<real-uuid>", ... } })
 */

import { useAuthStore } from "@/store/useAuthStore";
import type { ApiOptions } from "@/lib/api";

export function useApiOpts(): ApiOptions {
  const userId = useAuthStore((s) => s.user?.id ?? "");
  return { userId };
}
