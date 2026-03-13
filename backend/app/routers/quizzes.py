"""Quizzes microservice router.

Handles quiz CRUD and the full student attempt lifecycle:
  init attempt → save answers incrementally → submit and auto-score.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db
from app.models.course import Course
from app.models.enums import QuestionType
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.user import User
from app.schemas.quizzes import (
    QuizAttemptResponse,
    QuizAttemptUpdate,
    QuizCreate,
    QuizQuestionCreate,
    QuizQuestionResponse,
    QuizQuestionUpdate,
    QuizResponse,
    QuizUpdate,
)

router = APIRouter(tags=["quizzes"])

# ── Quiz CRUD ─────────────────────────────────────────────────────────────────


@router.get("/courses/{course_id}/quizzes", response_model=list[QuizResponse])
async def list_quizzes(
    course_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Quiz]:
    """List all quizzes for a course."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    result = await db.execute(select(Quiz).where(Quiz.course_id == course_id))
    return list(result.scalars().all())


@router.post(
    "/courses/{course_id}/quizzes",
    response_model=QuizResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_quiz(
    course_id: UUID,
    payload: QuizCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Quiz:
    """Create a new quiz in a course."""
    course_row = await db.execute(select(Course).where(Course.id == course_id))
    if course_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    quiz = Quiz(**payload.model_dump())
    db.add(quiz)
    await db.flush()
    await db.refresh(quiz)
    return quiz


@router.get("/quizzes/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Quiz:
    """Retrieve a quiz with its questions."""
    result = await db.execute(
        select(Quiz)
        .where(Quiz.id == quiz_id)
        .options(selectinload(Quiz.questions))
    )
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
    return quiz


@router.put("/quizzes/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: UUID,
    payload: QuizUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Quiz:
    """Update mutable fields on a quiz."""
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(quiz, field, value)
    await db.flush()
    await db.refresh(quiz)
    return quiz


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a quiz, its questions, and all student attempts."""
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalar_one_or_none()
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
    await db.delete(quiz)


# ── Quiz question management ──────────────────────────────────────────────────


@router.post(
    "/quizzes/{quiz_id}/questions",
    response_model=QuizQuestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_question(
    quiz_id: UUID,
    payload: QuizQuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizQuestion:
    """Add a question to a quiz."""
    quiz_row = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    if quiz_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")
    question = QuizQuestion(**payload.model_dump())
    db.add(question)
    await db.flush()
    await db.refresh(question)
    return question


@router.put("/questions/{question_id}", response_model=QuizQuestionResponse)
async def update_question(
    question_id: UUID,
    payload: QuizQuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizQuestion:
    """Update a quiz question."""
    result = await db.execute(select(QuizQuestion).where(QuizQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)
    await db.flush()
    await db.refresh(question)
    return question


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a quiz question."""
    result = await db.execute(select(QuizQuestion).where(QuizQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
    await db.delete(question)


# ── Attempt lifecycle ─────────────────────────────────────────────────────────


@router.post(
    "/quizzes/{quiz_id}/attempt",
    response_model=QuizAttemptResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_attempt(
    quiz_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizAttempt:
    """
    Initialise a new quiz attempt for the current user.

    Sets ``started_at`` to now and leaves ``answers`` empty; the client
    saves individual answers via ``PUT /quizzes/{id}/attempt/{attempt_id}``.
    """
    quiz_row = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    if quiz_row.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz not found.")

    attempt = QuizAttempt(
        quiz_id=quiz_id,
        student_id=current_user.id,
        started_at=datetime.now(tz=timezone.utc),
        answers={},
    )
    db.add(attempt)
    try:
        await db.flush()
        await db.refresh(attempt)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create attempt.",
        ) from exc
    return attempt


@router.put(
    "/quizzes/{quiz_id}/attempt/{attempt_id}",
    response_model=QuizAttemptResponse,
)
async def update_attempt(
    quiz_id: UUID,
    attempt_id: UUID,
    payload: QuizAttemptUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizAttempt:
    """
    Incrementally save student answers without finalising the attempt.

    The ``answers`` dict is **merged** into the existing answers so the client
    can save one question at a time without overwriting previous responses.
    """
    result = await db.execute(
        select(QuizAttempt).where(
            QuizAttempt.id == attempt_id,
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.student_id == current_user.id,
        )
    )
    attempt = result.scalar_one_or_none()
    if attempt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found.",
        )
    if attempt.submitted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This attempt has already been submitted.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Merge new answers into existing ones rather than replacing.
    if "answers" in update_data and update_data["answers"]:
        merged = dict(attempt.answers or {})
        merged.update(update_data.pop("answers"))
        attempt.answers = merged  # type: ignore[assignment]

    for field, value in update_data.items():
        setattr(attempt, field, value)

    await db.flush()
    await db.refresh(attempt)
    return attempt


@router.post(
    "/quizzes/{quiz_id}/attempt/{attempt_id}/submit",
    response_model=QuizAttemptResponse,
)
async def submit_attempt(
    quiz_id: UUID,
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QuizAttempt:
    """
    Finalise a quiz attempt and auto-score objective questions.

    Multiple-choice and true/false questions are graded automatically by
    comparing student answers against ``correct_answer``.  Short-answer,
    essay, and matching questions are left with their raw answers; manual
    grading can update the score afterward.
    """
    result = await db.execute(
        select(QuizAttempt)
        .where(
            QuizAttempt.id == attempt_id,
            QuizAttempt.quiz_id == quiz_id,
            QuizAttempt.student_id == current_user.id,
        )
        .options(selectinload(QuizAttempt.quiz).selectinload(Quiz.questions))
    )
    attempt = result.scalar_one_or_none()
    if attempt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found.",
        )
    if attempt.submitted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This attempt has already been submitted.",
        )

    # Auto-grade objective question types.
    _auto_grade_types = {QuestionType.multiple_choice, QuestionType.true_false}
    score: float = 0.0
    for question in attempt.quiz.questions:
        q_id = str(question.id)
        student_answer = (attempt.answers or {}).get(q_id)
        if question.question_type in _auto_grade_types and student_answer == question.correct_answer:
            score += question.points

    attempt.submitted_at = datetime.now(tz=timezone.utc)
    attempt.score = score

    await db.flush()
    await db.refresh(attempt)
    return attempt
