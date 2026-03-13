# Project Prism – Feature Overview

This document describes **all** features of the Prism LMS, organized into two tiers:

1. **Core LMS Features** – the Canvas-equivalent baseline that every student and professor interacts with daily.
2. **AI-Enhanced "Key" Features** – the intelligence layer that differentiates Prism from traditional platforms.

---

## Core LMS Features (Canvas-Equivalent Baseline)

These features replicate the essential workflows found in Canvas and similar LMS platforms. Every item below maps to a dedicated page or set of pages in the frontend.

### Global Navigation & Dashboard

| Feature | Description | Who |
|---|---|---|
| **Dashboard** | Personalized landing page showing enrolled course cards, upcoming assignment deadlines, recent announcements feed, and a to-do list aggregated across all courses. | All |
| **Global Calendar** | Unified calendar view (month/week/day) displaying assignment due dates, quiz dates, and course events across all enrolled courses. Supports filtering by course. | All |
| **Inbox / Messaging** | Threaded conversations between students, TAs, and professors. Supports individual and group messages, attachments, and course-scoped filtering. | All |
| **Notification Center** | Centralized feed of all notifications (grade published, announcement posted, message received, due date approaching). Configurable notification preferences. | All |
| **Profile & Account Settings** | User profile page with avatar, bio, contact info, and account preferences (timezone, notification channels, display settings). | All |

### Course-Level Features (Within a Course)

Each course has its own sub-navigation sidebar, identical to how Canvas scopes navigation within a course context.

| Feature | Page Route | Description | Who |
|---|---|---|---|
| **Course Home** | `/course/[id]` | Landing page for a course showing recent announcements, upcoming assignments, and quick-access links to modules. | All |
| **Announcements** | `/course/[id]/announcements` | Chronological list of course announcements. Professors create/edit; students read. Individual announcement detail pages. | All |
| **Syllabus** | `/course/[id]/syllabus` | Rendered syllabus document with an auto-generated assignment schedule table pulled from actual assignment due dates. | All |
| **Modules** | `/course/[id]/modules` | Sequential, collapsible content modules (like Canvas Modules). Each module contains ordered items: pages, assignments, quizzes, files, and external links. Professors can reorder and publish/unpublish. | All |
| **Assignments** | `/course/[id]/assignments` | List of all assignments grouped by status (upcoming, past due, submitted). Detail page shows instructions, rubric, and due date. Students submit via text entry or file upload. Professors create/edit with rich text editor and rubric builder. | All |
| **Quizzes** | `/course/[id]/quizzes` | List of quizzes. Professors build quizzes with multiple question types (multiple choice, true/false, short answer, essay). Students take quizzes with a timer and auto-submit. Results and correct answers shown after grading. | All |
| **Discussions** | `/course/[id]/discussions` | Threaded discussion boards. Professors create discussion prompts; students reply with rich text. Supports pinning, liking, and marking as resolved. | All |
| **Grades (Student)** | `/course/[id]/grades` | Student view of their own grades across all assignments, quizzes, and discussions. Shows individual scores, weighted totals, and overall course grade. | Student |
| **Gradebook (Professor)** | `/course/[id]/gradebook` | Spreadsheet-style gradebook showing all students and all assignments. Supports inline grade entry, sorting, filtering, and CSV export. | Professor/TA |
| **SpeedGrader** | `/course/[id]/assignments/[id]/grade` | Focused grading interface for a single assignment. Shows student submission on the left, rubric and grade entry on the right. Navigate between students with prev/next. Supports inline annotations. | Professor/TA |
| **People / Roster** | `/course/[id]/people` | Class roster showing all enrolled students, TAs, and professors. Includes role badges, last activity timestamps, and email links. | All |
| **Pages / Content** | `/course/[id]/pages` | Wiki-style content pages authored by professors. Used for supplementary material, study guides, and reference content. Rich text editing with embedded media. | All |
| **Files** | `/course/[id]/files` | File browser for course materials (PDFs, slides, datasets). Folder-based organization. Students can download; professors can upload and organize. | All |
| **Rubrics** | `/course/[id]/rubrics` | Create and manage reusable grading rubrics. Rubrics can be attached to any assignment or quiz. Criteria with point values and descriptive levels. | Professor/TA |
| **Course Analytics** | `/course/[id]/analytics` | Engagement analytics: page views, assignment submission rates, grade distributions, student activity over time. | Professor/TA |
| **Course Settings** | `/course/[id]/settings` | Course configuration: name, description, enrollment options, navigation visibility, grading scheme, late policy. | Professor |

### Student-Specific Workflows

| Workflow | Description |
|---|---|
| **Assignment Submission** | Text entry via rich text editor, file upload (PDF, DOCX, code files) via chunked upload, or URL submission. Confirmation toast upon submit. Re-submission allowed until due date unless locked. |
| **Quiz Taking** | Timed quiz interface with question navigation sidebar, auto-save on each answer, and auto-submit when time expires. Review screen before final submission. |
| **Grade Review** | View graded submission with inline feedback, rubric breakdown, and professor/TA comments. |

### Professor-Specific Workflows

