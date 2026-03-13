"""Seed script for Project Prism – Phase 2.4

Wipes all tables and populates realistic demo data using the async
SQLAlchemy session.

Usage (from the backend/ directory):
    python -m app.db.seed
"""
from __future__ import annotations

import asyncio
import random
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.assignment import Assignment, Submission
from app.models.calendar import CalendarEvent
from app.models.content import Page
from app.models.course import Course, Enrollment, Module, ModuleItem
from app.models.enums import (
    EnrollmentRole,
    EventType,
    ModuleItemType,
    QuestionType,
    UserRole,
)
from app.models.grade import Grade
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.user import User


# ── Helpers ────────────────────────────────────────────────────────────────────

def _dt(
    year: int, month: int, day: int, hour: int = 23, minute: int = 59
) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def _hash_password(password: str) -> str:
    """Hash a password for seeding. Uses bcrypt if available, SHA-256 fallback."""
    try:
        import bcrypt  # type: ignore[import-untyped]

        return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode()
    except ImportError:
        import hashlib

        # NOT production-safe; only for local demo data.
        return "$sha256$" + hashlib.sha256(password.encode()).hexdigest()


# ── Truncate ───────────────────────────────────────────────────────────────────

async def _truncate(session: AsyncSession) -> None:
    """Wipe all seeded tables via CASCADE from the root tables."""
    await session.execute(
        text("TRUNCATE TABLE users, courses RESTART IDENTITY CASCADE")
    )
    await session.commit()
    print("✓  Tables truncated")


# ── Users ──────────────────────────────────────────────────────────────────────

def _make_users() -> list[User]:
    pw = _hash_password("Prism2026!")
    return [
        # ── Professors ────────────────────────────────────────────────────────
        User(
            id=uuid4(),
            email="s.chen@university.edu",
            name="Dr. Sarah Chen",
            role=UserRole.professor,
            timezone="America/New_York",
            bio=(
                "Associate Professor of Computer Science. Research focus: "
                "algorithm design, data structures, and computational complexity."
            ),
            password_hash=pw,
        ),
        User(
            id=uuid4(),
            email="m.williams@university.edu",
            name="Dr. Marcus Williams",
            role=UserRole.professor,
            timezone="America/Chicago",
            bio=(
                "Professor of Electrical and Computer Engineering. "
                "Specialises in digital systems design, computer architecture, and VLSI."
            ),
            password_hash=pw,
        ),
        # ── Teaching Assistants ───────────────────────────────────────────────
        User(
            id=uuid4(),
            email="j.patel@university.edu",
            name="Jaspreet Patel",
            role=UserRole.ta,
            timezone="America/New_York",
            bio="PhD candidate in CS. TA for CS 301 and MATH 240.",
            password_hash=pw,
        ),
        User(
            id=uuid4(),
            email="l.nguyen@university.edu",
            name="Linh Nguyen",
            role=UserRole.ta,
            timezone="America/Chicago",
            bio="MS student in ECE. TA for ECE 243.",
            password_hash=pw,
        ),
        # ── Students ──────────────────────────────────────────────────────────
        User(
            id=uuid4(),
            email="alex.morrison@student.edu",
            name="Alex Morrison",
            role=UserRole.student,
            timezone="America/New_York",
            password_hash=pw,
        ),
        User(
            id=uuid4(),
            email="priya.sharma@student.edu",
            name="Priya Sharma",
            role=UserRole.student,
            timezone="America/Chicago",
            password_hash=pw,
        ),
        User(
            id=uuid4(),
            email="carlos.reyes@student.edu",
            name="Carlos Reyes",
            role=UserRole.student,
            timezone="America/Los_Angeles",
            password_hash=pw,
        ),
        User(
            id=uuid4(),
            email="emma.johnson@student.edu",
            name="Emma Johnson",
            role=UserRole.student,
            timezone="America/New_York",
            password_hash=pw,
        ),
        User(
            id=uuid4(),
            email="noah.kim@student.edu",
            name="Noah Kim",
            role=UserRole.student,
            timezone="America/Chicago",
            password_hash=pw,
        ),
        User(
            id=uuid4(),
            email="isabella.torres@student.edu",
            name="Isabella Torres",
            role=UserRole.student,
            timezone="America/Los_Angeles",
            password_hash=pw,
        ),
        User(
            id=uuid4(),
            email="liam.oconnor@student.edu",
            name="Liam O'Connor",
            role=UserRole.student,
            timezone="America/New_York",
            password_hash=pw,
        ),
        User(
            id=uuid4(),
            email="zoe.washington@student.edu",
            name="Zoe Washington",
            role=UserRole.student,
            timezone="America/Chicago",
            password_hash=pw,
        ),
    ]


# ── Courses ────────────────────────────────────────────────────────────────────

def _make_courses(prof1: User, prof2: User) -> list[Course]:
    """Return the 3 canonical demo courses."""
    shared_late = {"penalty_per_day": 10, "max_penalty": 50}
    shared_scheme = {"A": 90, "B": 80, "C": 70, "D": 60}
    return [
        Course(
            id=uuid4(),
            title="CS 301 Data Structures",
            code="CS301",
            term="Spring 2026",
            instructor_id=prof1.id,
            description=(
                "Study of fundamental data structures including arrays, linked lists, "
                "stacks, queues, trees, and graphs. Emphasis on algorithm design and "
                "asymptotic complexity analysis."
            ),
            grading_scheme=shared_scheme,
            late_policy=shared_late,
        ),
        Course(
            id=uuid4(),
            title="ECE 243 Computer Organization",
            code="ECE243",
            term="Spring 2026",
            instructor_id=prof2.id,
            description=(
                "Introduction to computer organisation: digital logic, Boolean algebra, "
                "combinational and sequential circuits, MIPS instruction set architecture, "
                "assembly language programming, and memory hierarchy."
            ),
            grading_scheme=shared_scheme,
            late_policy=shared_late,
        ),
        Course(
            id=uuid4(),
            title="MATH 240 Linear Algebra",
            code="MATH240",
            term="Spring 2026",
            instructor_id=prof1.id,
            description=(
                "Vector spaces, linear transformations, matrices, determinants, "
                "eigenvalues and eigenvectors, with applications to engineering, "
                "data science, and computer graphics."
            ),
            grading_scheme=shared_scheme,
            late_policy={"penalty_per_day": 5, "max_penalty": 30},
        ),
    ]


