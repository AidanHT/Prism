import { create } from "zustand";

export type CourseRole = "Student" | "TA" | "Professor";

export interface MockCourse {
  id: string;
  title: string;
  code: string;
  term: string;
  colorCode: string;
}

const MOCK_COURSES: MockCourse[] = [
  { id: "course-001", title: "Introduction to Computer Science", code: "CS 101", term: "Spring 2026", colorCode: "#6366f1" },
  { id: "course-002", title: "Data Structures & Algorithms", code: "CS 201", term: "Spring 2026", colorCode: "#0ea5e9" },
  { id: "course-003", title: "Machine Learning Fundamentals", code: "CS 445", term: "Spring 2026", colorCode: "#10b981" },
  { id: "course-004", title: "Database Systems", code: "CS 350", term: "Spring 2026", colorCode: "#f59e0b" },
  { id: "course-005", title: "Software Engineering", code: "CS 410", term: "Spring 2026", colorCode: "#ef4444" },
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
