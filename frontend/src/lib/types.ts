/**
 * TypeScript types mirroring the Pydantic response schemas from the Prism
 * FastAPI backend.  Keep these in sync with backend/app/schemas/*.py.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type EnrollmentRole = "student" | "ta" | "professor";

export type ModuleItemType =
  | "assignment"
  | "quiz"
  | "page"
  | "file"
  | "external_url";

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "essay"
  | "matching";

export type EventType =
  | "assignment_due"
  | "quiz_due"
  | "course_event"
  | "personal";

// ── Enrollments ───────────────────────────────────────────────────────────────

export interface EnrollmentResponse {
  id: string;
  user_id: string;
  course_id: string;
  role: EnrollmentRole;
  enrolled_at: string;
  created_at: string;
  updated_at: string;
}

// ── Courses ───────────────────────────────────────────────────────────────────

export interface CourseResponse {
  id: string;
  title: string;
  code: string;
  description: string | null;
  term: string | null;
  instructor_id: string;
  grading_scheme: Record<string, unknown> | null;
  late_policy: Record<string, unknown> | null;
  enrollments: EnrollmentResponse[] | null;
  created_at: string;
  updated_at: string;
}

// ── Assignments ───────────────────────────────────────────────────────────────

export interface AssignmentResponse {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  points_possible: number;
  due_date: string | null;
  lock_date: string | null;
  submission_types: string[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubmissionResponse {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  body: string | null;
  file_url: string | null;
  grade: number | null;
  grader_id: string | null;
  graded_at: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
}

// ── Quizzes ───────────────────────────────────────────────────────────────────

export interface QuizQuestionOptions {
  choices: string[];
}

export interface QuizQuestionResponse {
  id: string;
  quiz_id: string;
  question_type: QuestionType;
  question_text: string;
  points: number;
  position: number;
  options: QuizQuestionOptions | null;
  correct_answer: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizResponse {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  time_limit_minutes: number | null;
  attempt_limit: number | null;
  points_possible: number;
  is_published: boolean;
  available_from: string | null;
  available_until: string | null;
  questions: QuizQuestionResponse[];
  created_at: string;
  updated_at: string;
}

export interface QuizAttemptResponse {
  id: string;
  quiz_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  answers: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// ── Grades ────────────────────────────────────────────────────────────────────

export interface GradeResponse {
  id: string;
  enrollment_id: string;
  assignment_id: string | null;
  quiz_id: string | null;
  score: number;
  max_score: number;
  grader_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Gradebook ─────────────────────────────────────────────────────────────────

export interface GradebookGradeEntry {
  grade_id: string;
  assignment_id: string | null;
  quiz_id: string | null;
  score: number;
  max_score: number;
}

export interface GradebookStudentRow {
  student_id: string;
  student_name: string;
  student_email: string;
  enrollment_id: string;
  grades: GradebookGradeEntry[];
}

export interface GradebookAssignment {
  id: string;
  title: string;
  points_possible: number;
}

export interface GradebookResponse {
  course_id: string;
  assignments: GradebookAssignment[];
  students: GradebookStudentRow[];
}

// ── File upload ───────────────────────────────────────────────────────────────

/** Mirrors UploadUrlResponse from backend/app/routers/files.py */
export interface UploadUrlResponse {
  url: string;
  fields: Record<string, string>;
  s3_key: string;
}

// ── Announcements ─────────────────────────────────────────────────────────────

export interface AnnouncementResponse {
  id: string;
  course_id: string;
  title: string;
  body: string;
  author_id: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export interface CalendarEventResponse {
  id: string;
  course_id: string | null;
  user_id: string | null;
  title: string;
  description: string | null;
  event_type: EventType;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}
