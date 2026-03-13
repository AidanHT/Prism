/**
 * Persistent Zustand store for active quiz sessions.
 *
 * Survives tab closures / refreshes via localStorage.  The timer is
 * re-hydrated using the server-authoritative `serverStartedAt` timestamp
 * rather than relying on a client-side counter that resets on reload.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface QuizSession {
  quizId: string;
  attemptId: string;
  /** ISO string from attempt.started_at — used to re-derive time remaining. */
  serverStartedAt: string;
  timeLimitSeconds: number;
  answers: Record<string, string>;
  phase: "taking" | "submitted";
  finalScore: number | null;
}

interface QuizStoreState {
  sessions: Record<string, QuizSession>;
  setSession: (quizId: string, session: QuizSession) => void;
  updateAnswers: (quizId: string, answers: Record<string, string>) => void;
  markSubmitted: (quizId: string, finalScore: number | null) => void;
  clearSession: (quizId: string) => void;
}

export const useQuizStore = create<QuizStoreState>()(
  persist(
    (set) => ({
      sessions: {},

      setSession: (quizId, session) =>
        set((s) => ({ sessions: { ...s.sessions, [quizId]: session } })),

      updateAnswers: (quizId, answers) =>
        set((s) => {
          const existing = s.sessions[quizId];
          if (!existing) return s;
          return {
            sessions: { ...s.sessions, [quizId]: { ...existing, answers } },
          };
        }),

      markSubmitted: (quizId, finalScore) =>
        set((s) => {
          const existing = s.sessions[quizId];
          if (!existing) return s;
          return {
            sessions: {
              ...s.sessions,
              [quizId]: {
                ...existing,
                phase: "submitted",
                finalScore,
              },
            },
          };
        }),

      clearSession: (quizId) =>
        set((s) => {
          const next = { ...s.sessions };
          delete next[quizId];
          return { sessions: next };
        }),
    }),
    {
      name: "prism-quiz-sessions",
      version: 1,
    },
  ),
);

/**
 * Compute seconds remaining from a server-authoritative start time.
 * Returns 0 if the time limit has already elapsed.
 */
export function deriveSecondsLeft(
  serverStartedAt: string,
  timeLimitSeconds: number,
): number {
  const elapsedMs = Date.now() - Date.parse(serverStartedAt);
  const elapsed = Math.floor(elapsedMs / 1000);
  return Math.max(0, timeLimitSeconds - elapsed);
}