# ── Enrollments ────────────────────────────────────────────────────────────────

def _make_enrollments(
    courses: list[Course],
    prof1: User,
    prof2: User,
    ta1: User,
    ta2: User,
    students: list[User],
) -> list[Enrollment]:
    cs301, ece243, math240 = courses

    def enroll(user: User, course: Course, role: EnrollmentRole) -> Enrollment:
        return Enrollment(
            id=uuid4(), user_id=user.id, course_id=course.id, role=role
        )

    rows: list[Enrollment] = [
        # Professors
        enroll(prof1, cs301, EnrollmentRole.professor),
        enroll(prof2, ece243, EnrollmentRole.professor),
        enroll(prof1, math240, EnrollmentRole.professor),
        # TAs
        enroll(ta1, cs301, EnrollmentRole.ta),
        enroll(ta2, ece243, EnrollmentRole.ta),
        enroll(ta1, math240, EnrollmentRole.ta),
    ]

    # All 8 students → CS 301
    for s in students:
        rows.append(enroll(s, cs301, EnrollmentRole.student))

    # First 6 students → ECE 243
    for s in students[:6]:
        rows.append(enroll(s, ece243, EnrollmentRole.student))

    # Last 5 students → MATH 240
    for s in students[3:]:
        rows.append(enroll(s, math240, EnrollmentRole.student))

    return rows


# ── Assignments ────────────────────────────────────────────────────────────────

def _make_assignments(courses: list[Course]) -> list[Assignment]:
    cs301, ece243, math240 = courses
    assignments: list[Assignment] = []

    # ── CS 301 ────────────────────────────────────────────────────────────────
    cs_specs: list[tuple[str, str, float, datetime, list[str]]] = [
        (
            "PA1: Stack Implementation",
            "Implement a generic Stack using a dynamic array. Provide push, pop, peek, "
            "isEmpty, and size operations with O(1) amortised complexity. Include unit tests.",
            100.0,
            _dt(2026, 1, 24),
            ["text"],
        ),
        (
            "PA2: Queue Using Linked Lists",
            "Implement a Queue backed by a singly linked list. Enqueue and dequeue must "
            "both be O(1). Submit a PDF report with complexity proofs.",
            100.0,
            _dt(2026, 2, 3),
            ["file"],
        ),
        (
            "Lab Report: Binary Search Tree Analysis",
            "Empirically measure BST search, insert, and delete on random vs sorted input "
            "sizes n ∈ {100, 1 000, 10 000}. Submit a report with timing graphs and "
            "comparison to theoretical O(h) bounds.",
            75.0,
            _dt(2026, 2, 14),
            ["url"],
        ),
        (
            "PA3: Graph Traversal",
            "Implement BFS and DFS over an adjacency-list graph. Use them to (a) find "
            "connected components and (b) detect cycles. Provide test cases for each.",
            100.0,
            _dt(2026, 2, 28),
            ["file"],
        ),
        (
            "Final Project Proposal",
            "Submit a 2-page proposal for your data-structure-intensive final project. "
            "Describe the data structures chosen, expected complexities, and a week-by-week "
            "delivery timeline.",
            50.0,
            _dt(2026, 3, 10),
            ["text", "url"],
        ),
    ]
    for title, desc, pts, due, stypes in cs_specs:
        assignments.append(
            Assignment(
                id=uuid4(),
                course_id=cs301.id,
                title=title,
                description=desc,
                points_possible=pts,
                due_date=due,
                lock_date=due + timedelta(days=3),
                submission_types=stypes,
                is_published=True,
            )
        )

    # ── ECE 243 ───────────────────────────────────────────────────────────────
    ece_specs: list[tuple[str, str, float, datetime, list[str]]] = [
        (
            "Lab 1: Boolean Algebra Simplification",
            "Simplify the provided Boolean expressions using algebraic laws and Karnaugh "
            "maps. Verify each result with a complete truth table. Submit a scanned PDF.",
            80.0,
            _dt(2026, 1, 22),
            ["file"],
        ),
        (
            "Lab 2: 4-Bit Ripple-Carry Adder",
            "Design a 4-bit ripple-carry adder using full-adder subcircuits in Logisim. "
            "Demonstrate correct addition for at least 8 test cases including carry-out. "
            "Submit the .circ file and a screenshot report.",
            100.0,
            _dt(2026, 2, 5),
            ["file"],
        ),
        (
            "Lab 3: Modulo-6 Counter Design",
            "Design a synchronous modulo-6 counter using D flip-flops. Provide the state "
            "diagram, next-state table, excitation equations, Logisim implementation, and "
            "simulation waveforms.",
            90.0,
            _dt(2026, 2, 17),
            ["url"],
        ),
        (
            "Lab 4: MIPS Fibonacci Program",
            "Write a MIPS assembly program that reads N from stdin and prints the first N "
            "Fibonacci numbers. Include a function using the $ra/jal calling convention. "
            "Submit your .asm file and a short report.",
            100.0,
            _dt(2026, 3, 1),
            ["file", "url"],
        ),
        (
            "Final Project: Single-Cycle CPU Documentation",
            "Document the single-cycle MIPS CPU built throughout the semester. Include an "
            "annotated datapath diagram, complete control-unit truth table, and performance "
            "analysis (CPI, critical path delay).",
            120.0,
            _dt(2026, 3, 12),
            ["text", "file"],
        ),
    ]
    for title, desc, pts, due, stypes in ece_specs:
        assignments.append(
            Assignment(
                id=uuid4(),
                course_id=ece243.id,
                title=title,
                description=desc,
                points_possible=pts,
                due_date=due,
                lock_date=due + timedelta(days=3),
                submission_types=stypes,
                is_published=True,
            )
        )

    # ── MATH 240 ──────────────────────────────────────────────────────────────
    math_specs: list[tuple[str, str, float, datetime, list[str]]] = [
        (
            "Problem Set 1: Matrix Operations",
            "Complete the 10 problems covering matrix addition, multiplication, transpose, "
            "and inverse. Show all arithmetic steps; answers without work receive no credit.",
            50.0,
            _dt(2026, 1, 25),
            ["text"],
        ),
        (
            "Problem Set 2: Linear Transformations",
            "Determine whether each mapping is a linear transformation. For those that are, "
            "find the standard matrix, compute kernel and image, and state rank + nullity.",
            50.0,
            _dt(2026, 2, 6),
            ["text"],
        ),
        (
            "Midterm Reflection Essay",
            "Write a 500-word essay connecting a linear-algebra concept (your choice) to a "
            "real-world application such as computer graphics, signal processing, or ML. "
            "Cite at least two external sources.",
            30.0,
            _dt(2026, 2, 18),
            ["text", "url"],
        ),
        (
            "Problem Set 3: Eigenvalue Computations",
            "Find eigenvalues and eigenvectors for the given 3×3 matrices. Determine "
            "diagonalisability and, where applicable, compute A^10 using diagonalisation.",
            60.0,
            _dt(2026, 3, 3),
            ["text", "file"],
        ),
        (
            "Applications Project: PCA with NumPy",
            "Implement PCA from scratch on a provided dataset using NumPy. Submit a Jupyter "
            "notebook and a 1-page writeup explaining how eigenvectors define the principal "
            "components.",
            80.0,
            _dt(2026, 3, 13),
            ["file", "url"],
        ),
    ]
    for title, desc, pts, due, stypes in math_specs:
        assignments.append(
            Assignment(
                id=uuid4(),
                course_id=math240.id,
                title=title,
                description=desc,
                points_possible=pts,
                due_date=due,
                lock_date=due + timedelta(days=3),
                submission_types=stypes,
                is_published=True,
            )
        )

    return assignments