| Workflow | Description |
|---|---|
| **Course Creation** | Create a new course with title, code, term, description, and section. Configure grading scheme and late policy. |
| **Assignment Creation** | Rich text editor for instructions, rubric builder, point value, due date/time, submission type selection, and publish toggle. |
| **Quiz Builder** | Add questions (MC, T/F, short answer, essay, matching), set point values per question, configure time limit, attempt limits, and availability window. |
| **Module Builder** | Create modules, add items (assignments, quizzes, pages, files, external URLs), set prerequisites and completion requirements, drag-and-drop reorder. |
| **Bulk Grade Upload** | Upload grades via CSV to populate the gradebook for an assignment. |

---

## AI-Enhanced "Key" Features (Intelligence Layer)

These features sit on top of the core LMS and are powered by Amazon Bedrock (Claude Opus 4.6 / Haiku 4.5). They are what differentiate Prism from Canvas and other traditional platforms.

### 1. The "Smart Canvas" Analytics Engine: Predictive & Actionable

**The Shift:** Move from passive dashboards (just showing what happened) to active, predictive insights (telling the professor what to do about it).

**Precision Upgrade:** Instead of just tracking "time on tool," implement Resource ROI (Return on Investment) Tracking. The system calculates the correlation between time spent on a specific PDF/video and the average score on the corresponding quiz.

**Creative Features:**

- **Content Heatmapping:** For video lectures or long text, track exactly where students pause, rewind, or highlight. If 60% of the class rewinds a specific 2-minute segment of a video, the AI alerts the professor: "High confusion detected on Concept X. Consider reviewing in the next lecture."
- **Early Intervention Nudges (Predictive Risk):** The AI identifies patterns of disengagement (e.g., logging in but not opening assignments, sudden drop in forum reading) and drafts a personalized, empathetic check-in email for the professor to approve and send to the at-risk student.

### 2. The Next-Gen Forum (Better Piazza)

**The Shift:** Transform the forum from a chronological list of complaints into a self-healing knowledge base.

**Precision Upgrade:** Use Semantic Clustering. Instead of just saying "students are confused about 4a," the AI groups mathematically or conceptually similar questions into a single "Megathread" automatically.

**Creative Features:**

- **The "Knowledge Base Auto-Update":** When a Professor or TA provides a stellar, definitive answer to a complex question, they can click a button that says "Add to Brain." This instantly updates the Course Chatbot's RAG vector database, ensuring the bot can answer it next time without human intervention.
- **TA Tone & Consistency Checker:** TAs can be notoriously inconsistent or overly blunt. When a TA drafts a response, the AI briefly scans it for tone (making sure it's encouraging) and accuracy (cross-referencing against the professor's previous answers).
- **Visual Concept Map UI ("Bubble View"):** Replace the standard list of posts with a dynamic visual map of the syllabus. Topics that have the most questions glow "hot," giving the teaching team a literal map of where the class is struggling.

### 3. AI-Assisted Grading & Calibration (Grading Co-Pilot)

**The Shift:** Position the AI not as a grader, but as a "Grading Co-Pilot" that acts as an equity and consistency check.

**Precision Upgrade:** Implement Calibrated Peer/TA Grading. The biggest issue in large courses isn't just the rubric; it's variance between human graders.

**Creative Features:**

- **Frictionless Rubric Generation & Testing:** The professor uploads an assignment prompt. The AI drafts a multi-point rubric. Crucially, before the grading starts, the professor feeds 3 sample student papers to the AI. The AI grades them based on the new rubric and points out: "Criterion B is too vague, leading to a 20% variance in application."
- **The "Anomaly Flag":** As TAs input grades, the AI works in the background. If TA #1 is grading 15% harsher than TA #2 on a specific question, the AI flags this to the Lead TA or Professor for review before grades are published.

### 4. Context-Aware Course Chatbot (Agentic AI)

**The Shift:** A chatbot that just answers questions is standard. An agentic chatbot takes actions on behalf of the user based on where they are in the platform.

**Precision Upgrade:** Since you are using AWS Bedrock for vector embeddings, ensure the bot has Viewport Context. It shouldn't just be a side tab; it should know exactly what page, assignment, or video the student is currently looking at.

**Creative Features:**

- **Action-Oriented Prompts:** If a student asks, "I'm sick and can't submit this," the bot doesn't just quote the syllabus policy. It says: "According to the syllabus, you need a doctor's note for a 48-hour extension. Would you like me to open the extension request form for you and draft a message to your TA?"
- **Socratic Mode:** For coding or math courses, professors can toggle a "Don't give the answer" mode. The RAG will analyze the student's code/work, identify the logical flaw, and ask a guiding question rather than just spitting out the solution.

### 5. Seamless Course Management & Material Synchronization

**The Shift:** Turn the creation process into an interconnected web where changing one thing dynamically updates everything else.

**Precision Upgrade:** Implement a Syllabus & Material Synchronization Engine.

**Creative Features:**

- **The "Domino Effect" Updater:** If a professor creates an announcement saying, "Assignment 3 is pushed back by two days," the AI automatically detects the date change and offers a one-click prompt: "Would you like to update the calendar, the syllabus document, and adjust the due date for the peer-review module accordingly?"
- **Accessibility & Clarity Pre-Flight:** Before an assignment or announcement goes live, the AI does a 3-second scan. It checks reading level, flags missing alt-text on images, and ensures all hyperlinks are active.
