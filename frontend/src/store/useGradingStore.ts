import { create } from "zustand";
import type { EvaluateResponse } from "@/lib/types";

interface GradingState {
  /** Maps assignmentId → last-viewed student index in SpeedGrader. */
  studentIndices: Record<string, number>;
  getIndex: (assignmentId: string) => number;
  setIndex: (assignmentId: string, index: number) => void;

  /** AI Co-Pilot state for the active grading session. */
  aiSuggestion: EvaluateResponse | null;
  isEvaluating: boolean;
  anomalyWarning: boolean;
  setAiSuggestion: (s: EvaluateResponse | null) => void;
  setIsEvaluating: (v: boolean) => void;
  setAnomalyWarning: (v: boolean) => void;
  resetSession: () => void;
}

export const useGradingStore = create<GradingState>()((set, get) => ({
  studentIndices: {},

  getIndex: (assignmentId) => get().studentIndices[assignmentId] ?? 0,

  setIndex: (assignmentId, index) =>
    set((state) => ({
      studentIndices: { ...state.studentIndices, [assignmentId]: index },
    })),

  aiSuggestion: null,
  isEvaluating: false,
  anomalyWarning: false,

  setAiSuggestion: (s) => set({ aiSuggestion: s }),
  setIsEvaluating: (v) => set({ isEvaluating: v }),
  setAnomalyWarning: (v) => set({ anomalyWarning: v }),

  resetSession: () =>
    set({ aiSuggestion: null, isEvaluating: false, anomalyWarning: false }),
}));
