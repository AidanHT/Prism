"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  PlayCircle,
  Star,
} from "lucide-react";

import { quizApi } from "@/lib/api";
import type { QuizAttemptResponse, QuizQuestionResponse } from "@/lib/types";
import { useApiOpts } from "@/hooks/useApiOpts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ── Timer display ─────────────────────────────────────────────────────────────

function TimerDisplay({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const isLow = seconds <= 120;
  return (
    <span
      className={cn(
        "font-mono text-sm font-semibold tabular-nums",
        isLow ? "text-destructive animate-pulse" : "text-foreground",
      )}
    >
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ── Single question ───────────────────────────────────────────────────────────

function QuizQuestion({
  question,
  value,
  onChange,
  index,
}: {
  question: QuizQuestionResponse;
  value: string;
  onChange: (v: string) => void;
  index: number;
}) {
  const { question_type, question_text, points, options } = question;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{question_text}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{points} pt{points !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="pl-8 space-y-2">
        {(question_type === "multiple_choice" || question_type === "true_false") && (
          <>
            {question_type === "true_false"
              ? ["True", "False"].map((opt) => (
                  <label
                    key={opt}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors text-sm",
                      value === opt
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={opt}
                      checked={value === opt}
                      onChange={() => onChange(opt)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 rounded-full border-2 items-center justify-center",
                        value === opt ? "border-primary" : "border-muted-foreground/40",
                      )}
                    >
                      {value === opt && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </span>
                    {opt}
                  </label>
                ))
              : (options?.choices ?? []).map((choice) => (
                  <label
                    key={choice}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors text-sm",
                      value === choice
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={choice}
                      checked={value === choice}
                      onChange={() => onChange(choice)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 rounded-full border-2 items-center justify-center",
                        value === choice ? "border-primary" : "border-muted-foreground/40",
                      )}
                    >
                      {value === choice && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </span>
                    {choice}
                  </label>
                ))}
          </>
        )}

        {(question_type === "short_answer" || question_type === "essay") && (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              question_type === "essay"
                ? "Write your response here…"
                : "Enter your answer…"
            }
            rows={question_type === "essay" ? 6 : 2}
            className="text-sm resize-none"
          />
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Phase = "idle" | "taking" | "submitted";

export default function QuizTakerPage() {
  const { courseId, quizId } = useParams<{
    courseId: string;
    quizId: string;
  }>();
  const opts = useApiOpts();

  const [phase, setPhase] = useState<Phase>("idle");
  const [attempt, setAttempt] = useState<QuizAttemptResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Quiz data ───────────────────────────────────────────────────────────────

  const { data: quiz, isLoading, isError } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => quizApi.get(quizId, opts),
    enabled: !!opts.userId,
    staleTime: 60_000,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────

  const startMutation = useMutation({
    mutationFn: () => quizApi.startAttempt(quizId, opts),
    onSuccess: (data) => {
      setAttempt(data);
      setAnswers(data.answers ?? {});
      if (quiz?.time_limit_minutes) {
        setSecondsLeft(quiz.time_limit_minutes * 60);
      }
      setPhase("taking");
    },
    onError: () => toast.error("Could not start quiz. Try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { answers: Record<string, string> }) =>
      quizApi.updateAttempt(quizId, attempt!.id, payload, opts),
    onError: () => {
      // Silent — auto-save failure is non-fatal; will retry on next keystroke.
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => quizApi.submitAttempt(quizId, attempt!.id, opts),
    onSuccess: (data) => {
      setAttempt(data);
      setPhase("submitted");
      if (timerInterval.current) clearInterval(timerInterval.current);
      toast.success("Quiz submitted!", { description: "Your answers have been recorded." });
    },
    onError: () => toast.error("Submission failed. Try again."),
  });

  // ── Auto-save (debounced 1.5 s) ─────────────────────────────────────────────

  const scheduleAutoSave = useCallback(
    (newAnswers: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!attempt) return;
      saveTimer.current = setTimeout(() => {
        updateMutation.mutate({ answers: newAnswers });
      }, 1500);
    },
    [attempt, updateMutation],
  );

  function updateAnswer(questionId: string, value: string) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    scheduleAutoSave(next);
  }

  // ── Timer countdown ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "taking" || !quiz?.time_limit_minutes) return;

    timerInterval.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerInterval.current!);
          // Auto-submit
          if (!submitMutation.isPending) submitMutation.mutate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (isError || !quiz) {
    return (
      <p className="text-sm text-destructive">
        Could not load quiz. Is the backend running?
      </p>
    );
  }

  const answeredCount = quiz.questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const totalQuestions = quiz.questions.length;

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/course/${courseId}`}>Course</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/course/${courseId}/quizzes`}>Quizzes</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[200px] truncate">{quiz.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* ── PHASE: idle ── */}
      {phase === "idle" && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HelpCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  {quiz.title}
                </CardTitle>
                <Badge variant={quiz.is_published ? "secondary" : "outline"}>
                  {quiz.is_published ? "Published" : "Unpublished"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Star className="h-4 w-4" />
                  <span className="font-medium text-foreground">
                    {quiz.points_possible} pts
                  </span>
                </span>
                {quiz.time_limit_minutes && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium text-foreground">
                      {quiz.time_limit_minutes} min
                    </span>
                  </span>
                )}
                {quiz.attempt_limit && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <HelpCircle className="h-4 w-4" />
                    <span className="font-medium text-foreground">
                      {quiz.attempt_limit} attempt{quiz.attempt_limit !== 1 ? "s" : ""}
                    </span>
                  </span>
                )}
                {quiz.available_from && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Available{" "}
                    <span className="font-medium text-foreground">
                      {format(parseISO(quiz.available_from), "MMM d")}
                      {quiz.available_until
                        ? ` – ${format(parseISO(quiz.available_until), "MMM d")}`
                        : ""}
                    </span>
                  </span>
                )}
              </div>

              <Separator />

              {quiz.description ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {quiz.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No description provided.
                </p>
              )}

              <Separator />

              <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-1">
                <p className="font-medium">Before you begin</p>
                <ul className="text-muted-foreground text-xs space-y-0.5 list-disc list-inside">
                  <li>{totalQuestions} question{totalQuestions !== 1 ? "s" : ""}</li>
                  {quiz.time_limit_minutes && (
                    <li>
                      Time limit: {quiz.time_limit_minutes} minutes — quiz
                      auto-submits when time runs out
                    </li>
                  )}
                  {quiz.attempt_limit && (
                    <li>
                      Limited to {quiz.attempt_limit} attempt
                      {quiz.attempt_limit !== 1 ? "s" : ""}
                    </li>
                  )}
                  <li>Your answers are auto-saved as you type</li>
                </ul>
              </div>

              <Button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="w-full sm:w-auto"
              >
                <PlayCircle className="mr-1.5 h-4 w-4" />
                {startMutation.isPending ? "Starting…" : "Take Quiz"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── PHASE: taking ── */}
      {phase === "taking" && (
        <>
          {/* Sticky header bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-xl border bg-background/95 backdrop-blur px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="font-semibold text-sm truncate">{quiz.title}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {quiz.time_limit_minutes && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <TimerDisplay seconds={secondsLeft} />
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                {answeredCount}/{totalQuestions}
              </span>
              {updateMutation.isPending && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Saving…
                </span>
              )}
            </div>
          </div>

          {/* Questions */}
          <div className="flex flex-col gap-4">
            {quiz.questions.map((q, i) => (
              <Card key={q.id}>
                <CardContent className="pt-5 pb-5">
                  <QuizQuestion
                    question={q}
                    value={answers[q.id] ?? ""}
                    onChange={(v) => updateAnswer(q.id, v)}
                    index={i}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Submit bar */}
          <Card>
            <CardContent className="py-4 flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {answeredCount < totalQuestions ? (
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {totalQuestions - answeredCount} question
                    {totalQuestions - answeredCount !== 1 ? "s" : ""} unanswered
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    All questions answered
                  </span>
                )}
              </div>
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "Submitting…" : "Submit Quiz"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── PHASE: submitted ── */}
      {phase === "submitted" && attempt && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <div>
              <p className="text-lg font-semibold">{quiz.title}</p>
              <p className="text-muted-foreground text-sm mt-1">
                Submitted{" "}
                {attempt.submitted_at
                  ? format(parseISO(attempt.submitted_at), "MMM d, yyyy 'at' h:mm a")
                  : "just now"}
              </p>
            </div>

            {attempt.score !== null ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Your Score
                </p>
                <p className="text-4xl font-bold">
                  {attempt.score}
                  <span className="text-xl font-normal text-muted-foreground">
                    /{quiz.points_possible}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {Math.round((attempt.score / quiz.points_possible) * 100)}%
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 px-6 py-3 text-sm text-muted-foreground">
                Score will appear once your instructor reviews essay questions.
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button asChild variant="outline">
                <Link href={`/course/${courseId}/quizzes`}>Back to Quizzes</Link>
              </Button>
              <Button asChild>
                <Link href={`/course/${courseId}/quizzes/${quizId}/results`}>
                  View Results
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