# ── Quizzes + Questions ────────────────────────────────────────────────────────

def _make_quizzes(
    courses: list[Course],
) -> tuple[list[Quiz], list[QuizQuestion]]:
    cs301, ece243, math240 = courses
    quizzes: list[Quiz] = []
    questions: list[QuizQuestion] = []

    # Helper builders ──────────────────────────────────────────────────────────
    def mc(
        quiz_id: UUID,
        pos: int,
        text: str,
        choices: list[str],
        correct: str,
        pts: float = 2.0,
    ) -> QuizQuestion:
        return QuizQuestion(
            id=uuid4(),
            quiz_id=quiz_id,
            question_type=QuestionType.multiple_choice,
            question_text=text,
            points=pts,
            position=pos,
            options={"choices": choices},
            correct_answer=correct,
        )

    def tf(
        quiz_id: UUID, pos: int, text: str, correct: str, pts: float = 1.0
    ) -> QuizQuestion:
        return QuizQuestion(
            id=uuid4(),
            quiz_id=quiz_id,
            question_type=QuestionType.true_false,
            question_text=text,
            points=pts,
            position=pos,
            options={"choices": ["True", "False"]},
            correct_answer=correct,
        )

    def essay(
        quiz_id: UUID, pos: int, text: str, pts: float = 5.0
    ) -> QuizQuestion:
        return QuizQuestion(
            id=uuid4(),
            quiz_id=quiz_id,
            question_type=QuestionType.essay,
            question_text=text,
            points=pts,
            position=pos,
            options=None,
            correct_answer=None,
        )

    # ── CS 301 Quiz 1: Midterm Review ─────────────────────────────────────────
    q1 = Quiz(
        id=uuid4(),
        course_id=cs301.id,
        title="Midterm Review: Arrays and Linked Lists",
        description="Covers weeks 1–5: arrays, linked lists, stacks, and queues.",
        time_limit_minutes=30,
        attempt_limit=1,
        points_possible=13.0,
        is_published=True,
        available_from=_dt(2026, 2, 9, 8, 0),
        available_until=_dt(2026, 2, 10, 23, 59),
    )
    quizzes.append(q1)
    questions += [
        mc(
            q1.id, 0,
            "What is the time complexity of accessing an element by index in a fixed-size array?",
            ["O(1)", "O(n)", "O(log n)", "O(n²)"],
            "O(1)",
        ),
        mc(
            q1.id, 1,
            "What is the time complexity of inserting a node at the head of a singly linked list?",
            ["O(1)", "O(n)", "O(log n)", "O(n²)"],
            "O(1)",
        ),
        tf(
            q1.id, 2,
            "A doubly linked list requires more memory per node than a singly linked list "
            "because each node stores two pointers instead of one.",
            "True",
        ),
        essay(
            q1.id, 3,
            "Describe two scenarios where a linked list is preferable to a dynamic array. "
            "Discuss both time-complexity and memory trade-offs in your answer.",
        ),
        mc(
            q1.id, 4,
            "What is the best-case time complexity of bubble sort on an already-sorted array "
            "when an early-termination flag is used?",
            ["O(1)", "O(n)", "O(n log n)", "O(n²)"],
            "O(n)",
        ),
    ]

    # ── CS 301 Quiz 2: Final Review ───────────────────────────────────────────
    q2 = Quiz(
        id=uuid4(),
        course_id=cs301.id,
        title="Final Review: Trees and Graphs",
        description="Covers weeks 6–12: binary trees, BSTs, heaps, BFS/DFS.",
        time_limit_minutes=35,
        attempt_limit=1,
        points_possible=13.0,
        is_published=True,
        available_from=_dt(2026, 3, 7, 8, 0),
        available_until=_dt(2026, 3, 8, 23, 59),
    )
    quizzes.append(q2)
    questions += [
        mc(
            q2.id, 0,
            "What is the height of a complete binary tree containing n nodes?",
            ["O(1)", "O(n)", "O(log n)", "O(n²)"],
            "O(log n)",
        ),
        tf(
            q2.id, 1,
            "Depth-First Search (DFS) can be implemented iteratively using a queue "
            "as its auxiliary data structure.",
            "False",
        ),
        mc(
            q2.id, 2,
            "Which tree traversal visits the root first, then the left subtree, "
            "then the right subtree?",
            ["Inorder", "Postorder", "Preorder", "Level-order"],
            "Preorder",
        ),
        essay(
            q2.id, 3,
            "Compare BFS and DFS for finding the shortest path in an unweighted graph. "
            "Under what conditions does each approach perform better, and why?",
        ),
        mc(
            q2.id, 4,
            "What is the time complexity of inserting an element into a binary min-heap?",
            ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
            "O(log n)",
        ),
    ]

    # ── ECE 243 Quiz 1: Digital Logic ─────────────────────────────────────────
    q3 = Quiz(
        id=uuid4(),
        course_id=ece243.id,
        title="Digital Logic and Boolean Algebra",
        description="Boolean algebra, logic gates, SOP/POS forms, and Karnaugh maps.",
        time_limit_minutes=25,
        attempt_limit=1,
        points_possible=13.0,
        is_published=True,
        available_from=_dt(2026, 2, 11, 8, 0),
        available_until=_dt(2026, 2, 12, 23, 59),
    )
    quizzes.append(q3)
    questions += [
        mc(
            q3.id, 0,
            "Which logic gate produces a HIGH (1) output only when ALL inputs are HIGH?",
            ["OR", "AND", "NAND", "XOR"],
            "AND",
        ),
        tf(
            q3.id, 1,
            "A NAND gate is functionally complete: any Boolean function can be "
            "implemented using only NAND gates.",
            "True",
        ),
        mc(
            q3.id, 2,
            "Using a Karnaugh map, simplify F = A'B + AB' + AB. The minimal SOP result is:",
            ["A + B", "AB", "A' + B'", "A XOR B"],
            "A + B",
        ),
        essay(
            q3.id, 3,
            "State both of De Morgan's theorems. Then apply them to simplify "
            "F = (A·B)' + (C·D)' and draw the resulting gate circuit.",
        ),
        mc(
            q3.id, 4,
            "A 3-variable Karnaugh map contains how many cells?",
            ["4", "6", "8", "16"],
            "8",
        ),
    ]

    # ── ECE 243 Quiz 2: Sequential Circuits ───────────────────────────────────
    q4 = Quiz(
        id=uuid4(),
        course_id=ece243.id,
        title="Sequential Circuits and MIPS Assembly",
        description="D/JK flip-flops, counters, FSMs, and MIPS instruction set.",
        time_limit_minutes=30,
        attempt_limit=1,
        points_possible=13.0,
        is_published=True,
        available_from=_dt(2026, 3, 4, 8, 0),
        available_until=_dt(2026, 3, 5, 23, 59),
    )
    quizzes.append(q4)
    questions += [
        mc(
            q4.id, 0,
            "How many bits does a single D flip-flop store?",
            ["0", "1", "2", "4"],
            "1",
        ),
        tf(
            q4.id, 1,
            "A ripple (asynchronous) counter is faster than a synchronous counter "
            "for large bit-widths because carry propagation is parallelised.",
            "False",
        ),
        mc(
            q4.id, 2,
            "Which MIPS instruction loads a 32-bit word from memory into a register?",
            ["add", "lw", "sw", "beq"],
            "lw",
        ),
        essay(
            q4.id, 3,
            "Explain the fundamental difference between combinational and sequential "
            "logic circuits. Give one real-world example of each and describe why "
            "memory (state) is needed in the sequential case.",
        ),
        mc(
            q4.id, 4,
            "A processor running at a clock frequency of 1 GHz has a clock period of:",
            ["1 μs", "1 ms", "1 ns", "10 ns"],
            "1 ns",
        ),
    ]

    # ── MATH 240 Quiz 1: Matrix Operations ────────────────────────────────────
    q5 = Quiz(
        id=uuid4(),
        course_id=math240.id,
        title="Matrix Operations and Linear Transformations",
        description="Matrix arithmetic, row reduction, rank, and transformation properties.",
        time_limit_minutes=30,
        attempt_limit=1,
        points_possible=13.0,
        is_published=True,
        available_from=_dt(2026, 2, 14, 8, 0),
        available_until=_dt(2026, 2, 15, 23, 59),
    )
    quizzes.append(q5)
    questions += [
        mc(
            q5.id, 0,
            "The rank of an m × n matrix is at most:",
            ["m", "n", "m + n", "min(m, n)"],
            "min(m, n)",
        ),
        tf(
            q5.id, 1,
            "Every matrix has a unique reduced row echelon form (RREF), regardless "
            "of the sequence of row operations applied.",
            "True",
        ),
        mc(
            q5.id, 2,
            "A linear transformation T: ℝⁿ → ℝᵐ is represented by a standard matrix A "
            "of size:",
            ["n × m", "m × n", "n × n", "m × m"],
            "m × n",
        ),
        essay(
            q5.id, 3,
            "Explain how the rank of the coefficient matrix A determines whether the "
            "system Ax = b has no solution, exactly one solution, or infinitely many "
            "solutions. Use the Rank–Nullity Theorem in your answer.",
        ),
        mc(
            q5.id, 4,
            "The determinant of the n × n identity matrix Iₙ equals:",
            ["0", "n", "1", "-1"],
            "1",
        ),
    ]

    # ── MATH 240 Quiz 2: Eigenvalues ──────────────────────────────────────────
    q6 = Quiz(
        id=uuid4(),
        course_id=math240.id,
        title="Eigenvalues, Eigenvectors, and Diagonalisation",
        description="Characteristic polynomial, diagonalisation, and PCA applications.",
        time_limit_minutes=35,
        attempt_limit=1,
        points_possible=13.0,
        is_published=True,
        available_from=_dt(2026, 3, 6, 8, 0),
        available_until=_dt(2026, 3, 7, 23, 59),
    )
    quizzes.append(q6)
    questions += [
        mc(
            q6.id, 0,
            "The eigenvalues of a triangular matrix are:",
            ["always 1", "its diagonal entries", "always 0", "its row sums"],
            "its diagonal entries",
        ),
        tf(
            q6.id, 1,
            "An n × n matrix that has n distinct eigenvalues is always diagonalisable.",
            "True",
        ),
        mc(
            q6.id, 2,
            "The characteristic polynomial of a 2 × 2 matrix is of degree:",
            ["1", "2", "3", "4"],
            "2",
        ),
        essay(
            q6.id, 3,
            "Explain geometrically what eigenvalues and eigenvectors represent for a "
            "linear transformation. Reference stretching, compression, or reflection as "
            "part of your explanation.",
        ),
        mc(
            q6.id, 4,
            "If λ is an eigenvalue of matrix A, the corresponding eigenvalue of 2A is:",
            ["λ", "λ / 2", "2λ", "λ²"],
            "2λ",
        ),
    ]

    return quizzes, questions


