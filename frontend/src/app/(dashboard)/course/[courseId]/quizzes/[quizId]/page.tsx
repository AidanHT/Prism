"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  HelpCircle,
  PlayCircle,
  Star,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { quizApi } from "@/lib/api";
import type { QuizQuestionResponse } from "@/lib/types";
import { useApiOpts } from "@/hooks/useApiOpts";
import {
  deriveSecondsLeft,
  useQuizStore,
} from "@/store/useQuizStore";
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

// ── Sortable definition item (used in matching questions) ─────────────────────

function SortableDefinition({
  id,
  text,
  index,
}: {
  id: string;
  text: string;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2.5 bg-background text-sm select-none",
        isDragging ? "shadow-lg opacity-80 z-50" : "hover:bg-muted/40",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
        {index + 1}
      </span>
      <span className="flex-1 leading-snug">{text}</span>
    </div>
  );
}

// ── Matching question ─────────────────────────────────────────────────────────

/**
 * Matching question: left column shows terms, right column holds sortable
 * definitions.  The answer string is the resulting definition order encoded
 * as comma-separated original indices, e.g. "2,0,1".
 */
function MatchingQuestion({
  question,
  value,
  onChange,
}: {
  question: QuizQuestionResponse;
  value: string;
  onChange: (v: string) => void;
}) {
  const pairs = question.options?.pairs ?? [];

  // Parse current order from the stored answer string, or use the shuffled
  // default which is seeded once and stable for this component instance.
  const [defOrder, setDefOrder] = useState<number[]>(() => {
    if (value) {
      const parsed = value.split(",").map(Number);
      if (parsed.length === pairs.length && parsed.every((n) => !isNaN(n))) {
        return parsed;
      }
    }
    // Shuffle definitions deterministically (Fisher-Yates with fixed seed
    // based on quiz question id so it's stable across re-renders).
    const arr = pairs.map((_, i) => i);
    let seed = question.id.charCodeAt(0) + question.id.charCodeAt(1);
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = defOrder.findIndex((_, i) => String(i) === active.id);
    const newIndex = defOrder.findIndex((_, i) => String(i) === over.id);
    const next = arrayMove(defOrder, oldIndex, newIndex);
    setDefOrder(next);
    onChange(next.join(","));
  }

  if (pairs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No matching pairs configured.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Terms column (fixed) */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-1">
          Terms
        </p>
        {pairs.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm font-medium h-[42px]"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
              {i + 1}
            </span>
            {p.term}
          </div>
        ))}
      </div>

      {/* Definitions column (sortable) */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-1">
          Definitions — drag to match
        </p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={defOrder.map((_, i) => String(i))}
            strategy={verticalListSortingStrategy}
          >
            {defOrder.map((originalIdx, displayIdx) => (
              <SortableDefinition
                key={originalIdx}
                id={String(displayIdx)}
                text={pairs[originalIdx]?.definition ?? ""}
                index={displayIdx}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

// ── Single question renderer ──────────────────────────────────────────────────

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
          <p className="text-xs text-muted-foreground mt-0.5">
            {points} pt{points !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="pl-8 space-y-2">
        {/* Multiple choice / True-False */}
        {(question_type === "multiple_choice" ||
          question_type === "true_false") && (
          <>
            {(question_type === "true_false"
              ? ["True", "False"]
              : (options?.choices ?? [])
            ).map((opt) => (
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
                    value === opt
                      ? "border-primary"
                      : "border-muted-foreground/40",
                  )}
                >
                  {value === opt && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </span>
                {opt}
              </label>
            ))}
          </>
        )}

        {/* Short answer / Essay */}
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

        {/* Matching */}
        {question_type === "matching" && (
          <MatchingQuestion
            question={question}
            value={value}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  );
}

// ── Question nav sidebar ──────────────────────────────────────────────────────

function QuestionNav({
  questions,
  answers,
  activeIndex,
  onSelect,
}: {
  questions: QuizQuestionResponse[];
  answers: Record<string, string>;
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <nav
      aria-label="Question navigation"
      className="flex flex-col gap-1 w-full"
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1 px-1">
        Questions
      </p>
      {questions.map((q, i) => {
        const answered = (answers[q.id] ?? "").trim().length > 0;
        const isActive = i === activeIndex;
        return (
          <button
            key={q.id}
            onClick={() => onSelect(i)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors text-left w-full",
              isActive
                ? "bg-primary text-primary-foreground font-medium"
                : answered
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                  : "hover:bg-muted text-muted-foreground",
            )}
          >
            <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold border-current opacity-70">
              {i + 1}
            </span>
            <span className="truncate flex-1">
              {q.question_text.length > 30
                ? q.question_text.slice(0, 30) + "…"
                : q.question_text}
            </span>
            {answered && !isActive && (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            )}
          </button>
        );
      })}
    </nav>
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
  const router = useRouter();

  const { sessions, setSession, updateAnswers, markSubmitted } =
    useQuizStore();
  const storedSession = sessions[quizId];

  // Derive initial phase from persisted store
  const [phase, setPhase] = useState<Phase>(() => {
    if (!storedSession) return "idle";
    return storedSession.phase === "submitted" ? "submitted" : "taking";
  });

  const [answers, setAnswers] = useState<Record<string, string>>(
    storedSession?.answers ?? {},
  );
  const [activeIndex, setActiveIndex] = useState(0);

  // Timer — driven by server start time
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (storedSession?.phase === "taking") {
      return deriveSecondsLeft(
        storedSession.serverStartedAt,
        storedSession.timeLimitSeconds,
      );
    }
    return 0;
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Quiz data ───────────────────────────────────────────────────────────────

  const {
    data: quiz,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => quizApi.get(quizId, opts),
    enabled: !!opts.userId,
    staleTime: 60_000,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────

  const startMutation = useMutation({
    mutationFn: () => quizApi.startAttempt(quizId, opts),
    onSuccess: (attempt) => {
      const timeLimitSeconds = (quiz?.time_limit_minutes ?? 0) * 60;
      const session = {
        quizId,
        attemptId: attempt.id,
        serverStartedAt: attempt.started_at,
        timeLimitSeconds,
        answers: attempt.answers ?? {},
        phase: "taking" as const,
        finalScore: null,
      };
      setSession(quizId, session);
      setAnswers(attempt.answers ?? {});
      if (timeLimitSeconds > 0) {
        setSecondsLeft(
          deriveSecondsLeft(attempt.started_at, timeLimitSeconds),
        );
      }
      setPhase("taking");
    },
    onError: () => toast.error("Could not start quiz. Try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { answers: Record<string, string> }) =>
      quizApi.updateAttempt(quizId, storedSession!.attemptId, payload, opts),
    // Silent on failure — will retry on next keystroke.
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      quizApi.submitAttempt(quizId, storedSession!.attemptId, opts),
    onSuccess: (data) => {
      markSubmitted(quizId, data.score);
      setPhase("submitted");
      if (timerInterval.current) clearInterval(timerInterval.current);
      toast.success("Quiz submitted!", {
        description: "Your answers have been recorded.",
      });
      // Redirect to results after a moment
      setTimeout(() => {
        router.push(`/course/${courseId}/quizzes/${quizId}/results`);
      }, 3500);
    },
    onError: () => toast.error("Submission failed. Try again."),
  });

  // ── Auto-save (debounced 1 s) ───────────────────────────────────────────────

  const scheduleAutoSave = useCallback(
    (newAnswers: Record<string, string>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (!storedSession?.attemptId) return;
      saveTimer.current = setTimeout(() => {
        updateMutation.mutate({ answers: newAnswers });
      }, 1000);
    },
    [storedSession?.attemptId, updateMutation],
  );

  function updateAnswer(questionId: string, value: string) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    updateAnswers(quizId, next);
    scheduleAutoSave(next);
  }

  // ── Server-time-driven countdown ────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "taking" || !storedSession?.timeLimitSeconds) return;

    timerInterval.current = setInterval(() => {
      const remaining = deriveSecondsLeft(
        storedSession.serverStartedAt,
        storedSession.timeLimitSeconds,
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerInterval.current!);
        if (!submitMutation.isPending) submitMutation.mutate();
      }
    }, 1000);

    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, storedSession?.quizId]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────────

  const questions = useMemo(
    () => quiz?.questions.slice().sort((a, b) => a.position - b.position) ?? [],
    [quiz],
  );
  const answeredCount = questions.filter(
    (q) => (answers[q.id] ?? "").trim().length > 0,
  ).length;
  const totalQuestions = questions.length;

  function navigatePrev() {
    setActiveIndex((i) => Math.max(0, i - 1));
  }
  function navigateNext() {
    setActiveIndex((i) => Math.min(totalQuestions - 1, i + 1));
  }

  // ── Render guards ────────────────────────────────────────────────────────────

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

  const finalScore =
    storedSession?.finalScore ??
    (phase === "submitted" ? null : null);

  // ── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
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
            <BreadcrumbPage className="max-w-[200px] truncate">
              {quiz.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* ── PHASE: idle ── */}
      {phase === "idle" && (
        <Card className="max-w-2xl">
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
                    {quiz.attempt_limit} attempt
                    {quiz.attempt_limit !== 1 ? "s" : ""}
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
                <li>
                  {totalQuestions} question
                  {totalQuestions !== 1 ? "s" : ""}
                </li>
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
      )}

      {/* ── PHASE: taking ── */}
      {phase === "taking" && (
        <div className="flex gap-4 items-start">
          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col w-52 shrink-0 sticky top-4 self-start">
            <Card>
              <CardContent className="pt-4 pb-3 px-3">
                <QuestionNav
                  questions={questions}
                  answers={answers}
                  activeIndex={activeIndex}
                  onSelect={setActiveIndex}
                />
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground text-center">
                  {answeredCount}/{totalQuestions} answered
                </p>
              </CardContent>
            </Card>
          </aside>

          {/* Main area */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
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

            {/* Active question */}
            {questions[activeIndex] && (
              <Card>
                <CardContent className="pt-5 pb-5">
                  <QuizQuestion
                    question={questions[activeIndex]}
                    value={answers[questions[activeIndex].id] ?? ""}
                    onChange={(v) => updateAnswer(questions[activeIndex].id, v)}
                    index={activeIndex}
                  />
                </CardContent>
              </Card>
            )}

            {/* Navigation + submit bar */}
            <Card>
              <CardContent className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={navigatePrev}
                    disabled={activeIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={navigateNext}
                    disabled={activeIndex === totalQuestions - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  {answeredCount < totalQuestions && (
                    <span className="hidden sm:flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {totalQuestions - answeredCount} unanswered
                    </span>
                  )}
                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                    size="sm"
                  >
                    {submitMutation.isPending ? "Submitting…" : "Submit Quiz"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── PHASE: submitted ── */}
      {phase === "submitted" && (
        <Card className="max-w-lg mx-auto">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <div>
              <p className="text-lg font-semibold">{quiz.title}</p>
              <p className="text-muted-foreground text-sm mt-1">
                Your quiz has been submitted
              </p>
            </div>

            {finalScore !== null ? (
              <div className="flex flex-col items-center gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Your Score
                </p>
                <p className="text-4xl font-bold">
                  {finalScore}
                  <span className="text-xl font-normal text-muted-foreground">
                    /{quiz.points_possible}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {Math.round((finalScore / quiz.points_possible) * 100)}%
                </p>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/30 px-6 py-3 text-sm text-muted-foreground">
                Score will appear once your instructor reviews open-ended
                questions.
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button asChild variant="outline">
                <Link href={`/course/${courseId}/quizzes`}>
                  Back to Quizzes
                </Link>
              </Button>
              <Button asChild>
                <Link
                  href={`/course/${courseId}/quizzes/${quizId}/results`}
                >
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
