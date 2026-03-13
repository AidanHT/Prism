/**
 * Typed API client for the Prism FastAPI backend.
 *
 * All requests go through this module — never call fetch() directly in
 * components.  The backend's MVP auth layer reads the `X-User-Id` request
 * header (a UUID) to identify the caller.  Pass `userId` via `ApiOptions`
 * on every call.
 *
 * NOTE: For end-to-end testing, `userId` must match a real user UUID in
 * the seeded database (e.g. from `backend/app/db/seed.py`).
 */

import type {
  AnnouncementResponse,
  AssignmentResponse,
  CalendarEventResponse,
  CourseResponse,
  EnrollmentResponse,
  GradebookResponse,
  GradeResponse,
  MessageResponse,
  NotificationResponse,
  QuizAttemptResponse,
  QuizResponse,
  SubmissionResponse,
  UploadUrlResponse,
  UserMeResponse,
  UserSearchResult,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Error class ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Auth options ──────────────────────────────────────────────────────────────

/** Pass on every API call so the backend can identify the caller. */
export interface ApiOptions {
  /** UUID of the currently authenticated user — injected as X-User-Id. */
  userId: string;
}

// ── Core request function ─────────────────────────────────────────────────────

async function request<T>(
  path: string,
  init: RequestInit,
  { userId }: ApiOptions,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      // Simulated Cognito sub — replace with real JWT when moving off MVP.
      "X-User-Id": userId,
      ...init.headers,
    },
  });

  // 204 No Content
  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(res.status, body, `API ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

// Convenience wrappers
function get<T>(path: string, opts: ApiOptions) {
  return request<T>(path, { method: "GET" }, opts);
}
function post<T>(path: string, body: unknown, opts: ApiOptions) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) }, opts);
}
function put<T>(path: string, body: unknown, opts: ApiOptions) {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) }, opts);
}
function del<T>(path: string, opts: ApiOptions) {
  return request<T>(path, { method: "DELETE" }, opts);
}

// ── Typed endpoint namespaces ─────────────────────────────────────────────────

/** Course catalogue endpoints. */
export const courseApi = {
  list: (opts: ApiOptions) => get<CourseResponse[]>("/courses", opts),

  get: (courseId: string, opts: ApiOptions) =>
    get<CourseResponse>(`/courses/${courseId}`, opts),

  enrollments: (courseId: string, opts: ApiOptions) =>
    get<EnrollmentResponse[]>(`/courses/${courseId}/enrollments`, opts),

  assignments: (courseId: string, opts: ApiOptions) =>
    get<AssignmentResponse[]>(`/courses/${courseId}/assignments`, opts),

  quizzes: (courseId: string, opts: ApiOptions) =>
    get<QuizResponse[]>(`/courses/${courseId}/quizzes`, opts),

  announcements: (courseId: string, opts: ApiOptions) =>
    get<AnnouncementResponse[]>(`/courses/${courseId}/announcements`, opts),

  gradebook: (courseId: string, opts: ApiOptions) =>
    get<GradebookResponse>(`/courses/${courseId}/gradebook`, opts),
} as const;

/** Assignment + submission endpoints. */
export const assignmentApi = {
  get: (assignmentId: string, opts: ApiOptions) =>
    get<AssignmentResponse>(`/assignments/${assignmentId}`, opts),

  create: (
    courseId: string,
    payload: {
      course_id: string;
      title: string;
      description?: string;
      points_possible: number;
      due_date?: string;
      lock_date?: string;
      submission_types: string[];
      is_published: boolean;
    },
    opts: ApiOptions,
  ) => post<AssignmentResponse>(`/courses/${courseId}/assignments`, payload, opts),

  update: (
    assignmentId: string,
    payload: {
      title?: string;
      description?: string;
      points_possible?: number;
      due_date?: string;
      lock_date?: string;
      submission_types?: string[];
      is_published?: boolean;
    },
    opts: ApiOptions,
  ) => put<AssignmentResponse>(`/assignments/${assignmentId}`, payload, opts),

  remove: (assignmentId: string, opts: ApiOptions) =>
    del<void>(`/assignments/${assignmentId}`, opts),

  submit: (
    assignmentId: string,
    payload: { body?: string; file_url?: string },
    opts: ApiOptions,
  ) =>
    post<SubmissionResponse>(
      `/assignments/${assignmentId}/submit`,
      payload,
      opts,
    ),

  /** All submissions for an assignment (professor/TA). */
  submissions: (assignmentId: string, opts: ApiOptions) =>
    get<SubmissionResponse[]>(`/assignments/${assignmentId}/submissions`, opts),

  /** Current user's submission for an assignment. */
  mySubmission: (assignmentId: string, opts: ApiOptions) =>
    get<SubmissionResponse | null>(
      `/assignments/${assignmentId}/submissions/me`,
      opts,
    ),

  /** Current user's submissions across all assignments in a course. */
  myCourseSubmissions: (courseId: string, opts: ApiOptions) =>
    get<SubmissionResponse[]>(`/courses/${courseId}/submissions/me`, opts),
} as const;

/** Quiz and attempt lifecycle endpoints. */
export const quizApi = {
  get: (quizId: string, opts: ApiOptions) =>
    get<QuizResponse>(`/quizzes/${quizId}`, opts),

  startAttempt: (quizId: string, opts: ApiOptions) =>
    post<QuizAttemptResponse>(`/quizzes/${quizId}/attempt`, {}, opts),

  updateAttempt: (
    quizId: string,
    attemptId: string,
    payload: { answers: Record<string, string> },
    opts: ApiOptions,
  ) =>
    put<QuizAttemptResponse>(
      `/quizzes/${quizId}/attempt/${attemptId}`,
      payload,
      opts,
    ),

  submitAttempt: (quizId: string, attemptId: string, opts: ApiOptions) =>
    post<QuizAttemptResponse>(
      `/quizzes/${quizId}/attempt/${attemptId}/submit`,
      {},
      opts,
    ),
} as const;

/** Grade CRUD endpoints. */
export const gradeApi = {
  update: (
    gradeId: string,
    payload: { score: number; feedback?: string },
    opts: ApiOptions,
  ) => put<GradeResponse>(`/grades/${gradeId}`, payload, opts),
} as const;

/** File upload endpoints (S3 presigned POST flow). */
export const fileApi = {
  /** Step 1 – get a presigned POST URL and fields for direct S3 upload. */
  uploadUrl: (
    payload: {
      course_id: string;
      filename: string;
      content_type: string;
      folder_path: string;
    },
    opts: ApiOptions,
  ) => post<UploadUrlResponse>("/files/upload_url", payload, opts),
} as const;

/** Calendar endpoints. */
export const calendarApi = {
  events: (startDate: string, endDate: string, opts: ApiOptions) =>
    get<CalendarEventResponse[]>(
      `/calendar?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
      opts,
    ),
} as const;