# ── Pages ──────────────────────────────────────────────────────────────────────

def _make_pages(courses: list[Course], profs: list[User]) -> list[Page]:
    cs301, ece243, math240 = courses
    prof1, prof2 = profs
    pages: list[Page] = []

    cs_content: list[tuple[str, str, str]] = [
        (
            "Course Overview and Syllabus",
            "cs301-syllabus",
            "# CS 301 – Data Structures\n\nWelcome to CS 301! This course covers the "
            "design, implementation, and analysis of fundamental data structures.\n\n"
            "## Topics\n- Arrays and Linked Lists\n- Stacks and Queues\n"
            "- Trees (BST, AVL, Heaps)\n- Graphs (BFS, DFS, shortest paths)\n"
            "- Asymptotic complexity analysis\n\n"
            "## Grading\n- Programming Assignments: 40 %\n- Quizzes: 20 %\n"
            "- Midterm Exam: 20 %\n- Final Project: 20 %",
        ),
        (
            "Introduction to Big-O Notation",
            "cs301-big-o",
            "# Big-O Notation\n\nBig-O describes the **upper bound** on an algorithm's "
            "growth rate as input size n → ∞.\n\n"
            "| Notation | Class | Canonical Example |\n|---|---|---|\n"
            "| O(1) | Constant | Array index access |\n"
            "| O(log n) | Logarithmic | Binary search |\n"
            "| O(n) | Linear | Linear scan |\n"
            "| O(n log n) | Linearithmic | Merge sort |\n"
            "| O(n²) | Quadratic | Bubble sort |\n\n"
            "## Space Complexity\nAlways analyse both time *and* space. A linked list "
            "with n nodes uses Θ(n) space.",
        ),
        (
            "Trees: BSTs and Balanced Variants",
            "cs301-trees",
            "# Binary Search Trees\n\nA BST satisfies: for every node N, all keys in "
            "the left subtree are < N and all keys in the right subtree are > N.\n\n"
            "## Core Operations\n- **Search**: O(h)\n- **Insert**: O(h)\n"
            "- **Delete**: O(h), where h is the tree height.\n\n"
            "Worst-case h = n (degenerate/sorted input). AVL and Red-Black trees "
            "enforce h = O(log n) via rotations.",
        ),
        (
            "Graph Representations and Traversals",
            "cs301-graphs",
            "# Graph Representations\n\n## Adjacency Matrix\n"
            "- Space: O(V²)\n- Edge lookup: O(1)\n\n"
            "## Adjacency List\n- Space: O(V + E)\n- Edge lookup: O(degree(v))\n\n"
            "## BFS\nUses a FIFO queue. Guarantees shortest path (fewest edges) in "
            "unweighted graphs. Time: O(V + E).\n\n"
            "## DFS\nUses a stack (or recursion). Useful for cycle detection, "
            "topological sort, and SCC discovery. Time: O(V + E).",
        ),
    ]
    for title, slug, body in cs_content:
        pages.append(
            Page(
                id=uuid4(),
                course_id=cs301.id,
                title=title,
                slug=slug,
                body=body,
                author_id=prof1.id,
                is_published=True,
            )
        )

    ece_content: list[tuple[str, str, str]] = [
        (
            "Course Overview and Syllabus",
            "ece243-syllabus",
            "# ECE 243 – Computer Organization\n\n"
            "Covers the internal structure of computers from digital logic to machine code.\n\n"
            "## Topics\n- Boolean algebra and logic gates\n"
            "- Combinational circuits (adders, MUX, decoders)\n"
            "- Sequential circuits (flip-flops, counters, FSMs)\n"
            "- MIPS assembly language programming\n- Memory hierarchy\n\n"
            "## Grading\n- Labs: 35 %\n- Quizzes: 20 %\n"
            "- Midterm: 20 %\n- Final Project: 25 %",
        ),
        (
            "Boolean Algebra and Logic Gates",
            "ece243-boolean",
            "# Boolean Algebra\n\nOperates on {0, 1} with operations AND (·), OR (+), NOT (').\n\n"
            "## Key Laws\n- **Identity**: A + 0 = A, A · 1 = A\n"
            "- **Null**: A + 1 = 1, A · 0 = 0\n"
            "- **Complement**: A + A' = 1, A · A' = 0\n"
            "- **De Morgan**: (A·B)' = A' + B' and (A+B)' = A' · B'\n\n"
            "## Karnaugh Maps\nGroup adjacent 1s in powers of 2 to minimise SOP expressions. "
            "A 2-variable K-map has 4 cells; a 3-variable map has 8; a 4-variable map has 16.",
        ),
        (
            "Combinational Circuits: Adders and Multiplexers",
            "ece243-combinational",
            "# Combinational Circuits\n\n## Half Adder\n"
            "- Sum = A ⊕ B\n- Carry = A · B\n\n"
            "## Full Adder\n- Sum = A ⊕ B ⊕ Cᵢₙ\n"
            "- Cₒᵤₜ = (A·B) + (Cᵢₙ·(A ⊕ B))\n\n"
            "## 4-Bit Ripple-Carry Adder\nChain four full adders; carry propagates from "
            "LSB to MSB. Worst-case delay grows linearly with bit-width (4·tFA).\n\n"
            "## Multiplexer (MUX)\n2-to-1 MUX: Y = S'·A + S·B. Used to route data "
            "and implement arbitrary Boolean functions.",
        ),
        (
            "MIPS Assembly Language",
            "ece243-mips",
            "# MIPS Assembly\n\n## Register File\n"
            "32 general-purpose 32-bit registers: $zero, $at, $v0–$v1, $a0–$a3, "
            "$t0–$t9, $s0–$s7, $sp, $fp, $ra.\n\n"
            "## Instruction Formats\n- **R-type**: `op rs rt rd shamt funct`\n"
            "- **I-type**: `op rs rt immediate`\n- **J-type**: `op target`\n\n"
            "## Common Instructions\n```asm\n"
            "add  $t0, $t1, $t2     # $t0 = $t1 + $t2\n"
            "lw   $t0, 4($sp)       # load word\n"
            "sw   $t0, 4($sp)       # store word\n"
            "beq  $t0, $t1, label   # branch if equal\n"
            "jal  label             # jump and link\n```",
        ),
    ]
    for title, slug, body in ece_content:
        pages.append(
            Page(
                id=uuid4(),
                course_id=ece243.id,
                title=title,
                slug=slug,
                body=body,
                author_id=prof2.id,
                is_published=True,
            )
        )

    math_content: list[tuple[str, str, str]] = [
        (
            "Course Overview and Syllabus",
            "math240-syllabus",
            "# MATH 240 – Linear Algebra\n\n"
            "Introduction to linear algebra with applications in engineering and data science.\n\n"
            "## Topics\n- Vectors and matrix operations\n"
            "- Systems of linear equations and row reduction\n"
            "- Linear transformations\n- Determinants\n"
            "- Eigenvalues and eigenvectors\n- Applications: PCA, Markov chains\n\n"
            "## Grading\n- Problem Sets: 40 %\n- Quizzes: 20 %\n"
            "- Midterm: 20 %\n- Final Project: 20 %",
        ),
        (
            "Vectors, Matrices, and Row Reduction",
            "math240-vectors",
            "# Vectors and Matrices\n\n## Matrix Multiplication\n"
            "For A (m×k) and B (k×n), the product C = AB is m×n where "
            "Cᵢⱼ = Σₖ Aᵢₖ · Bₖⱼ. Not commutative in general.\n\n"
            "## Row Reduction (Gaussian Elimination)\n"
            "Apply elementary row operations to bring A to Row Echelon Form (REF), "
            "then back-substitute to solve Ax = b.\n\n"
            "## Rank\nrank(A) = number of pivot positions = dim(Col A). "
            "The Rank-Nullity theorem states: rank(A) + nullity(A) = n.",
        ),
        (
            "Eigenvalues and Eigenvectors",
            "math240-eigenvalues",
            "# Eigenvalues and Eigenvectors\n\n"
            "λ is an **eigenvalue** of A if Av = λv for some nonzero vector v "
            "(the corresponding **eigenvector**).\n\n"
            "## Finding Eigenvalues\n1. Solve det(A − λI) = 0 (characteristic equation).\n"
            "2. Roots λ₁, λ₂, … are the eigenvalues.\n\n"
            "## Diagonalisation\nIf A has n linearly independent eigenvectors, "
            "A = PDP⁻¹ where D = diag(λ₁, …, λₙ) and P has eigenvectors as columns. "
            "Enables O(n) computation of Aᵏ.",
        ),
        (
            "Applications: PCA and Markov Chains",
            "math240-applications",
            "# Applications of Linear Algebra\n\n## Principal Component Analysis (PCA)\n"
            "1. Centre data: X̃ = X − μ\n"
            "2. Compute covariance matrix Σ = X̃ᵀX̃ / (n−1)\n"
            "3. Find eigenvectors of Σ → principal components (PCs)\n"
            "4. Project X̃ onto top-k PCs for dimensionality reduction.\n\n"
            "## Markov Chains\nA stochastic matrix P has columns summing to 1. "
            "The steady-state distribution π satisfies Pπ = π, i.e., π is the "
            "eigenvector of P for eigenvalue λ = 1.",
        ),
    ]
    for title, slug, body in math_content:
        pages.append(
            Page(
                id=uuid4(),
                course_id=math240.id,
                title=title,
                slug=slug,
                body=body,
                author_id=prof1.id,
                is_published=True,
            )
        )

    return pages


