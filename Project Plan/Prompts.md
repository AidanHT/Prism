# Project Prism – Implementation Prompts

---

## Phase 1: Foundation & Scaffolding (COMPLETED)

**Goal:** Initialize the Next.js 15 frontend, set up the FastAPI backend, and establish the project structure with mock AWS connections.

### Prompt 1:

"Initialize a monorepo with two projects:

1. **Frontend** (`frontend/`): A Next.js 15 project using the App Router with TypeScript and Tailwind CSS v4. Set up shadcn/ui and install the essential layout components: Sidebar, Navbar, Button, Card, and Dialog.

2. **Backend** (`backend/`): A Python 3.12 FastAPI project with the following structure:
   - `backend/app/main.py` — FastAPI application entry point with CORS middleware configured for the Next.js frontend.
   - `backend/app/routers/` — One router module per domain (courses, users, etc.).
   - `backend/app/services/` — Shared service modules (e.g., `bedrock.py` for AWS Bedrock calls via Boto3).
   - `backend/app/models/` — SQLAlchemy 2.x async ORM models.
   - `backend/app/schemas/` — Pydantic v2 request/response schemas.
   - `backend/app/core/config.py` — Pydantic `Settings` class for environment variable validation.

Create the frontend directory structure:
- `frontend/src/app/(dashboard)` for the authenticated LMS views.
- `frontend/src/lib/` for shared utilities and API client helpers.

Finally, build a mock AuthContext using React Context to simulate Amazon Cognito. It should allow toggling between two user roles: 'Student' and 'Professor'. Create a basic layout with a sidebar that changes its navigation links based on the active role."

---

## Phase 1.1: Core LMS Pages & Course Navigation

**Goal:** Build out the complete frontend routing structure to mirror Canvas LMS. Every major LMS function gets its own dedicated page. Establish the course-level layout with sub-navigation so users can navigate within a course exactly as they do in Canvas.

### Prompt 1.1:

"We need to expand the frontend from a handful of stub pages into a full Canvas-equivalent page structure. The app currently has a global sidebar with basic role switching. We need to add:

**1. Global Pages — Add the following routes under `(dashboard)/`:**

- `/dashboard` — Redesign the dashboard to be a proper LMS landing page:
  - **Course cards grid** showing enrolled courses with course code, title, instructor name, and a colored header bar (each course gets a distinct color).
  - **Upcoming assignments** panel (right sidebar or bottom section) listing the next 5 due items across all courses with countdown timers.
  - **Recent announcements** feed showing the latest 3-5 announcements across all courses.
  - **To-do list** widget for items needing attention (unsubmitted assignments, unread messages).
  - Use shadcn Card, Badge, and Avatar components. Add subtle Framer Motion stagger animations when the cards load.

- `/courses` — All-courses page showing a searchable, filterable grid of enrolled courses. Professors see a 'Create Course' button.

- `/calendar` — Global calendar page using a calendar component (FullCalendar or a custom implementation with date-fns). Display assignment due dates and course events across all courses. Support month, week, and agenda views. Color-code events by course.

- `/inbox` — Messaging center with a two-panel layout: conversation list on the left, message thread on the right. Support composing new messages, replying, and filtering by course. Use a dynamic route `/inbox/[conversationId]` for deep-linking to a conversation.

- `/notifications` — Notification center showing all notifications in a feed. Each item shows type (grade, announcement, message, deadline), timestamp, and read/unread status. Include a settings section for configuring notification preferences (email, push, in-app toggles per event type).

- `/profile` — User profile page with editable fields: display name, email, bio, avatar upload, timezone selector, and language preference.

**2. Course-Level Layout & Sub-Navigation:**

Create a new layout at `(dashboard)/course/[courseId]/layout.tsx`. This layout should:

- Render a **course-specific sidebar** (inside the main content area, not replacing the global sidebar) with navigation links to all course sub-pages. The sidebar items should match Canvas:
  - Home, Announcements, Syllabus, Modules, Assignments, Quizzes, Discussions, Grades (students) / Gradebook (professors), People, Pages, Files.
  - Professors additionally see: Rubrics, Analytics, Settings.
- Show a **course header bar** at the top with the course title, course code, and term.
- The course sidebar should be collapsible on mobile.
- Read the `courseId` from the URL params and set it in the Zustand `useCourseStore`.

**3. Course Sub-Pages — Create placeholder pages for every route:**

