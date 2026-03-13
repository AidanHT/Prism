# Project Description: Project Prism – Cloud-Native Intelligent LMS Architecture

## Executive Summary

Project Prism outlines the engineering architecture for a next-generation Learning Management System (LMS) enhanced by an event-driven AI intelligence layer. Built entirely on an AWS microservices architecture, Prism aims to solve the administrative bottleneck in higher education. It separates the static core infrastructure (data storage, access control, routing) from the dynamic AI workflows (predictive analytics, RAG-based semantic search, autonomous agentic routing), providing a highly performant, scalable solution for enterprise-level university deployments.

Prism's baseline experience is designed to be functionally equivalent to Canvas LMS — every core workflow that students and professors rely on daily (assignments, gradebook, modules, calendar, messaging, quizzes) is present before any AI features are layered on top.

## Part 1: Core Infrastructure (The Baseline LMS)

Prism's foundational application is designed as a decoupled, serverless web application to handle highly variable traffic loads (e.g., assignment submission deadlines, exam periods) without provisioning idle compute.

### 1. Frontend & Edge Delivery

- **Framework:** Next.js 15 (App Router) with React 19 for a highly responsive application using React Server Components for data fetching and Client Components only where interactivity is required.
- **Styling & Components:** Tailwind CSS v4 with shadcn/ui (Radix primitives). Framer Motion for page transitions and layout animations.
- **Hosting & Delivery:** Deployed via AWS Amplify, with static assets cached globally using Amazon CloudFront to ensure sub-100ms load times for the UI.
- **Authentication:** Managed by Amazon Cognito, handling secure JWT-based role-based access control (RBAC) for Students, TAs, Instructors, and Admins. Simulated locally via a mock AuthContext with role switching during MVP development.

### 2. Frontend Page Architecture

The frontend is a multi-page application with dedicated routes for each major LMS function, mirroring the navigational structure of Canvas LMS.

#### Global Pages (accessible from the top-level sidebar)

| Page | Route | Description |
|---|---|---|
| Dashboard | `/dashboard` | Personalized home: enrolled course cards, upcoming deadlines, recent announcements, to-do list |
| All Courses | `/courses` | Browse and search enrolled courses; professors can also create new courses |
| Global Calendar | `/calendar` | Month/week/day calendar with due dates and events aggregated across all courses |
| Inbox | `/inbox` | Threaded messaging between students, TAs, and professors |
| Notifications | `/notifications` | Centralized notification feed with preference management |
| Profile | `/profile` | User profile, account settings, timezone, notification preferences |

#### Course-Level Pages (scoped within `/course/[courseId]/`)

Each course has its own layout with a course-specific sidebar listing the following sub-pages:

| Page | Route Suffix | Student | Professor/TA |
|---|---|---|---|
| Course Home | `/` | View | Edit |
| Announcements | `/announcements` | View | Create/Edit |
| Syllabus | `/syllabus` | View | Edit |
| Modules | `/modules` | View | Create/Edit/Reorder |
| Assignments | `/assignments` | View/Submit | Create/Edit/Grade |
| Quizzes | `/quizzes` | Take | Create/Edit/Grade |
| Discussions | `/discussions` | View/Reply | Create/Moderate |
| Grades | `/grades` | View own | — |
| Gradebook | `/gradebook` | — | View/Edit all |
| People | `/people` | View roster | Manage enrollment |
| Pages | `/pages` | View | Create/Edit |
| Files | `/files` | Download | Upload/Organize |
| Rubrics | `/rubrics` | — | Create/Manage |
| Analytics | `/analytics` | — | View engagement |
| Settings | `/settings` | — | Configure course |

### 3. Backend API & Microservices

- **API Framework (MVP):** FastAPI (Python 3.12) running locally to simulate the Lambda microservices, with the Next.js frontend calling FastAPI via HTTP. Each FastAPI router module represents a distinct microservice boundary.
- **API Gateway (Production):** Amazon API Gateway acts as the primary entry point, routing REST and WebSocket (for real-time chat/forum updates) requests.
- **Compute Layer (Production):** Core CRUD operations are handled by decoupled AWS Lambda functions (Python 3.12, deployed via Mangum adapter). Heavier asynchronous tasks (video transcoding) are offloaded to Amazon ECS (Fargate) containers.

#### Backend Router Modules

| Router | Path Prefix | Responsibility |
|---|---|---|
| `courses.py` | `/api/v1/courses` | Course CRUD, enrollment, course settings, syllabus |
| `assignments.py` | `/api/v1/assignments` | Assignment CRUD, submission handling, due dates |
| `quizzes.py` | `/api/v1/quizzes` | Quiz CRUD, question management, quiz attempts, auto-grading |
| `modules.py` | `/api/v1/modules` | Module CRUD, item ordering, prerequisites |
| `grades.py` | `/api/v1/grades` | Gradebook CRUD, grade calculations, CSV export/import |
| `discussions.py` | `/api/v1/discussions` | Discussion threads, replies, moderation |
| `announcements.py` | `/api/v1/announcements` | Announcement CRUD, event-driven side effects |
| `pages.py` | `/api/v1/pages` | Wiki-style content page CRUD |
| `files.py` | `/api/v1/files` | File upload/download, folder management, S3 presigned URLs |
| `users.py` | `/api/v1/users` | User profiles, account settings, roster |
| `messages.py` | `/api/v1/messages` | Inbox conversations, threaded messages |
| `calendar.py` | `/api/v1/calendar` | Aggregated calendar events across courses |
| `notifications.py` | `/api/v1/notifications` | Notification delivery and preference management |
| `forum.py` | `/api/v1/forum` | AI-enhanced forum (Bubble View, semantic clustering) |
| `grading.py` | `/api/v1/grading` | AI grading co-pilot workflows |
| `chatbot.py` | `/api/v1/chatbot` | Agentic course chatbot sessions |