# ── Modules + ModuleItems ──────────────────────────────────────────────────────

def _make_modules_and_items(
    courses: list[Course],
    assignments: list[Assignment],
    quizzes: list[Quiz],
    pages: list[Page],
) -> tuple[list[Module], list[ModuleItem]]:
    cs301, ece243, math240 = courses

    def by_course(seq: list, cid: UUID) -> list:  # type: ignore[type-arg]
        return [x for x in seq if x.course_id == cid]

    cs_a = by_course(assignments, cs301.id)
    ece_a = by_course(assignments, ece243.id)
    math_a = by_course(assignments, math240.id)

    cs_q = by_course(quizzes, cs301.id)
    ece_q = by_course(quizzes, ece243.id)
    math_q = by_course(quizzes, math240.id)

    cs_p = by_course(pages, cs301.id)
    ece_p = by_course(pages, ece243.id)
    math_p = by_course(pages, math240.id)

    modules: list[Module] = []
    items: list[ModuleItem] = []

    T = ModuleItemType  # shorthand

    def add_module(
        course_id: UUID,
        title: str,
        desc: str,
        pos: int,
        specs: list[tuple[ModuleItemType, UUID]],
    ) -> None:
        m = Module(
            id=uuid4(),
            course_id=course_id,
            title=title,
            description=desc,
            position=pos,
            is_published=True,
        )
        modules.append(m)
        for item_pos, (itype, iid) in enumerate(specs):
            items.append(
                ModuleItem(
                    id=uuid4(),
                    module_id=m.id,
                    item_type=itype,
                    item_id=iid,
                    position=item_pos,
                    is_published=True,
                )
            )

    # ── CS 301 ──────────────────────────────────────────────────────────────
    add_module(cs301.id, "Module 1: Course Introduction",
               "Syllabus, expectations, and Big-O fundamentals.", 0, [
                   (T.page, cs_p[0].id),
                   (T.page, cs_p[1].id),
                   (T.assignment, cs_a[0].id),
               ])
    add_module(cs301.id, "Module 2: Linear Data Structures",
               "Arrays, linked lists, stacks, and queues.", 1, [
                   (T.assignment, cs_a[1].id),
                   (T.assignment, cs_a[2].id),
                   (T.quiz, cs_q[0].id),
               ])
    add_module(cs301.id, "Module 3: Trees and Hierarchical Structures",
               "Binary trees, BSTs, AVL trees, and heaps.", 2, [
                   (T.page, cs_p[2].id),
                   (T.assignment, cs_a[3].id),
               ])
    add_module(cs301.id, "Module 4: Graphs and Final Topics",
               "Graph traversals, algorithm analysis, and the final project.", 3, [
                   (T.page, cs_p[3].id),
                   (T.quiz, cs_q[1].id),
                   (T.assignment, cs_a[4].id),
               ])

    # ── ECE 243 ─────────────────────────────────────────────────────────────
    add_module(ece243.id, "Module 1: Digital Logic Fundamentals",
               "Boolean algebra, logic gates, and Karnaugh maps.", 0, [
                   (T.page, ece_p[0].id),
                   (T.page, ece_p[1].id),
                   (T.assignment, ece_a[0].id),
               ])
    add_module(ece243.id, "Module 2: Combinational Circuits",
               "Adders, multiplexers, and decoders.", 1, [
                   (T.page, ece_p[2].id),
                   (T.assignment, ece_a[1].id),
                   (T.quiz, ece_q[0].id),
               ])
    add_module(ece243.id, "Module 3: Sequential Circuits and FSMs",
               "Flip-flops, synchronous counters, and finite state machines.", 2, [
                   (T.assignment, ece_a[2].id),
                   (T.assignment, ece_a[3].id),
                   (T.quiz, ece_q[1].id),
               ])
    add_module(ece243.id, "Module 4: MIPS Assembly and CPU Design",
               "Assembly programming and single-cycle CPU architecture.", 3, [
                   (T.page, ece_p[3].id),
                   (T.assignment, ece_a[4].id),
               ])

    # ── MATH 240 ────────────────────────────────────────────────────────────
    add_module(math240.id, "Module 1: Vectors and Matrix Arithmetic",
               "Foundations: matrix operations and systems of equations.", 0, [
                   (T.page, math_p[0].id),
                   (T.page, math_p[1].id),
                   (T.assignment, math_a[0].id),
               ])
    add_module(math240.id, "Module 2: Linear Transformations",
               "Mappings, standard matrices, kernel, and image.", 1, [
                   (T.assignment, math_a[1].id),
                   (T.assignment, math_a[2].id),
                   (T.quiz, math_q[0].id),
               ])
    add_module(math240.id, "Module 3: Eigenvalues and Eigenvectors",
               "Diagonalisation, spectral theory, and applications.", 2, [
                   (T.page, math_p[2].id),
                   (T.assignment, math_a[3].id),
                   (T.quiz, math_q[1].id),
               ])
    add_module(math240.id, "Module 4: Applications",
               "PCA, Markov chains, least squares, and the final project.", 3, [
                   (T.page, math_p[3].id),
                   (T.assignment, math_a[4].id),
               ])

    return modules, items


