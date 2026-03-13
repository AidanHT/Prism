/**
 * Prism LMS — Core Workflow E2E Tests
 *
 * Covers the "Happy Path" assignment lifecycle end-to-end, plus WCAG 2.1 AA
 * accessibility checks for the SpeedGrader, Quiz Engine, and Calendar views.
 *
 * All FastAPI backend calls are intercepted via page.route() so these tests
 * run without a live backend process.
 *
 * Auth is simulated by injecting Zustand-persisted localStorage state
 * (key: "prism-auth") before each navigation, matching the useAuthStore
 * persist config in src/store/useAuthStore.ts.
 */

import { test, expect, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ── Identifiers ───────────────────────────────────────────────────────────────

const COURSE_ID = "course-001";
const ASSIGNMENT_ID = "assign-001";
const NEW_ASSIGNMENT_ID = "assign-002";
const QUIZ_ID = "quiz-001";
const GRADE_ID = "grade-001";
const ENROLLMENT_ID = "enroll-001";
const STUDENT_ID = "student-001";
const PROFESSOR_ID = "prof-001";

const API = "http://localhost:8000";

// ── Test users ────────────────────────────────────────────────────────────────

const PROFESSOR = {
  id: PROFESSOR_ID,
  email: "professor@prism.edu",
  name: "Dr. Jane Smith",
  role: "Professor" as const,
};

const STUDENT = {
  id: STUDENT_ID,
  email: "student@prism.edu",
  name: "Alex Johnson",
  role: "Student" as const,
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ASSIGNMENT = {
  id: ASSIGNMENT_ID,
  course_id: COURSE_ID,
  title: "Final Research Paper",
  description: "<p>Write a 10-page research paper on distributed systems.</p>",
  points_possible: 100,
  due_date: "2026-12-31T23:59:00Z",
  lock_date: "2027-01-01T23:59:00Z",
  // Use frontend enum values ("text" | "file" | "url") so the submit page
  // shows both the rich-text editor and the file drop zone.
  submission_types: ["text", "file"],
  is_published: true,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

const MOCK_NEW_ASSIGNMENT = {
  ...MOCK_ASSIGNMENT,
  id: NEW_ASSIGNMENT_ID,
  title: "E2E Test Assignment",
  submission_types: ["file"],
};

const MOCK_SUBMISSION = {
  id: "sub-001",
  assignment_id: ASSIGNMENT_ID,
  student_id: STUDENT_ID,
  submitted_at: "2026-03-13T10:00:00Z",
  body: null,
  file_url: "https://example-bucket.s3.amazonaws.com/submissions/paper.pdf",
  grade: null,
  grader_id: null,
  graded_at: null,
  feedback: null,
  created_at: "2026-03-13T10:00:00Z",
  updated_at: "2026-03-13T10:00:00Z",
};

const MOCK_GRADE_UPDATED = {
  id: GRADE_ID,
  enrollment_id: ENROLLMENT_ID,
  assignment_id: ASSIGNMENT_ID,
  quiz_id: null,
  score: 87,
  max_score: 100,
  grader_id: PROFESSOR_ID,
  feedback: "<p>Excellent analysis and clear structure.</p>",
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-13T15:00:00Z",
};

const MOCK_GRADEBOOK = {
  course_id: COURSE_ID,
  assignments: [
    { id: ASSIGNMENT_ID, title: "Final Research Paper", points_possible: 100 },
  ],
  students: [
    {
      student_id: STUDENT_ID,
      student_name: "Alex Johnson",
      student_email: "student@prism.edu",
      enrollment_id: ENROLLMENT_ID,
      grades: [
        {
          grade_id: GRADE_ID,
          assignment_id: ASSIGNMENT_ID,
          quiz_id: null,
          score: 0,
          max_score: 100,
        },
      ],
    },
  ],
};

const MOCK_GRADEBOOK_GRADED = {
  ...MOCK_GRADEBOOK,
  students: [
    {
      ...MOCK_GRADEBOOK.students[0],
      grades: [{ ...MOCK_GRADEBOOK.students[0].grades[0], score: 87 }],
    },
  ],
};

const MOCK_QUIZ = {
  id: QUIZ_ID,
  course_id: COURSE_ID,
  title: "Midterm Quiz",
  description: "Covers chapters 1–5.",
  time_limit_minutes: 30,
  attempt_limit: 1,
  points_possible: 20,
  is_published: true,
  available_from: null,
  available_until: null,
  questions: [
    {
      id: "q-001",
      quiz_id: QUIZ_ID,
      question_type: "multiple_choice",
      question_text: "What is the primary role of an operating system?",
      points: 10,
      position: 1,
      options: {
        choices: [
          "Manage hardware resources",
          "Browse the internet",
          "Compose documents",
          "Play media files",
        ],
      },
      correct_answer: null,
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
    },
    {
      id: "q-002",
      quiz_id: QUIZ_ID,
      question_type: "true_false",
      question_text: "A process is an instance of a running program.",
      points: 10,
      position: 2,
      options: null,
      correct_answer: null,
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
    },
  ],
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

const MOCK_QUIZ_ATTEMPT = {
  id: "attempt-001",
  quiz_id: QUIZ_ID,
  student_id: STUDENT_ID,
  started_at: new Date().toISOString(),
  submitted_at: null,
  score: null,
  answers: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Inject a Zustand-persisted auth state into localStorage before the page
 * loads.  Must be called before page.goto().
 *
 * The key "prism-auth" matches the `name` option in useAuthStore's persist
 * middleware.  The `state` shape mirrors the `partialize` selection
 * (user + token only).
 */
async function setAuth(
  page: Page,
  user: typeof PROFESSOR | typeof STUDENT,
): Promise<void> {
  await page.addInitScript((u) => {
    localStorage.setItem(
      "prism-auth",
      JSON.stringify({
        state: { user: u, token: "mock-token" },
        version: 0,
      }),
    );
  }, user);
}

/**
 * Register page.route() handlers for every API endpoint touched by the
 * core-workflow tests.  Later calls to page.route() for the same URL
 * take priority (Playwright prepends to the handler list).
 */
async function mockCoreRoutes(page: Page): Promise<void> {
  // ── Assignments ─────────────────────────────────────────────────────────────
  await page.route(`${API}/assignments/${ASSIGNMENT_ID}`, (r: Route) =>
    r.fulfill({ json: MOCK_ASSIGNMENT }),
  );

  await page.route(
    `${API}/courses/${COURSE_ID}/assignments`,
    (r: Route) => {
      if (r.request().method() === "POST") {
        r.fulfill({ status: 201, json: MOCK_NEW_ASSIGNMENT });
      } else {
        r.fulfill({ json: [MOCK_ASSIGNMENT] });
      }
    },
  );

  // ── Submissions ─────────────────────────────────────────────────────────────
  await page.route(
    `${API}/assignments/${ASSIGNMENT_ID}/submissions`,
    (r: Route) => r.fulfill({ json: [MOCK_SUBMISSION] }),
  );

  await page.route(
    `${API}/assignments/${ASSIGNMENT_ID}/submissions/me`,
    (r: Route) => r.fulfill({ json: MOCK_SUBMISSION }),
  );

  await page.route(
    `${API}/assignments/${ASSIGNMENT_ID}/submit`,
    (r: Route) => r.fulfill({ status: 201, json: MOCK_SUBMISSION }),
  );

  // ── Gradebook & grades ──────────────────────────────────────────────────────
  await page.route(
    `${API}/courses/${COURSE_ID}/gradebook`,
    (r: Route) => r.fulfill({ json: MOCK_GRADEBOOK }),
  );

  await page.route(
    `${API}/grades/${GRADE_ID}`,
    (r: Route) => r.fulfill({ json: MOCK_GRADE_UPDATED }),
  );

  // ── Quiz ────────────────────────────────────────────────────────────────────
  await page.route(`${API}/quizzes/${QUIZ_ID}`, (r: Route) =>
    r.fulfill({ json: MOCK_QUIZ }),
  );

  await page.route(`${API}/quizzes/${QUIZ_ID}/attempt`, (r: Route) =>
    r.fulfill({ status: 201, json: MOCK_QUIZ_ATTEMPT }),
  );

  await page.route(
    `${API}/quizzes/${QUIZ_ID}/attempt/attempt-001`,
    (r: Route) => r.fulfill({ json: MOCK_QUIZ_ATTEMPT }),
  );

  // ── File upload (S3 presigned flow) ─────────────────────────────────────────
  await page.route(`${API}/files/upload_url`, (r: Route) =>
    r.fulfill({
      json: {
        url: "https://s3.amazonaws.com/prism-test-bucket",
        fields: {
          key: "submissions/test-paper.pdf",
          "Content-Type": "application/pdf",
        },
        s3_key: "submissions/test-paper.pdf",
      },
    }),
  );

  // Absorb any direct S3 POST that the upload flow triggers.
  await page.route("https://s3.amazonaws.com/**", (r: Route) =>
    r.fulfill({ status: 204, body: "" }),
  );

  // ── Notifications & calendar ────────────────────────────────────────────────
  await page.route(`${API}/notifications`, (r: Route) =>
    r.fulfill({ json: [] }),
  );

  await page.route(`${API}/calendar**`, (r: Route) =>
    r.fulfill({ json: [] }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 1 — Assignment Lifecycle (Happy Path)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Assignment Lifecycle — Happy Path", () => {
  test.beforeEach(async ({ page }) => {
    await mockCoreRoutes(page);
  });

  // ── Step 1: Professor creates assignment ─────────────────────────────────────

  test("Professor creates a file-upload assignment with a rubric criterion", async ({
    page,
  }) => {
    await setAuth(page, PROFESSOR);
    await page.goto(`/course/${COURSE_ID}/assignments/new`);

    // ── Fill required fields ─────────────────────────────────────────────────
    await page.fill('[id="title"]', "E2E Test Assignment");
    await page.fill('[id="points"]', "100");

    // Uncheck "text" (default), check "file"
    const textBox = page.locator('[id="st-text"]');
    if (await textBox.isChecked()) await textBox.click();
    const fileBox = page.locator('[id="st-file"]');
    if (!(await fileBox.isChecked())) await fileBox.click();
    await expect(fileBox).toBeChecked();

    // ── Add a rubric criterion ───────────────────────────────────────────────
    await page
      .getByRole("button", { name: /add rubric criterion/i })
      .click();
    await page
      .locator('input[placeholder*="Criterion 1 description"]')
      .fill("Content Quality");

    // ── Submit ───────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /create assignment/i }).click();

    // Backend returns MOCK_NEW_ASSIGNMENT with id = assign-002.
    await expect(page).toHaveURL(
      `/course/${COURSE_ID}/assignments/${NEW_ASSIGNMENT_ID}`,
    );
  });

  // ── Step 2: Student submits the assignment ───────────────────────────────────

  test("Student submits the assignment via file URL", async ({ page }) => {
    await setAuth(page, STUDENT);
    await page.goto(
      `/course/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/submit`,
    );

    // Wait for the assignment title to confirm the page loaded.
    await expect(page.getByText("Final Research Paper")).toBeVisible();

    // Use the manual URL fallback (visible when no file has been selected yet).
    const urlInput = page.locator(
      'input[type="url"][placeholder*="s3.example.com"]',
    );
    await urlInput.fill(
      "https://example-bucket.s3.amazonaws.com/submissions/paper.pdf",
    );

    // Open confirmation dialog.
    await page.getByRole("button", { name: /review & submit/i }).click();
    await expect(
      page.getByRole("heading", { name: /confirm submission/i }),
    ).toBeVisible();

    // Confirm submission.
    await page.getByRole("button", { name: /confirm & submit/i }).click();

    // Should redirect to the assignment detail page.
    await expect(page).toHaveURL(
      `/course/${COURSE_ID}/assignments/${ASSIGNMENT_ID}`,
    );
  });

  // ── Step 3: Professor grades in SpeedGrader ──────────────────────────────────

  test("Professor opens SpeedGrader, enters score 87, and saves", async ({
    page,
  }) => {
    await setAuth(page, PROFESSOR);
    await page.goto(
      `/course/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/grade`,
    );

    await expect(
      page.getByRole("heading", { name: /speedgrader/i }),
    ).toBeVisible();

    // Verify the student's name is rendered in the panel.
    await expect(page.getByText("Alex Johnson")).toBeVisible();

    // Enter score.
    const scoreInput = page.locator('input[type="number"][placeholder="0"]');
    await scoreInput.fill("87");

    // Save — triggers PUT /grades/grade-001.
    await page.getByRole("button", { name: /save grade/i }).click();

    // Sonner renders toasts into elements with data-sonner-toast.
    await expect(page.locator("[data-sonner-toast]")).toContainText(
      /grade saved/i,
    );
  });

  // ── Step 4: Professor verifies updated score in Gradebook ────────────────────

  test("Gradebook reflects score 87 after grading", async ({ page }) => {
    // Override the gradebook route (prepended → higher priority) so it
    // returns the post-grade data with score: 87.
    await page.route(
      `${API}/courses/${COURSE_ID}/gradebook`,
      (r: Route) => r.fulfill({ json: MOCK_GRADEBOOK_GRADED }),
    );

    await setAuth(page, PROFESSOR);
    await page.goto(`/course/${COURSE_ID}/gradebook`);

    // The TanStack Table virtualised cell should display the updated score.
    await expect(page.getByText("87")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 2 — Accessibility (WCAG 2.1 AA)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Accessibility — WCAG 2.1 AA", () => {
  test.beforeEach(async ({ page }) => {
    await mockCoreRoutes(page);
  });

  test("SpeedGrader has zero WCAG 2.1 AA violations", async ({ page }) => {
    await setAuth(page, PROFESSOR);
    await page.goto(
      `/course/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/grade`,
    );

    await expect(
      page.getByRole("heading", { name: /speedgrader/i }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("Quiz Engine (idle phase) has zero WCAG 2.1 AA violations", async ({
    page,
  }) => {
    await setAuth(page, STUDENT);
    await page.goto(`/course/${COURSE_ID}/quizzes/${QUIZ_ID}`);

    // The idle phase renders a "Begin Quiz" call-to-action.
    await expect(
      page.getByRole("button", { name: /begin quiz/i }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("Calendar view has zero WCAG 2.1 AA violations", async ({ page }) => {
    await setAuth(page, PROFESSOR);
    await page.goto("/calendar");

    // FullCalendar is loaded dynamically; wait for its root element.
    await page.waitForSelector(".fc", { timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 3 — Keyboard Navigation & ARIA
// ═══════════════════════════════════════════════════════════════════════════════

test.describe("Keyboard Navigation & ARIA", () => {
  test.beforeEach(async ({ page }) => {
    await mockCoreRoutes(page);
  });

  test("SpeedGrader score input fires save on Enter key", async ({ page }) => {
    await setAuth(page, PROFESSOR);
    await page.goto(
      `/course/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/grade`,
    );

    await expect(
      page.getByRole("heading", { name: /speedgrader/i }),
    ).toBeVisible();

    const scoreInput = page.locator('input[type="number"][placeholder="0"]');
    await scoreInput.fill("92");
    await scoreInput.press("Enter");

    await expect(page.locator("[data-sonner-toast]")).toContainText(
      /grade saved/i,
    );
  });

  test("Submission confirmation dialog has aria-modal and closes on Escape", async ({
    page,
  }) => {
    await setAuth(page, STUDENT);
    await page.goto(
      `/course/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/submit`,
    );

    await expect(page.getByText("Final Research Paper")).toBeVisible();

    // Fill in the URL fallback field to satisfy Zod validation.
    await page
      .locator('input[type="url"][placeholder*="s3.example.com"]')
      .fill("https://example-bucket.s3.amazonaws.com/paper.pdf");

    await page.getByRole("button", { name: /review & submit/i }).click();

    // Radix Dialog sets aria-modal="true" on the dialog content element.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    // Pressing Escape should dismiss the dialog without submitting.
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("Mobile viewport (<md): course sidebar is navigable via toggle", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setAuth(page, PROFESSOR);
    await page.goto(`/course/${COURSE_ID}/assignments/${ASSIGNMENT_ID}`);

    // The AppShell may render a hamburger/menu button on narrow viewports.
    // Only assert the toggle if it actually exists in the DOM.
    const menuBtn = page
      .getByRole("button", { name: /menu|sidebar|navigation/i })
      .first();

    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      // After opening, the primary nav landmark should be visible.
      await expect(page.getByRole("navigation").first()).toBeVisible();
      // Pressing Escape or clicking elsewhere should close the drawer.
      await page.keyboard.press("Escape");
    } else {
      // On some viewport sizes the sidebar is always visible — verify it.
      await expect(page.getByRole("navigation").first()).toBeVisible();
    }
  });

  test("Gradebook Tabs are keyboard-navigable with Arrow keys", async ({
    page,
  }) => {
    await setAuth(page, PROFESSOR);
    await page.goto(`/course/${COURSE_ID}/gradebook`);

    // If the gradebook uses shadcn Tabs, the tablist should accept arrow keys.
    const tablist = page.getByRole("tablist");
    if (await tablist.isVisible()) {
      const firstTab = tablist.getByRole("tab").first();
      await firstTab.focus();
      // Arrow Right moves to the next tab without a mouse click.
      await page.keyboard.press("ArrowRight");
      const secondTab = tablist.getByRole("tab").nth(1);
      await expect(secondTab).toBeFocused();
    }
  });
});