### 4. Database & Storage Tier

- **Relational Database:** Amazon Aurora PostgreSQL (Serverless v2) handles the highly structured, transactional data requiring ACID compliance (user profiles, gradebook ledgers, course relationships, assignments, quizzes, modules, pages, announcements, discussion threads, messages, calendar events, rubrics, notification preferences).
- **NoSQL / Fast-Access Data:** Amazon DynamoDB is utilized for high-throughput, unstructured or semi-structured data like Prism's real-time forum threads, session states, chat logs, and clickstream events.
- **Object Storage:** Amazon S3 stores all course materials, lecture videos, student file submissions, and exported grade CSVs.

## Part 2: The Intelligence Layer (AWS ML & Data Analytics)

This layer sits on top of Prism's core infrastructure, utilizing AWS Bedrock and streaming analytics to power the platform's autonomous features.

### 1. Agentic Course Chatbot & Next-Gen Forum (RAG Pipeline)

- **LLM Orchestration:** Amazon Bedrock serves as the central API for foundation models. For the high-speed, agentic chat and dynamic forum auto-suggestions, the pipeline utilizes Claude Opus 4.6 (via Bedrock) to provide highly capable reasoning, deep context windows, and low-latency inference.
- **Vector Embeddings:** Course materials (syllabi, transcripts, previous forum posts) are processed using Amazon Titan Embeddings and stored in Amazon OpenSearch Serverless (Vector Engine).
- **Semantic Clustering (Bubble View):** OpenSearch performs K-Nearest Neighbor (k-NN) searches to instantly group mathematically or conceptually similar student questions, passing the clusters to the frontend to render Prism's visual "Bubble View."

### 2. Smart Analytics & Predictive Interventions (Data Pipeline)

- **Clickstream Ingestion:** Granular user interactions (video pauses, PDF scroll depth, time-on-page) are streamed in real-time using Amazon Kinesis Data Streams.
- **Data Lake & ETL:** Kinesis buffers the data into an S3 Data Lake. AWS Glue performs serverless ETL (Extract, Transform, Load) operations to clean and structure the behavioral data.
- **Predictive Analytics:** Amazon SageMaker runs lightweight predictive models against this historical data to calculate "Resource ROI" and flag at-risk students based on engagement drop-offs, surfacing these insights to the professor's dashboard via Amazon Athena.

### 3. Grading Co-Pilot & Anomaly Detection

- **Document Parsing:** Student submissions in PDF/Word format are parsed using Amazon Textract to extract text and handwriting.
- **Evaluation Engine:** The extracted text is sent to Bedrock. The LLM compares the submission against the dynamically generated rubric, returning baseline grading recommendations and feedback.
- **Variance Tracking:** As TAs submit grades, an AWS Lambda trigger runs a statistical variance check against historical TA grading patterns stored in Aurora, flagging anomalies before grades are published.

### 4. Dynamic Material Synchronization (Event-Driven Updates)

- **Event Choreography:** Amazon EventBridge acts as the central event bus for Prism.
- **The "Domino Effect":** If a professor publishes an announcement changing a due date, the Lambda function processing that announcement emits a DueDateChanged event to EventBridge. This triggers a fan-out to other microservices to automatically update the Aurora database (calendar view), notify the Bedrock RAG pipeline to update its vector index, and send a push notification to students via Amazon SNS.

## Part 3: Development Phases

| Phase | Name | Focus |
|---|---|---|
| 1 | Foundation & Scaffolding | Project structure, auth mock, global sidebar, basic page stubs |
| 1.1 | Core LMS Pages & Course Navigation | Complete frontend routing, course-level layout & sub-nav, all page shells, enhanced dashboard |
| 2 | Core Data Models & CRUD | Database models, Alembic migrations, CRUD routers, seed data, functional course pages |
| 2.5 | Student & Professor Workflows | Assignment submission, quiz system, gradebook, SpeedGrader, calendar, inbox, notifications |
| 3 | Intelligence Layer – RAG & Forum | Semantic search, Bubble View, AI forum features |
| 4 | AI-Assisted Grading Co-Pilot | Bedrock grading workflow, rubric generation, anomaly detection |
| 5 | Event-Driven Material Sync | Domino Effect, announcement parsing, EventBridge simulation |
| 6 | Agentic Context-Aware Chatbot | Viewport-aware chatbot, Socratic Mode, streaming responses |