# ── Submissions, Quiz Attempts, Grades ────────────────────────────────────────

# Three performance tiers for students (index matches student order).
_PROFILES: list[int] = [2, 1, 0, 2, 1, 2, 0, 1]  # 0=struggling, 1=average, 2=strong
_BASE_SCORES: dict[int, float] = {0: 0.65, 1: 0.78, 2: 0.92}

_FEEDBACK: list[str] = [
    "Good work overall — make sure to handle edge cases in future submissions.",
    "Excellent analysis and clean implementation. Well done!",
    "Partial credit awarded. Please review the relevant lecture notes and visit office hours.",
    "Strong submission. Minor errors in the complexity analysis section.",
    "Needs improvement. I encourage you to visit office hours before the next assignment.",
    "Solid effort. The implementation is correct but could be made more efficient.",
    "Outstanding work — one of the best submissions in the class!",
    "Acceptable, but the written explanation needs to be more rigorous.",
]


def _make_submissions_and_grades(
    enrollments: list[Enrollment],
    assignments: list[Assignment],
    quizzes: list[Quiz],
    questions: list[QuizQuestion],
    students: list[User],
    graders: list[User],
) -> tuple[list[Submission], list[QuizAttempt], list[Grade]]:
    random.seed(42)

    submissions: list[Submission] = []
    attempts: list[QuizAttempt] = []
    grades: list[Grade] = []

    # Fast lookup: (user_id, course_id) → Enrollment
    enroll_map: dict[tuple[UUID, UUID], Enrollment] = {
        (e.user_id, e.course_id): e for e in enrollments
    }

    # Questions grouped by quiz id
    q_per_quiz: dict[UUID, list[QuizQuestion]] = {}
    for q in questions:
        q_per_quiz.setdefault(q.quiz_id, []).append(q)

    # ── Assignment submissions ─────────────────────────────────────────────────
    for assignment in assignments:
        cid = assignment.course_id
        enrolled_students = [
            s
            for s in students
            if (s.id, cid) in enroll_map
            and enroll_map[(s.id, cid)].role == EnrollmentRole.student
        ]
        grader = random.choice(graders)

        for idx, student in enumerate(enrolled_students):
            profile = _PROFILES[idx % len(_PROFILES)]
            score_pct = min(
                1.0,
                max(0.4, _BASE_SCORES[profile] + random.uniform(-0.08, 0.08)),
            )
            raw_score = round(assignment.points_possible * score_pct, 1)
            due = assignment.due_date or _dt(2026, 2, 1)

            # Struggling students occasionally submit late
            day_offset = (
                random.choice([-3, -2, -1, 0, 0, 1])
                if profile == 0
                else random.randint(-5, 0)
            )
            sub_time = due + timedelta(days=day_offset, hours=random.randint(-10, 0))

            body: str | None = None
            file_url: str | None = None
            if "text" in assignment.submission_types:
                body = (
                    f"Submission for '{assignment.title}' by {student.name}. "
                    "Please see attached analysis and implementation notes."
                )
            if "file" in assignment.submission_types:
                file_url = (
                    f"https://s3.example.com/prism-files/{cid}/{student.id}/submission.pdf"
                )
            if "url" in assignment.submission_types and file_url is None:
                file_url = f"https://docs.google.com/document/d/{student.id}"

            sub = Submission(
                id=uuid4(),
                assignment_id=assignment.id,
                student_id=student.id,
                submitted_at=sub_time,
                body=body,
                file_url=file_url,
                grade=raw_score,
                grader_id=grader.id,
                graded_at=due + timedelta(days=random.randint(2, 5)),
                feedback=random.choice(_FEEDBACK),
            )
            submissions.append(sub)

            enrollment = enroll_map[(student.id, cid)]
            grades.append(
                Grade(
                    id=uuid4(),
                    enrollment_id=enrollment.id,
                    assignment_id=assignment.id,
                    quiz_id=None,
                    score=raw_score,
                    max_score=assignment.points_possible,
                    grader_id=grader.id,
                )
            )

    # ── Quiz attempts ──────────────────────────────────────────────────────────
    for quiz in quizzes:
        cid = quiz.course_id
        enrolled_students = [
            s
            for s in students
            if (s.id, cid) in enroll_map
            and enroll_map[(s.id, cid)].role == EnrollmentRole.student
        ]
        qs = q_per_quiz.get(quiz.id, [])
        grader = random.choice(graders)
        open_at = quiz.available_from or _dt(2026, 2, 10, 8, 0)

        for idx, student in enumerate(enrolled_students):
            profile = _PROFILES[idx % len(_PROFILES)]
            score_pct = min(
                1.0,
                max(0.4, _BASE_SCORES[profile] + random.uniform(-0.10, 0.10)),
            )

            answer_map: dict[str, str] = {}
            for q in qs:
                key = str(q.id)
                if q.question_type in (
                    QuestionType.multiple_choice,
                    QuestionType.true_false,
                ):
                    choices: list[str] = (
                        q.options.get("choices", []) if q.options else []  # type: ignore[union-attr]
                    )
                    if q.correct_answer and random.random() < score_pct:
                        answer_map[key] = q.correct_answer
                    elif choices:
                        answer_map[key] = random.choice(choices)
                else:
                    answer_map[key] = (
                        f"Response by {student.name}: detailed written answer here."
                    )

            raw_score = round(quiz.points_possible * score_pct, 1)
            start_offset = timedelta(hours=random.randint(1, 8))
            duration = timedelta(minutes=random.randint(15, quiz.time_limit_minutes or 30))

            attempts.append(
                QuizAttempt(
                    id=uuid4(),
                    quiz_id=quiz.id,
                    student_id=student.id,
                    started_at=open_at + start_offset,
                    submitted_at=open_at + start_offset + duration,
                    score=raw_score,
                    answers=answer_map,
                )
            )

            enrollment = enroll_map[(student.id, cid)]
            grades.append(
                Grade(
                    id=uuid4(),
                    enrollment_id=enrollment.id,
                    assignment_id=None,
                    quiz_id=quiz.id,
                    score=raw_score,
                    max_score=quiz.points_possible,
                    grader_id=grader.id,
                )
            )

    return submissions, attempts, grades