/** Direct messaging endpoints. */
export const messageApi = {
  list: (opts: ApiOptions) => get<MessageResponse[]>("/messages", opts),

  get: (messageId: string, opts: ApiOptions) =>
    get<MessageResponse>(`/messages/${messageId}`, opts),

  create: (
    payload: {
      subject: string;
      body: string;
      course_id?: string;
      recipient_ids: string[];
    },
    opts: ApiOptions,
  ) => post<MessageResponse>("/messages", payload, opts),

  reply: (messageId: string, payload: { body: string }, opts: ApiOptions) =>
    post<MessageResponse>(`/messages/${messageId}/reply`, payload, opts),

  markRead: (messageId: string, opts: ApiOptions) =>
    request<void>(`/messages/${messageId}/read`, { method: "PATCH" }, opts),
} as const;

/** Notification endpoints. */
export const notificationApi = {
  list: (opts: ApiOptions) =>
    get<NotificationResponse[]>("/notifications", opts),

  markAllRead: (opts: ApiOptions) =>
    request<void>("/notifications/read-all", { method: "PATCH" }, opts),

  markRead: (notificationId: string, opts: ApiOptions) =>
    request<NotificationResponse>(
      `/notifications/${notificationId}`,
      { method: "PATCH" },
      opts,
    ),
} as const;

/** Forum threads, posts, and AI endpoints. */
export const forumApi = {
  listThreads: (courseId: string, opts: ApiOptions) =>
    get<
      {
        id: string;
        course_id: string;
        title: string;
        cluster_id: string | null;
        vector_embedding_id: string | null;
        created_at: string;
      }[]
    >(`/forum/courses/${courseId}/threads`, opts),

  getThread: (
    threadId: string,
    opts: ApiOptions,
  ) =>
    get<{
      id: string;
      course_id: string;
      title: string;
      cluster_id: string | null;
      vector_embedding_id: string | null;
      created_at: string;
    }>(`/forum/threads/${threadId}`, opts),

  createThread: (
    payload: {
      course_id: string;
      title: string;
      content: string;
      author_id: string;
      cluster_id?: string;
    },
    opts: ApiOptions,
  ) =>
    post<{
      id: string;
      course_id: string;
      title: string;
      cluster_id: string | null;
      vector_embedding_id: string | null;
      created_at: string;
    }>("/forum/threads", payload, opts),

  listPosts: (threadId: string, opts: ApiOptions) =>
    get<
      {
        id: string;
        thread_id: string;
        author_id: string;
        content: string;
        timestamp: string;
      }[]
    >(`/forum/threads/${threadId}/posts`, opts),

  createPost: (
    threadId: string,
    payload: { author_id: string; content: string },
    opts: ApiOptions,
  ) =>
    post<{
      id: string;
      thread_id: string;
      author_id: string;
      content: string;
      timestamp: string;
    }>(`/forum/threads/${threadId}/posts`, payload, opts),

  taCheck: (
    payload: { thread_id: string; course_id: string; draft_response: string },
    opts: ApiOptions,
  ) =>
    post<{ is_accurate: boolean; tone_score: number; suggested_edits: string }>(
      "/forum/ta-check",
      payload,
      opts,
    ),

  addToBrain: (
    payload: { thread_id: string },
    role: "professor" | "ta",
    opts: ApiOptions,
  ) =>
    request<{ doc_id: string; message: string }>(
      "/forum/add-to-brain",
      {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "X-User-Role": role },
      },
      opts,
    ),
} as const;

/** User profile and search endpoints. */
export const userApi = {
  me: (opts: ApiOptions) => get<UserMeResponse>("/users/me", opts),

  patch: (
    payload: {
      name?: string;
      bio?: string;
      timezone?: string;
      avatar_url?: string;
    },
    opts: ApiOptions,
  ) =>
    request<UserMeResponse>(
      "/users/me",
      { method: "PATCH", body: JSON.stringify(payload) },
      opts,
    ),

  search: (q: string, opts: ApiOptions) =>
    get<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`, opts),
} as const;