Under `(dashboard)/course/[courseId]/`, create the following page files. Each should be a placeholder with the page title, a breadcrumb, and a brief description of what the page will contain (using shadcn Card for the empty state):

- `page.tsx` — Course Home
- `announcements/page.tsx` — Announcements list
- `announcements/[announcementId]/page.tsx` — Announcement detail
- `announcements/new/page.tsx` — Create announcement (professor only)
- `syllabus/page.tsx` — Syllabus view
- `modules/page.tsx` — Modules list
- `modules/[moduleId]/page.tsx` — Module detail
- `assignments/page.tsx` — Assignment list
- `assignments/[assignmentId]/page.tsx` — Assignment detail
- `assignments/[assignmentId]/submit/page.tsx` — Submit assignment (student)
- `assignments/[assignmentId]/grade/page.tsx` — SpeedGrader (professor)
- `assignments/new/page.tsx` — Create assignment (professor)
- `quizzes/page.tsx` — Quiz list
- `quizzes/[quizId]/page.tsx` — Quiz detail / take quiz
- `quizzes/[quizId]/results/page.tsx` — Quiz results
- `quizzes/new/page.tsx` — Create quiz (professor)
- `discussions/page.tsx` — Discussion list
- `discussions/[discussionId]/page.tsx` — Discussion thread
- `discussions/new/page.tsx` — New discussion
- `grades/page.tsx` — Student grades view
- `gradebook/page.tsx` — Professor gradebook
- `people/page.tsx` — Class roster
- `pages/page.tsx` — Content pages list
- `pages/[slug]/page.tsx` — Content page detail
- `files/page.tsx` — File browser
- `rubrics/page.tsx` — Rubrics management (professor)
- `analytics/page.tsx` — Course analytics (professor)
- `settings/page.tsx` — Course settings (professor)

**4. Update the global sidebar (AppSidebar.tsx):**

Update the sidebar navigation to include links for: Dashboard, Courses, Calendar, Inbox, and Notifications. These should appear for all roles. Remove the current feature-specific links (Grading, Analytics, Course Sync, Forum) — those features will live inside individual course pages instead.

**5. UI polish:**

- Use consistent Framer Motion page transitions between routes.
- Add a loading skeleton (shadcn Skeleton) for all pages.
- Ensure fully responsive design — the course sidebar collapses into a drawer on mobile.
- Use a consistent color scheme and typography scale throughout."

---

## Phase 2: Core Data Models, CRUD & Functional Course Pages

**Goal:** Define all relational data models, set up migrations, seed the database, and build out CRUD endpoints and functional frontend pages for the core LMS features.

### Prompt 2:

"We need to establish our complete data layer and build functional CRUD pages for the core LMS.

**Part A — Database Models (`backend/app/models/`):**

Define SQLAlchemy 2.x async ORM models for the following entities. Ensure all relationships and foreign keys are properly configured:

