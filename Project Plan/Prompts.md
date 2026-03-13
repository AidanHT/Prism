Phase 1: Foundation & Scaffolding
Goal: Initialize the Next.js 15 frontend, set up the FastAPI backend, and establish the project structure with mock AWS connections.

Prompt 1:

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

Phase 2: Core Data Models & State
Goal: Define the relational data (Users, Courses, Grades) and the unstructured data schemas (Forum, Chat).

Prompt 2:

"We need to establish our data layer using SQLAlchemy 2.x (async) for PostgreSQL (simulating our Aurora instance) and Pydantic models for DynamoDB data.

In `backend/app/models/`, define the SQLAlchemy ORM models for: users, courses, enrollments, assignments, and submissions. Ensure relationships are properly linked (e.g., submissions tie to both a user and an assignment). Set up Alembic for database migrations in `backend/alembic/`.

Create Pydantic v2 schemas in `backend/app/schemas/dynamo.py` for our unstructured data: ForumThread, ForumPost, and ChatSession.

Write a seed script (`backend/app/db/seed.py`) containing one course, one professor, three students, and two assignments to populate our MVP database.

Create a FastAPI router at `backend/app/routers/courses.py` with a `GET /api/courses` endpoint to fetch course data. On the frontend, create a React Server Component that calls this endpoint and displays the courses in a clean, responsive grid on the Professor dashboard."

Phase 3: The Intelligence Layer - RAG & Next-Gen Forum
Goal: Build the backend pipeline for semantic search and the "Bubble View" frontend UI.

Prompt 3:

"Let's build the 'Next-Gen Forum' powered by Amazon Bedrock and OpenSearch.

Backend: Create a FastAPI router at `backend/app/routers/forum.py` with a `POST /api/forum/ask` endpoint. This endpoint should accept a student's question. First, write a mock OpenSearch k-NN semantic search function that groups mathematically or conceptually similar questions. Then, use Boto3 to call Amazon Bedrock using the Claude Haiku 4.5 model ID (anthropic.claude-haiku-4-5-20251001-v1:0) to generate a quick, low-latency synthesized answer based on previous mock forum data.

Frontend: Create the 'Bubble View' UI using Three.js and React Three Fiber. Render a 3D canvas where forum topics are represented as floating bubbles. The size of the bubble should represent the frequency of similar questions. When a bubble is clicked, open a shadcn slide-out panel showing the Claude Haiku 4.5 generated summary of that topic."

Phase 4: AI-Assisted Grading Co-Pilot
Goal: Implement the complex, multi-step grading workflow using Opus 4.6.

Prompt 4:

"Implement the 'Grading Co-Pilot' feature for the Professor dashboard.

Build a UI component that allows a professor to select a student's submission (simulate a parsed text file, skipping Textract for this MVP step).

Create a multi-step grading workflow in `backend/app/services/grading.py`:

The workflow must call Amazon Bedrock via Boto3 using Claude Opus 4.6 (anthropic.claude-opus-4-6-v1). Pass it a mock assignment prompt, a mock grading rubric, and the student's text.

Instruct Opus 4.6 to act as a rigorous TA. It must return a strictly formatted JSON object containing: a suggested numerical score, a breakdown per rubric criterion, and a constructive feedback paragraph.

Expose this workflow via a FastAPI endpoint at `POST /api/grading/evaluate` in `backend/app/routers/grading.py`.

Render the JSON response in a side-by-side 'Grading Review' layout on the frontend, allowing the professor to accept, edit, or reject the AI's suggested grade."

Phase 5: Event-Driven Material Synchronization
Goal: Simulate the "Domino Effect" using EventBridge-like patterns.

Prompt 5:

"We need to build the 'Domino Effect' synchronization engine.

Create a 'Course Announcements' form on the frontend where a professor can publish an update (e.g., 'Assignment 3 is pushed back to Friday').

When this form is submitted, send the payload to a FastAPI endpoint at `POST /api/announcements/publish` in `backend/app/routers/announcements.py`. This endpoint should pass the text to Claude Haiku 4.5 via Boto3 to extract structured data: { entity_to_update: "Assignment 3", new_date: "YYYY-MM-DD", action: "UPDATE_DUE_DATE" }.

Simulate an Amazon EventBridge fan-out by taking this structured data and updating the PostgreSQL database via SQLAlchemy. Return the result to the frontend and trigger a React Toast notification that says: 'AI detected a schedule change. Assignment 3 due date successfully synchronized across syllabus and calendar.'"

Phase 6: Agentic Context-Aware Chatbot
Goal: Create the floating, viewport-aware student assistant.

Prompt 6:

"Implement the 'Context-Aware Course Chatbot' for the Student view.

Build a persistent, floating chat window using Tailwind and shadcn. The chatbot must be 'Viewport Aware'. Use a React hook (usePathname or standard state) to detect exactly what page the student is on (e.g., /assignments/3 or /syllabus).

When the student sends a message, the frontend should send the message along with the current viewport context to `POST /api/chatbot/message` in `backend/app/routers/chatbot.py`. This endpoint calls Bedrock via Boto3 using Claude Opus 4.6 for deep reasoning. If the student is on an assignment page and says 'I'm stuck', prompt Opus to trigger its 'Socratic Mode' — instructing it to respond with a guiding question rather than the direct answer. Stream the response back to the frontend chat UI using FastAPI's StreamingResponse."
