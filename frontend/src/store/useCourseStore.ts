import { create } from "zustand";

export type CourseRole = "Student" | "TA" | "Professor";

export interface MockCourse {
  id: string;
  title: string;
  code: string;
  term: string;
  colorCode: string;
}

/**
 * Mock course list that mirrors the seeded courses in `backend/app/db/seed.py`.
 * IDs are deterministic uuid5 values generated via `_stable_id(code)`.
 */
const MOCK_COURSES: MockCourse[] = [
  { id: "2546a124-6173-581b-9266-e49c5cd9da10", title: "CS 301 Data Structures", code: "CS301", term: "Spring 2026", colorCode: "#6366f1" },
  { id: "ca9b55f9-1176-566e-9818-16b5a2dce9c1", title: "ECE 243 Computer Organization", code: "ECE243", term: "Spring 2026", colorCode: "#0ea5e9" },
  { id: "aad031eb-7b91-56ec-9949-38414848b359", title: "MATH 240 Linear Algebra", code: "MATH240", term: "Spring 2026", colorCode: "#10b981" },
];

interface CourseState {
  activeCourseId: string | null;
  courseRole: CourseRole;
  courses: MockCourse[];
  setActiveCourse: (id: string) => void;
  clearActiveCourse: () => void;
  setCourseRole: (role: CourseRole) => void;
}

export const useCourseStore = create<CourseState>()((set) => ({
  activeCourseId: null,
  courseRole: "Professor",
  courses: MOCK_COURSES,

  setActiveCourse: (id) => set({ activeCourseId: id }),

  clearActiveCourse: () => set({ activeCourseId: null }),

  setCourseRole: (role) => set({ courseRole: role }),
}));
