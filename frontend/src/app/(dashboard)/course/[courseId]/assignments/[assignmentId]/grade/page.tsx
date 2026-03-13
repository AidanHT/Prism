"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Star,
  Users,
} from "lucide-react";

import { assignmentApi, courseApi, gradeApi } from "@/lib/api";
import { useApiOpts } from "@/hooks/useApiOpts";
import type { GradebookStudentRow, GradebookGradeEntry } from "@/lib/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Feedback editor ───────────────────────────────────────────────────────────

function FeedbackEditor({ onUpdate }: { onUpdate: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onUpdate(e.getHTML()),
  });

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex items-center gap-0.5 border-b px-2 py-1.5">
        {[
          { label: "B", cmd: () => editor?.chain().focus().toggleBold().run(), active: () => editor?.isActive("bold") },
          { label: "I", cmd: () => editor?.chain().focus().toggleItalic().run(), active: () => editor?.isActive("italic") },
          { label: "•", cmd: () => editor?.chain().focus().toggleBulletList().run(), active: () => editor?.isActive("bulletList") },
        ].map(({ label, cmd, active }) => (
          <button
            key={label}
            type="button"
            onClick={cmd}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              active?.() ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <EditorContent
        editor={editor}
        className="min-h-[120px] px-4 py-3 [&_.ProseMirror]:outline-none prose prose-sm dark:prose-invert max-w-none"
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpeedGraderPage() {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const opts = useApiOpts();
  const qc = useQueryClient();

  const [studentIndex, setStudentIndex] = useState(0);
  const [scoreInput, setScoreInput] = useState("");
  const [feedback, setFeedback] = useState("");

  // ── Data fetching ───────────────────────────────────────────────────────────

  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => assignmentApi.get(assignmentId, opts),
    enabled: !!opts.userId,
    staleTime: 60_000,
  });

  const { data: gradebook, isLoading: gradebookLoading } = useQuery({
    queryKey: ["gradebook", courseId],
    queryFn: () => courseApi.gradebook(courseId, opts),
    enabled: !!opts.userId,
    staleTime: 30_000,
  });

  // ── Derived state ───────────────────────────────────────────────────────────

  // Students who have a grade entry for this specific assignment
  const studentsWithGrades: Array<{
    row: GradebookStudentRow;
    entry: GradebookGradeEntry;
  }> = (gradebook?.students ?? []).flatMap((row) => {
    const entry = row.grades.find((g) => g.assignment_id === assignmentId);
    return entry ? [{ row, entry }] : [];
  });

  const current = studentsWithGrades[studentIndex];
  const total = studentsWithGrades.length;

  // Sync score input when navigating to a different student
  const syncScore = (index: number) => {
    const entry = studentsWithGrades[index]?.entry;
    setScoreInput(entry ? String(entry.score) : "");
    setFeedback("");
  };

  // ── Mutation ────────────────────────────────────────────────────────────────

  const updateGrade = useMutation({
    mutationFn: ({
      gradeId,
      score,
      feedback,
    }: {
      gradeId: string;
      score: number;
      feedback: string;
    }) => gradeApi.update(gradeId, { score, feedback: feedback || undefined }, opts),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["gradebook", courseId] });
      toast.success("Grade saved");
    },
    onError: () => toast.error("Failed to save grade"),
  });

  function handleSave() {
    if (!current) return;
    const score = parseFloat(scoreInput);
    if (isNaN(score) || score < 0) {
      toast.error("Enter a valid score");
      return;
    }
    updateGrade.mutate({ gradeId: current.entry.grade_id, score, feedback });
  }

  function navigate(dir: -1 | 1) {
    const next = studentIndex + dir;
    if (next < 0 || next >= total) return;
    setStudentIndex(next);
    syncScore(next);
  }

  // ── Loading / error states ──────────────────────────────────────────────────

  const isLoading = assignmentLoading || gradebookLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <p className="text-sm text-destructive">
        Could not load assignment. Is the backend running?
      </p>
    );
  }

  const maxScore = current?.entry.max_score ?? assignment.points_possible;

  return (
    <div className="flex flex-col gap-4 max-w-6xl">
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
              <Link href={`/course/${courseId}/assignments`}>Assignments</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/course/${courseId}/assignments/${assignmentId}`}>
                {assignment.title}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>SpeedGrader</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">SpeedGrader</h1>
        <Badge variant="secondary" className="ml-1">
          {assignment.title}
        </Badge>
        <span className="text-sm text-muted-foreground ml-auto flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {total} student{total !== 1 ? "s" : ""} submitted
        </span>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground opacity-30" />
            <p className="font-medium text-sm">No submissions yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Grades will appear here once students have submitted and grade
              records exist in the database.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
          {/* ── Left panel: Assignment context ─────────────────────────── */}
          <Card className="min-h-[480px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Assignment Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Star className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">
                    {assignment.points_possible} pts
                  </span>
                </span>
                {assignment.due_date && (
                  <span className="text-muted-foreground">
                    Due{" "}
                    <span className="font-medium text-foreground">
                      {format(parseISO(assignment.due_date), "MMM d, yyyy")}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {assignment.submission_types.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs capitalize">
                    {t}
                  </Badge>
                ))}
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Description
                </p>
                {assignment.description ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {assignment.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No description provided.
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Current Student Submission
                </p>
                <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground italic">
                  Submission content viewer requires a{" "}
                  <code className="text-xs bg-muted rounded px-1">
                    GET /assignments/{"{id}"}/submissions/{"{student_id}"}
                  </code>{" "}
                  endpoint — planned for Phase 3.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Right panel: Grading ───────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            {/* Student navigator */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigate(-1)}
                    disabled={studentIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <div className="text-center min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {current?.row.student_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {current?.row.student_email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {studentIndex + 1} / {total}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigate(1)}
                    disabled={studentIndex === total - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Student list pills */}
                <div className="flex flex-wrap gap-1">
                  {studentsWithGrades.map(({ row }, i) => (
                    <button
                      key={row.student_id}
                      onClick={() => {
                        setStudentIndex(i);
                        syncScore(i);
                      }}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        i === studentIndex
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                    >
                      {row.student_name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Grade input */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Grade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Score (max {maxScore})
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={maxScore}
                      step={0.5}
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                      }}
                      className="h-9 w-28 text-sm"
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground">
                      / {maxScore}
                    </span>
                    {current && parseFloat(scoreInput) >= 0 && !isNaN(parseFloat(scoreInput)) && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {Math.round((parseFloat(scoreInput) / maxScore) * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Feedback (stored on submission record)
                  </Label>
                  <FeedbackEditor onUpdate={setFeedback} />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={updateGrade.isPending || !current}
                >
                  {updateGrade.isPending ? "Saving…" : "Save Grade"}
                </Button>
              </CardContent>
            </Card>

            {/* Score summary */}
            {current && (
              <Card>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Current recorded score
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">
                      {current.entry.score}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {current.entry.max_score}
                    </span>
                    <span
                      className={cn(
                        "ml-auto text-sm font-medium",
                        current.entry.score / current.entry.max_score < 0.6
                          ? "text-destructive"
                          : current.entry.score / current.entry.max_score >= 0.9
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground",
                      )}
                    >
                      {Math.round(
                        (current.entry.score / current.entry.max_score) * 100,
                      )}
                      %
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
