/**
 * Shared mock data for LMS pages.
 * All dates are relative to the current dev date: 2026-03-13.
 */

export interface MockAssignment {
  id: string;
  courseId: string;
  courseCode: string;
  courseColor: string;
  title: string;
  dueDate: Date;
  submitted: boolean;
  type: "assignment" | "quiz" | "discussion";
}

export interface MockAnnouncement {
  id: string;
  courseId: string;
  courseCode: string;
  courseColor: string;
  title: string;
  body: string;
  author: string;
  postedAt: Date;
  read: boolean;
}

export interface MockMessage {
  id: string;
  sender: string;
  senderInitials: string;
  body: string;
  sentAt: Date;
}

export interface MockConversation {
  id: string;
  subject: string;
  courseId: string | null;
  courseCode: string | null;
  participants: string[];
  lastMessage: string;
  lastAt: Date;
  unread: boolean;
  messages: MockMessage[];
}

export interface MockNotification {
  id: string;
  type: "grade" | "announcement" | "message" | "deadline";
  title: string;
  body: string;
  courseCode: string | null;
  createdAt: Date;
  read: boolean;
}

// ── Assignments ────────────────────────────────────────────────────────────────

export const MOCK_ASSIGNMENTS: MockAssignment[] = [
  {
    id: "asgn-001",
    courseId: "course-001",
    courseCode: "CS 101",
    courseColor: "#6366f1",
    title: "Lab 3: Recursion",
    dueDate: new Date("2026-03-15T23:59:00"),
    submitted: false,
    type: "assignment",
  },
  {
    id: "asgn-002",
    courseId: "course-002",
    courseCode: "CS 201",
    courseColor: "#0ea5e9",
    title: "Problem Set 5: Graph Traversals",
    dueDate: new Date("2026-03-17T23:59:00"),
    submitted: false,
    type: "assignment",
  },
  {
    id: "asgn-003",
    courseId: "course-003",
    courseCode: "CS 445",
    courseColor: "#10b981",
    title: "Midterm Exam",
    dueDate: new Date("2026-03-18T10:00:00"),
    submitted: false,
    type: "quiz",
  },
  {
    id: "asgn-004",
    courseId: "course-004",
    courseCode: "CS 350",
    courseColor: "#f59e0b",
    title: "ER Diagram Assignment",
    dueDate: new Date("2026-03-20T23:59:00"),
    submitted: false,
    type: "assignment",
  },
  {
    id: "asgn-005",
    courseId: "course-005",
    courseCode: "CS 410",
    courseColor: "#ef4444",
    title: "Sprint Review Discussion",
    dueDate: new Date("2026-03-22T23:59:00"),
    submitted: true,
    type: "discussion",
  },
  {
    id: "asgn-006",
    courseId: "course-001",
    courseCode: "CS 101",
    courseColor: "#6366f1",
    title: "Quiz 2: Sorting Algorithms",
    dueDate: new Date("2026-03-25T09:00:00"),
    submitted: false,
    type: "quiz",
  },
  {
    id: "asgn-007",
    courseId: "course-002",
    courseCode: "CS 201",
    courseColor: "#0ea5e9",
    title: "Final Project Proposal",
    dueDate: new Date("2026-03-28T23:59:00"),
    submitted: false,
    type: "assignment",
  },
];

// ── Announcements ──────────────────────────────────────────────────────────────