# ── Calendar Events ────────────────────────────────────────────────────────────

def _make_calendar_events(
    assignments: list[Assignment],
    quizzes: list[Quiz],
) -> list[CalendarEvent]:
    events: list[CalendarEvent] = []

    for a in assignments:
        due = a.due_date or _dt(2026, 2, 1)
        events.append(
            CalendarEvent(
                id=uuid4(),
                course_id=a.course_id,
                user_id=None,
                title=f"Due: {a.title}",
                description=f"Submission deadline for assignment '{a.title}'.",
                event_type=EventType.assignment_due,
                start_date=due - timedelta(hours=1),
                end_date=due,
            )
        )

    for q in quizzes:
        window_start = q.available_from or _dt(2026, 2, 10, 8, 0)
        window_end = q.available_until or window_start + timedelta(days=1)
        events.append(
            CalendarEvent(
                id=uuid4(),
                course_id=q.course_id,
                user_id=None,
                title=f"Quiz: {q.title}",
                description=(
                    f"Quiz window: {window_start.strftime('%b %d %H:%M')} UTC "
                    f"→ {window_end.strftime('%b %d %H:%M')} UTC."
                ),
                event_type=EventType.quiz_due,
                start_date=window_start,
                end_date=window_end,
            )
        )

    return events


# ── Orchestrator ───────────────────────────────────────────────────────────────