- **User** — id, email, name, role (enum: Student, TA, Professor, Admin), avatar_url, bio, timezone, created_at, updated_at
- **Course** — id, title, code, description, term, instructor_id (FK → User), grading_scheme, late_policy, created_at, updated_at
- **Enrollment** — id, user_id (FK → User), course_id (FK → Course), role (enum: Student, TA, Professor), enrolled_at
- **Module** — id, course_id (FK → Course), title, description, position (ordering), is_published, created_at
- **ModuleItem** — id, module_id (FK → Module), item_type (enum: Assignment, Quiz, Page, File, ExternalURL), item_id, position, is_published
- **Assignment** — id, course_id (FK → Course), title, description (rich text), points_possible, due_date, lock_date, submission_types (enum array: text, file, url), is_published, created_at, updated_at
- **Submission** — id, assignment_id (FK → Assignment), student_id (FK → User), submitted_at, body (text), file_url, grade, grader_id (FK → User), graded_at, feedback
- **Quiz** — id, course_id (FK → Course), title, description, time_limit_minutes, attempt_limit, points_possible, is_published, available_from, available_until, created_at
- **QuizQuestion** — id, quiz_id (FK → Quiz), question_type (enum: multiple_choice, true_false, short_answer, essay, matching), question_text, points, position, options (JSON), correct_answer
- **QuizAttempt** — id, quiz_id (FK → Quiz), student_id (FK → User), started_at, submitted_at, score, answers (JSON)
- **Discussion** — id, course_id (FK → Course), title, body, author_id (FK → User), is_pinned, is_locked, created_at
- **DiscussionReply** — id, discussion_id (FK → Discussion), author_id (FK → User), body, parent_reply_id (self-FK for threading), created_at
- **Announcement** — id, course_id (FK → Course), title, body, author_id (FK → User), is_published, created_at
- **Page** — id, course_id (FK → Course), title, slug, body (rich text), author_id (FK → User), is_published, created_at, updated_at
- **CourseFile** — id, course_id (FK → Course), folder_path, filename, s3_key, content_type, size_bytes, uploaded_by (FK → User), created_at
- **Rubric** — id, course_id (FK → Course), title, created_at
- **RubricCriterion** — id, rubric_id (FK → Rubric), description, points, position, ratings (JSON array of {description, points})
- **Grade** — id, enrollment_id (FK → Enrollment), assignment_id (FK → Assignment, nullable), quiz_id (FK → Quiz, nullable), score, max_score, grader_id (FK → User, nullable), created_at
- **CalendarEvent** — id, course_id (FK → Course, nullable), user_id (FK → User, nullable), title, description, event_type (enum: assignment_due, quiz_due, course_event, personal), start_date, end_date
- **Message** — id, sender_id (FK → User), subject, body, course_id (FK → Course, nullable), created_at
- **MessageRecipient** — id, message_id (FK → Message), recipient_id (FK → User), read_at
- **Notification** — id, user_id (FK → User), type (enum: grade_published, announcement, message, deadline_reminder, submission_received), title, body, is_read, link, created_at

Set up Alembic for database migrations in `backend/alembic/`.

**Part B — Pydantic Schemas (`backend/app/schemas/`):**

Create Pydantic v2 request/response schemas for each model. Organize by domain:
- `schemas/courses.py` — CourseCreate, CourseUpdate, CourseResponse, EnrollmentResponse
- `schemas/assignments.py` — AssignmentCreate, AssignmentUpdate, AssignmentResponse, SubmissionCreate, SubmissionResponse
- `schemas/quizzes.py` — QuizCreate, QuizQuestionCreate, QuizAttemptCreate, QuizResponse
- `schemas/modules.py` — ModuleCreate, ModuleItemCreate, ModuleResponse
- `schemas/discussions.py` — DiscussionCreate, DiscussionReplyCreate, DiscussionResponse
- `schemas/grades.py` — GradeCreate, GradeResponse, GradebookRow
- `schemas/content.py` — AnnouncementCreate, PageCreate, FileUploadResponse
- `schemas/users.py` — UserProfile, UserUpdate, MessageCreate, NotificationResponse
- `schemas/calendar.py` — CalendarEventCreate, CalendarEventResponse

Create Pydantic v2 schemas in `backend/app/schemas/dynamo.py` for our unstructured data: ForumThread, ForumPost, and ChatSession.

**Part C — Seed Script:**

Write a seed script (`backend/app/db/seed.py`) that populates the database with realistic demo data:
- 3 courses (e.g., 'CS 301 Data Structures', 'MATH 240 Linear Algebra', 'ENG 102 Academic Writing')
- 2 professors, 2 TAs, 8 students with realistic names
- Per course: 4 modules with 3-5 items each, 5 assignments (with due dates spread across 2 months), 2 quizzes (with 5 questions each), 3 discussions, 5 announcements, 3 pages, a syllabus
- Some submissions and grades already entered for demo purposes
- Calendar events auto-generated from assignment and quiz due dates

**Part D — CRUD Routers:**

Create FastAPI routers with full CRUD endpoints for:
- `routers/courses.py` — GET /courses, GET /courses/{id}, POST /courses, PUT /courses/{id}, GET /courses/{id}/enrollments
- `routers/assignments.py` — Standard CRUD scoped to a course, plus POST /assignments/{id}/submit for student submissions
- `routers/quizzes.py` — Quiz CRUD, GET questions, POST attempt
- `routers/modules.py` — Module CRUD, reorder items (PATCH position), add/remove items
- `routers/discussions.py` — Discussion CRUD, POST reply
- `routers/announcements.py` — Announcement CRUD
- `routers/pages.py` — Page CRUD by slug
- `routers/files.py` — GET list, POST upload (S3 presigned URL generation), DELETE
- `routers/users.py` — GET profile, PUT profile, GET /courses/{id}/people (roster)
- `routers/grades.py` — GET student grades, GET gradebook (professor), POST/PUT grade, GET CSV export
- `routers/calendar.py` — GET events (filterable by date range and course)
- `routers/messages.py` — GET conversations, GET thread, POST message
- `routers/notifications.py` — GET notifications, PATCH mark-read, PUT preferences