export const MOCK_ANNOUNCEMENTS: MockAnnouncement[] = [
  {
    id: "ann-001",
    courseId: "course-003",
    courseCode: "CS 445",
    courseColor: "#10b981",
    title: "Midterm logistics & study guide posted",
    body: "The study guide for next week's midterm is now available on the course page. Office hours will be extended Tues & Weds.",
    author: "Prof. Martinez",
    postedAt: new Date("2026-03-13T08:30:00"),
    read: false,
  },
  {
    id: "ann-002",
    courseId: "course-001",
    courseCode: "CS 101",
    courseColor: "#6366f1",
    title: "Lab section this Friday is cancelled",
    body: "Due to a scheduling conflict the Friday lab section (2–4 PM) is cancelled. Attend any other section or use open lab hours.",
    author: "Prof. Johnson",
    postedAt: new Date("2026-03-12T14:10:00"),
    read: false,
  },
  {
    id: "ann-003",
    courseId: "course-005",
    courseCode: "CS 410",
    courseColor: "#ef4444",
    title: "Guest lecture: Agile at Scale — Monday 3 PM",
    body: "We have a guest lecturer from a local tech company joining us Monday to discuss Agile practices at scale. Attendance is mandatory.",
    author: "Prof. Chen",
    postedAt: new Date("2026-03-11T09:00:00"),
    read: true,
  },
  {
    id: "ann-004",
    courseId: "course-004",
    courseCode: "CS 350",
    courseColor: "#f59e0b",
    title: "Updated grading rubric for ER assignment",
    body: "The rubric has been updated to include partial credit for normalisation. Please re-read it before submitting.",
    author: "Prof. Williams",
    postedAt: new Date("2026-03-10T16:45:00"),
    read: true,
  },
  {
    id: "ann-005",
    courseId: "course-002",
    courseCode: "CS 201",
    courseColor: "#0ea5e9",
    title: "Office hours moved to Friday this week",
    body: "My Tuesday office hours are moved to Friday 1–3 PM this week only due to a faculty meeting.",
    author: "Prof. Kumar",
    postedAt: new Date("2026-03-09T11:20:00"),
    read: true,
  },
];

// ── Conversations ──────────────────────────────────────────────────────────────

export const MOCK_CONVERSATIONS: MockConversation[] = [
  {
    id: "conv-001",
    subject: "Question about Lab 3",
    courseId: "course-001",
    courseCode: "CS 101",
    participants: ["Dev User", "Prof. Johnson"],
    lastMessage: "Sure, base case should return 0 when n <= 1.",
    lastAt: new Date("2026-03-13T10:45:00"),
    unread: true,
    messages: [
      {
        id: "msg-001a",
        sender: "Dev User",
        senderInitials: "DU",
        body: "Hi Professor, I'm confused about the base case for the recursive function in Lab 3.",
        sentAt: new Date("2026-03-13T10:20:00"),
      },
      {
        id: "msg-001b",
        sender: "Prof. Johnson",
        senderInitials: "PJ",
        body: "Sure, base case should return 0 when n <= 1.",
        sentAt: new Date("2026-03-13T10:45:00"),
      },
    ],
  },
  {
    id: "conv-002",
    subject: "Project team check-in",
    courseId: "course-005",
    courseCode: "CS 410",
    participants: ["Dev User", "Alice Kim", "Bob Tran"],
    lastMessage: "I'll push the updated diagrams tonight.",
    lastAt: new Date("2026-03-12T18:30:00"),
    unread: true,
    messages: [
      {
        id: "msg-002a",
        sender: "Alice Kim",
        senderInitials: "AK",
        body: "Hey team, sprint review is this Sunday. Can everyone confirm availability?",
        sentAt: new Date("2026-03-12T15:00:00"),
      },
      {
        id: "msg-002b",
        sender: "Dev User",
        senderInitials: "DU",
        body: "I'm available Sunday afternoon.",
        sentAt: new Date("2026-03-12T16:10:00"),
      },
      {
        id: "msg-002c",
        sender: "Bob Tran",
        senderInitials: "BT",
        body: "I'll push the updated diagrams tonight.",
        sentAt: new Date("2026-03-12T18:30:00"),
      },
    ],
  },
  {
    id: "conv-003",
    subject: "Graph algorithm clarification",
    courseId: "course-002",
    courseCode: "CS 201",
    participants: ["Dev User", "Prof. Kumar"],
    lastMessage: "Yes, Dijkstra is applicable here since all edge weights are non-negative.",
    lastAt: new Date("2026-03-11T09:00:00"),
    unread: false,
    messages: [
      {
        id: "msg-003a",
        sender: "Dev User",
        senderInitials: "DU",
        body: "Can I use Dijkstra's algorithm for problem 4b, or must I use BFS?",
        sentAt: new Date("2026-03-10T22:15:00"),
      },
      {
        id: "msg-003b",
        sender: "Prof. Kumar",
        senderInitials: "PK",
        body: "Yes, Dijkstra is applicable here since all edge weights are non-negative.",
        sentAt: new Date("2026-03-11T09:00:00"),
      },
    ],
  },
  {
    id: "conv-004",
    subject: "Grading question on PS4",
    courseId: "course-002",
    courseCode: "CS 201",
    participants: ["Dev User", "TA Sarah"],
    lastMessage: "I'll re-check and update your grade by end of day.",
    lastAt: new Date("2026-03-10T14:20:00"),
    unread: false,
    messages: [
      {
        id: "msg-004a",
        sender: "Dev User",
        senderInitials: "DU",
        body: "Hi Sarah, I think there might be a grading error on problem 2 of PS4.",
        sentAt: new Date("2026-03-10T13:00:00"),
      },
      {
        id: "msg-004b",
        sender: "TA Sarah",
        senderInitials: "TS",
        body: "I'll re-check and update your grade by end of day.",
        sentAt: new Date("2026-03-10T14:20:00"),
      },
    ],
  },
  {
    id: "conv-005",
    subject: "Welcome to CS 445!",
    courseId: "course-003",
    courseCode: "CS 445",
    participants: ["Prof. Martinez", "Dev User"],
    lastMessage: "Looking forward to a great semester. Feel free to reach out with any questions.",
    lastAt: new Date("2026-01-20T08:00:00"),
    unread: false,
    messages: [
      {
        id: "msg-005a",
        sender: "Prof. Martinez",
        senderInitials: "PM",
        body: "Looking forward to a great semester. Feel free to reach out with any questions.",
        sentAt: new Date("2026-01-20T08:00:00"),
      },
    ],
  },
];

