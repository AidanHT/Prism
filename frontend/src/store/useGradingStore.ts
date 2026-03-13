import { create } from "zustand";

interface GradingState {
  /** Maps assignmentId → last-viewed student index in SpeedGrader. */
  studentIndices: Record<string, number>;
  getIndex: (assignmentId: string) => number;
  setIndex: (assignmentId: string, index: number) => void;
}

export const useGradingStore = create<GradingState>()((set, get) => ({
  studentIndices: {},

  getIndex: (assignmentId) => get().studentIndices[assignmentId] ?? 0,

  setIndex: (assignmentId, index) =>
    set((state) => ({
      studentIndices: { ...state.studentIndices, [assignmentId]: index },
    })),
}));
