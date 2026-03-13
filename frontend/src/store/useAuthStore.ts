import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "Student" | "Professor" | "TA";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  /** Dev-only: swap the active role without touching the rest of the session. */
  setRole: (role: UserRole) => void;
}

/**
 * Seed user so the UI is immediately visible in development.
 * Must match a deterministic UUID from `backend/app/db/seed.py` (`_stable_id`).
 */
const MOCK_USER: AuthUser = {
  id: "92833cf6-36aa-5263-9cfe-334b230a1540",
  email: "s.chen@university.edu",
  name: "Dr. Sarah Chen",
  role: "Professor",
};

const MOCK_TOKEN = "mock-jwt-token";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: MOCK_USER,
      token: MOCK_TOKEN,
      isAuthenticated: true,

      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),

      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),

      setRole: (role) =>
        set((state) => ({
          user: state.user ? { ...state.user, role } : null,
        })),
    }),
    {
      name: "prism-auth",
      // Bump version whenever the MOCK_USER changes so stale localStorage
      // (e.g. old "dev-001") is automatically replaced with the new defaults.
      version: 2,
      // Only persist the token and user — not derived state.
      partialize: (state) => ({ user: state.user, token: state.token }),
      // Re-derive isAuthenticated on rehydration.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = state.token !== null;
        }
      },
    },
  ),
);