// ── Notifications ──────────────────────────────────────────────────────────────

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "notif-001",
    type: "announcement",
    title: "New announcement in CS 445",
    body: "Midterm logistics & study guide posted",
    courseCode: "CS 445",
    createdAt: new Date("2026-03-13T08:30:00"),
    read: false,
  },
  {
    id: "notif-002",
    type: "grade",
    title: "Grade posted for CS 201",
    body: "Problem Set 4 has been graded. You received 88/100.",
    courseCode: "CS 201",
    createdAt: new Date("2026-03-12T17:00:00"),
    read: false,
  },
  {
    id: "notif-003",
    type: "message",
    title: "New message from Prof. Johnson",
    body: "Sure, base case should return 0 when n <= 1.",
    courseCode: "CS 101",
    createdAt: new Date("2026-03-13T10:45:00"),
    read: false,
  },
  {
    id: "notif-004",
    type: "deadline",
    title: "Assignment due in 2 days",
    body: "Lab 3: Recursion is due on March 15 at 11:59 PM.",
    courseCode: "CS 101",
    createdAt: new Date("2026-03-13T07:00:00"),
    read: false,
  },
  {
    id: "notif-005",
    type: "announcement",
    title: "New announcement in CS 101",
    body: "Lab section this Friday is cancelled",
    courseCode: "CS 101",
    createdAt: new Date("2026-03-12T14:10:00"),
    read: true,
  },
  {
    id: "notif-006",
    type: "grade",
    title: "Grade posted for CS 101",
    body: "Quiz 1 has been graded. You received 95/100.",
    courseCode: "CS 101",
    createdAt: new Date("2026-03-11T15:30:00"),
    read: true,
  },
  {
    id: "notif-007",
    type: "deadline",
    title: "Assignment due in 4 days",
    body: "Problem Set 5: Graph Traversals is due on March 17.",
    courseCode: "CS 201",
    createdAt: new Date("2026-03-13T07:00:00"),
    read: true,
  },
  {
    id: "notif-008",
    type: "message",
    title: "New message in Project team check-in",
    body: "Bob Tran: I'll push the updated diagrams tonight.",
    courseCode: "CS 410",
    createdAt: new Date("2026-03-12T18:30:00"),
    read: true,
  },
];