**Part E — Functional Frontend Pages:**

Connect the placeholder pages from Phase 1.1 to the real API endpoints:

- **Course Home** — Fetch and display recent announcements, upcoming assignments, and module progress for the course.
- **Announcements** — Render announcement list and detail pages with rich text. Professors see create/edit forms using TipTap rich text editor.
- **Syllabus** — Render the syllabus body and auto-generate a schedule table from the course's assignment and quiz due dates.
- **Modules** — Render collapsible module accordion with items. Items link to their respective pages (assignments, quizzes, pages, files). Professors can drag-and-drop reorder.
- **People** — Render the class roster in a table with avatar, name, role badge, and email.
- **Pages** — Render wiki-style content pages. Professors edit via TipTap.
- **Files** — Render a file browser with folder navigation, file type icons, and download links. Professors get an upload dropzone.
- **All Courses** — Fetch and render the course grid. Search and filter by term/code."

---

## Phase 2.5: Student & Professor Core Workflows

**Goal:** Build the interactive workflows that students and professors use daily — assignment submission, quiz taking, gradebook management, calendar, and messaging.

### Prompt 2.5:

"With our data models and CRUD endpoints in place, let's build the core interactive workflows.

**1. Assignment Workflow (Student Side):**

Build the complete assignment experience:

- **Assignment List** (`/course/[id]/assignments`) — Group assignments by status: 'Upcoming', 'Past Due', 'Submitted'. Show title, due date with relative time ('Due in 3 days'), points possible, and submission status badge (Not Submitted / Submitted / Graded). Use shadcn Tabs or segmented control for filtering.
- **Assignment Detail** (`/course/[id]/assignments/[id]`) — Show full assignment description (rendered rich text), rubric (if attached), due date, points, and submission type. Below the instructions, show the student's current submission (if any) with timestamp and grade.
- **Submit Assignment** (`/course/[id]/assignments/[id]/submit`) — Depending on submission type:
  - *Text entry:* TipTap rich text editor with a submit button.
  - *File upload:* Uppy file uploader with drag-and-drop, progress bar, and file type validation. Upload to S3 via presigned URL.
  - *URL:* Simple URL input field.
  - Show a confirmation dialog before final submission. Display a success toast after submitting.
  - If resubmission is allowed (before lock date), show the previous submission and a 'Resubmit' button.

**2. Assignment Workflow (Professor Side):**

- **Create Assignment** (`/course/[id]/assignments/new`) — Form with: title, TipTap description editor, points possible, due date/time picker (using date-fns for formatting), lock date, submission type selector (checkboxes), and publish toggle. Optionally attach an existing rubric or create a new one inline.
- **SpeedGrader** (`/course/[id]/assignments/[id]/grade`) — Two-panel layout:
  - *Left panel:* Student submission content (rendered text, file preview via PDF.js for PDFs, or download link for other file types).
  - *Right panel:* Grade entry (numeric input), rubric scoring (if rubric attached — clickable rating cells), and a feedback text area (TipTap).
  - *Navigation:* Prev/Next student buttons at the top. Student dropdown to jump to a specific student. Show submission timestamp and status.
  - *Publish:* 'Save Grade' button (saves without notifying student) and 'Save & Publish' button (saves and sends notification).

**3. Quiz System:**

- **Quiz List** (`/course/[id]/quizzes`) — Show quizzes with title, points, time limit, availability window, and status (Not Started / In Progress / Completed with score).
- **Take Quiz** (`/course/[id]/quizzes/[id]`) — Timed quiz interface:
  - Header with quiz title, timer countdown (auto-submit when timer hits zero), and question count.
  - Question navigation sidebar (numbered buttons, filled = answered, outline = unanswered).
  - One question per view with next/prev buttons, or scrollable single page (configurable).
  - Question types: multiple choice (radio), true/false (radio), short answer (text input), essay (TipTap), matching (drag-and-drop pairs).
  - Auto-save each answer to the backend on change.
  - Review screen before submission showing all answers.
  - Submit button with confirmation dialog.