async def main() -> None:
    print("🌱  Seeding Project Prism database…\n")

    async with AsyncSessionLocal() as session:
        # 1. Wipe existing data
        await _truncate(session)

        # 2. Users
        users = _make_users()
        session.add_all(users)
        await session.flush()
        prof1, prof2 = users[0], users[1]
        ta1, ta2 = users[2], users[3]
        students = users[4:]
        print(f"✓  {len(users)} users")

        # 3. Courses
        courses = _make_courses(prof1, prof2)
        session.add_all(courses)
        await session.flush()
        print(f"✓  {len(courses)} courses")

        # 4. Enrollments
        enrollments = _make_enrollments(courses, prof1, prof2, ta1, ta2, students)
        session.add_all(enrollments)
        await session.flush()
        print(f"✓  {len(enrollments)} enrollments")

        # 5. Pages (must exist before module items reference them)
        pages = _make_pages(courses, [prof1, prof2])
        session.add_all(pages)
        await session.flush()
        print(f"✓  {len(pages)} pages")

        # 6. Assignments
        assignments = _make_assignments(courses)
        session.add_all(assignments)
        await session.flush()
        print(f"✓  {len(assignments)} assignments  (5 per course)")

        # 7. Quizzes, then questions (quiz must exist for FK)
        quizzes, questions = _make_quizzes(courses)
        session.add_all(quizzes)
        await session.flush()
        session.add_all(questions)
        await session.flush()
        print(f"✓  {len(quizzes)} quizzes, {len(questions)} questions  (2 quizzes × 5 Qs per course)")

        # 8. Modules + items
        modules, module_items = _make_modules_and_items(
            courses, assignments, quizzes, pages
        )
        session.add_all(modules)
        await session.flush()
        session.add_all(module_items)
        await session.flush()
        print(f"✓  {len(modules)} modules, {len(module_items)} module items  (4 modules per course)")

        # 9. Submissions, quiz attempts, and grades
        graders = [prof1, prof2, ta1, ta2]
        subs, attempts, grade_rows = _make_submissions_and_grades(
            enrollments, assignments, quizzes, questions, students, graders
        )
        session.add_all(subs)
        await session.flush()
        session.add_all(attempts)
        await session.flush()
        session.add_all(grade_rows)
        await session.flush()
        print(
            f"✓  {len(subs)} submissions, "
            f"{len(attempts)} quiz attempts, "
            f"{len(grade_rows)} grade records"
        )

        # 10. Calendar events auto-derived from due dates
        events = _make_calendar_events(assignments, quizzes)
        session.add_all(events)
        await session.flush()
        print(f"✓  {len(events)} calendar events  (assignment due + quiz windows)")

        await session.commit()

    print("\n✅  Seed complete — database is ready for demo.")


if __name__ == "__main__":
    asyncio.run(main())