- **Quiz Results** (`/course/[id]/quizzes/[id]/results`) — Show score, time taken, and per-question breakdown. For auto-graded types, show correct/incorrect with the right answer. For essay questions, show 'Pending review'.

**4. Gradebook & Grades:**

- **Student Grades View** (`/course/[id]/grades`) — Table showing all graded items (assignments + quizzes) with columns: name, due date, score, out of, percentage, and status. Show course total (weighted or points-based) at the top. Click a row to see the graded submission with feedback.
- **Professor Gradebook** (`/course/[id]/gradebook`) — Spreadsheet-style gradebook using TanStack Table:
  - Rows = students (sorted alphabetically), Columns = assignments/quizzes (sorted by due date).
  - Cells show score/max. Click a cell to inline-edit the grade.
  - Column headers show assignment name and average score.
  - Row footers show student's total grade.
  - Support sorting, filtering by student name, and CSV export.
  - Sticky first column (student name) and header row for scrollability.

**5. Global Calendar:**

Build the calendar page (`/calendar`) and per-course calendar:

- Use FullCalendar (or a custom grid with date-fns) to render month, week, and agenda views.
- Fetch all calendar events from `GET /api/v1/calendar?start=...&end=...`.
- Color-code events by course (consistent with course card colors on the dashboard).
- Click an event to navigate to the relevant assignment, quiz, or announcement page.
- Professors can create personal calendar events via a 'New Event' button and form.

**6. Inbox & Messaging:**

Build the messaging system:

- **Inbox** (`/inbox`) — Two-column layout:
  - *Left:* Conversation list with latest message preview, timestamp, and unread badge. Filter by course or 'All'. Compose button at the top.
  - *Right:* Selected conversation thread showing messages in chronological order. Each message shows sender avatar, name, timestamp, and body. Reply input at the bottom with TipTap and send button.
- **Compose** — Dialog/modal for new messages: recipient autocomplete (search by name across enrolled courses), optional course scope, subject line, body (TipTap), and attachment support.

**7. Notification Center:**

Build the notification system:

- **Notifications page** (`/notifications`) — Feed of all notifications grouped by date. Each notification shows: icon by type (bell for announcement, check for grade, mail for message, clock for deadline), title, preview text, timestamp, and read/unread styling.
- **Notification bell** in the top nav (TopNav.tsx) showing unread count badge. Click opens a dropdown with the 5 most recent notifications and a 'View All' link.
- Mark as read on click. 'Mark all as read' button.

**8. Profile Page:**

Build the profile page (`/profile`):

- Editable fields: display name, email (read-only), bio (textarea), avatar (upload), timezone (dropdown), language preference.
- 'Save' button calls PUT `/api/v1/users/profile`.
- Show account creation date and last login."

---

## Phase 3: The Intelligence Layer — RAG & Next-Gen Forum

**Goal:** Build the backend pipeline for semantic search and the "Bubble View" frontend UI.

### Prompt 3:

"Let's build the 'Next-Gen Forum' powered by Amazon Bedrock and OpenSearch.

**Backend:** Create a FastAPI router at `backend/app/routers/forum.py` with a `POST /api/forum/ask` endpoint. This endpoint should accept a student's question. First, write a mock OpenSearch k-NN semantic search function that groups mathematically or conceptually similar questions. Then, use Boto3 to call Amazon Bedrock using the Claude Haiku 4.5 model ID (anthropic.claude-haiku-4-5-20251001-v1:0) to generate a quick, low-latency synthesized answer based on previous mock forum data.

**Frontend:** Create the 'Bubble View' UI using Three.js and React Three Fiber. Render a 3D canvas where forum topics are represented as floating bubbles. The size of the bubble should represent the frequency of similar questions. When a bubble is clicked, open a shadcn slide-out panel showing the Claude Haiku 4.5 generated summary of that topic.

**Integration with Discussions:** Add a toggle in the course Discussions page that switches between 'Thread View' (traditional chronological list built in Phase 2) and 'Bubble View' (the AI-powered semantic visualization). The toggle should persist per-user via Zustand."

---

## Phase 4: AI-Assisted Grading Co-Pilot

**Goal:** Implement the complex, multi-step grading workflow using Opus 4.6.

### Prompt 4:

"Implement the 'Grading Co-Pilot' feature for the Professor dashboard.

Build a UI component integrated into the SpeedGrader (built in Phase 2.5) that adds an 'AI Assist' panel. When clicked, it triggers the AI grading workflow.

Create a multi-step grading workflow in `backend/app/services/grading.py`:

The workflow must call Amazon Bedrock via Boto3 using Claude Opus 4.6 (anthropic.claude-opus-4-6-v1). Pass it the assignment prompt, the grading rubric (from the Rubric model), and the student's submission text.

Instruct Opus 4.6 to act as a rigorous TA. It must return a strictly formatted JSON object containing: a suggested numerical score, a breakdown per rubric criterion, and a constructive feedback paragraph.

Expose this workflow via a FastAPI endpoint at `POST /api/grading/evaluate` in `backend/app/routers/grading.py`.

Render the JSON response in the SpeedGrader's right panel as an 'AI Suggestion' card. Show the suggested score, per-criterion breakdown with the AI's rating highlighted on the rubric, and the feedback text. The professor can:
- **Accept** — auto-fills the grade and feedback fields with the AI suggestion.
- **Edit** — copies the AI suggestion into editable fields for modification.
- **Reject** — dismisses the AI suggestion and grades manually.

Additionally, implement the 'Anomaly Flag' feature: when a grade is saved, compare the grader's score against the class average and the AI's suggestion. If the variance exceeds a configurable threshold, show a warning banner: 'This grade deviates significantly from the class average and AI suggestion. Are you sure?'"

---

## Phase 5: Event-Driven Material Synchronization

**Goal:** Simulate the "Domino Effect" using EventBridge-like patterns.

### Prompt 5:

"We need to build the 'Domino Effect' synchronization engine.

On the 'Create Announcement' page (built in Phase 2), add an AI-powered analysis step. When the professor writes an announcement and clicks 'Publish':

1. Before publishing, send the announcement text to a FastAPI endpoint at `POST /api/announcements/analyze` in `backend/app/routers/announcements.py`. This endpoint passes the text to Claude Haiku 4.5 via Boto3 to extract structured data: `{ entity_to_update: "Assignment 3", new_date: "YYYY-MM-DD", action: "UPDATE_DUE_DATE" }`.

2. If a schedule change is detected, show an 'AI Detected Changes' modal to the professor before publishing. The modal lists the detected changes and asks: 'Would you like to automatically update the following? (checkboxes):
   - Update assignment due date in the database
   - Update the course calendar event
   - Update the syllabus schedule table
   - Notify enrolled students'

3. When the professor confirms, simulate an Amazon EventBridge fan-out by updating the PostgreSQL database via SQLAlchemy for each checked item. Publish the announcement and return the result to the frontend.

4. Trigger a React Toast notification: 'AI detected a schedule change. Assignment 3 due date successfully synchronized across syllabus and calendar.'"

---

## Phase 6: Agentic Context-Aware Chatbot

**Goal:** Create the floating, viewport-aware student assistant.

### Prompt 6:

"Implement the 'Context-Aware Course Chatbot' for the Student view.

Build a persistent, floating chat window using Tailwind and shadcn. Position it in the bottom-right corner with a collapse/expand toggle. The chatbot must be 'Viewport Aware'. Use a React hook (usePathname) to detect exactly what page the student is on (e.g., `/course/5/assignments/3` or `/course/5/syllabus`).

When the student sends a message, the frontend should send the message along with the current viewport context (course ID, page type, and specific resource ID) to `POST /api/chatbot/message` in `backend/app/routers/chatbot.py`. This endpoint calls Bedrock via Boto3 using Claude Opus 4.6 for deep reasoning.

Context-aware behaviors:
- **On an assignment page:** If the student says 'I'm stuck', trigger 'Socratic Mode' — instruct Opus to respond with a guiding question rather than the direct answer.
- **On the syllabus page:** If the student asks about due dates, the bot cross-references actual assignment due dates from the database.
- **On the grades page:** If the student asks 'why did I get this score', the bot retrieves the grading feedback and rubric breakdown.
- **On any page:** The student can ask 'what's due this week?' and the bot queries the calendar API.

Stream the response back to the frontend chat UI using FastAPI's StreamingResponse. Display a typing indicator while streaming, and render the response incrementally in the chat bubble.

The chat window should persist its message history across page navigations within the same course using Zustand. Include a 'New Chat' button to reset the conversation."
