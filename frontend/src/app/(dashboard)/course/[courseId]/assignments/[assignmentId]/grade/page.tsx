"use client";

import { useEffect, useState } from "react";
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
  ExternalLink,
  FileText,
  Star,
  Users,
} from "lucide-react";

import { assignmentApi, courseApi, gradeApi } from "@/lib/api";
import { useApiOpts } from "@/hooks/useApiOpts";
import { useGradingStore } from "@/store/useGradingStore";
import type { GradebookStudentRow, GradebookGradeEntry, SubmissionResponse } from "@/lib/types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Feedback TipTap editor ────────────────────────────────────────────────────

function FeedbackEditor({
  initial,
  onUpdate,
}: {
  initial?: string;
  onUpdate: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: initial ?? "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onUpdate(e.getHTML()),
  });

  // Reset content when switching students
  useEffect(() => {
    if (editor && editor.getHTML() !== (initial ?? "")) {
      editor.commands.setContent(initial ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex items-center gap-0.5 border-b px-2 py-1.5">
        {[
          {
            label: "B",
            cmd: () => editor?.chain().focus().toggleBold().run(),
            active: () => editor?.isActive("bold") ?? false,
          },
          {
            label: "I",
            cmd: () => editor?.chain().focus().toggleItalic().run(),
            active: () => editor?.isActive("italic") ?? false,
          },
          {
            label: "•",
            cmd: () => editor?.chain().focus().toggleBulletList().run(),
            active: () => editor?.isActive("bulletList") ?? false,
          },
        ].map(({ label, cmd, active }) => (
          <button
            key={label}
            type="button"
            onClick={cmd}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              active() ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
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

// ── Submission viewer ─────────────────────────────────────────────────────────

function SubmissionViewer({ submission }: { submission: SubmissionResponse | undefined }) {
  if (!submission) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <FileText className="h-10 w-10 opacity-20" />
        <p className="text-sm">No submission on record for this student.</p>
      </div>
    );
  }

  const fileUrl = submission.file_url;
  const isPdf = fileUrl?.toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-3">
      {/* Submitted at */}
      <p className="text-xs text-muted-foreground">
        Submitted{" "}
        <span className="font-medium text-foreground">
          {format(parseISO(submission.submitted_at), "MMM d, yyyy 'at' h:mm a")}
        </span>
      </p>

      {/* Text / rich-text body */}
      {submission.body && (
        <div className="rounded-lg border bg-muted/20 px-4 py-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Written Response
          </p>
          {submission.body.trimStart().startsWith("<") ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: submission.body }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono">
              {submission.body}
            </pre>
          )}
        </div>
      )}

      {/* File */}
      {fileUrl && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Attached File
          </p>
          {isPdf ? (
            /* PDF: render inline via iframe */
            <div className="overflow-hidden rounded-lg border bg-muted/20">
              <iframe
                src={fileUrl}
                className="h-[480px] w-full"
                title="Submission PDF"
              />
            </div>
          ) : (
            /* Non-PDF: show download link + try to render as plain text */
            <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {fileUrl.split("/").pop() ?? "View file"}
              </a>
            </div>
          )}
        </div>
      )}
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

  // Zustand-backed student index — persists when navigating away and back
  const studentIndex = useGradingStore((s) => s.getIndex(assignmentId));
  const setStudentIndex = useGradingStore((s) => s.setIndex);

  // Per-student form state — reset whenever studentIndex changes
  const [scoreInput, setScoreInput] = useState("");
  const [feedback, setFeedback] = useState("");

  // ── Data ──────────────────────────────────────────────────────────────────

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

  const { data: allSubmissions = [] } = useQuery({
    queryKey: ["submissions", assignmentId],
    queryFn: () => assignmentApi.submissions(assignmentId, opts),
    enabled: !!opts.userId,
    staleTime: 30_000,
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const studentsWithGrades: Array<{
    row: GradebookStudentRow;
    entry: GradebookGradeEntry;
  }> = (gradebook?.students ?? []).flatMap((row) => {
    const entry = row.grades.find((g) => g.assignment_id === assignmentId);
    return entry ? [{ row, entry }] : [];
  });

  const total = studentsWithGrades.length;
  const current = studentsWithGrades[studentIndex];

  // Find the actual submission content for the current student
  const currentSubmission = (allSubmissions as SubmissionResponse[]).find(
    (s) => s.student_id === current?.row.student_id,
  );

  // ── Score / feedback sync on navigation ───────────────────────────────────

  // Sync score whenever the selected student changes
  useEffect(() => {
    const entry = studentsWithGrades[studentIndex]?.entry;
    setScoreInput(entry?.score !== undefined ? String(entry.score) : "");
    setFeedback("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentIndex]);

  function syncFormToStudent(index: number) {
    const entry = studentsWithGrades[index]?.entry;
    setScoreInput(entry?.score !== undefined ? String(entry.score) : "");
    setFeedback("");
  }

  function navigate(dir: -1 | 1) {
    const next = studentIndex + dir;
    if (next < 0 || next >= total) return;
    setStudentIndex(assignmentId, next);
    syncFormToStudent(next);
  }

  // ── Save grade mutation ───────────────────────────────────────────────────

  const updateGrade = useMutation({
    mutationFn: ({
      gradeId,
      score,
      feedbackHtml,
    }: {
      gradeId: string;
      score: number;
      feedbackHtml: string;
    }) =>
      gradeApi.update(
        gradeId,
        { score, feedback: feedbackHtml || undefined },
        opts,
      ),
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
    updateGrade.mutate({
      gradeId: current.entry.grade_id,
      score,
      feedbackHtml: feedback,
    });
  }

  // ── Loading / error ───────────────────────────────────────────────────────

  if (assignmentLoading || gradebookLoading) {
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
        <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          {total} student{total !== 1 ? "s" : ""} with grade entries
        </span>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground opacity-30" />
            <p className="text-sm font-medium">No submissions yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Grade records will appear here once students submit and a grade
              entry exists in the database.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
          {/* ── Left: Submission viewer ─────────────────────────────────── */}
          <Card className="min-h-[520px]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Submission — {current?.row.student_name}
                </CardTitle>
                {currentSubmission?.file_url && (
                  <a
                    href={currentSubmission.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in new tab
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <SubmissionViewer submission={currentSubmission} />

              <Separator className="my-4" />

              {/* Assignment description as reference */}
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assignment Prompt
                </p>
                {assignment.description ? (
                  assignment.description.trimStart().startsWith("<") ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: assignment.description }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {assignment.description}
                    </p>
                  )
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    No description.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Right: Grading panel ────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            {/* Student navigator */}
            <Card>
              <CardContent className="pb-3 pt-4">
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

                  <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-sm font-semibold">
                      {current?.row.student_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {current?.row.student_email}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
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

                {/* Student pill list */}
                <div className="flex flex-wrap gap-1">
                  {studentsWithGrades.map(({ row }, i) => (
                    <button
                      key={row.student_id}
                      onClick={() => {
                        setStudentIndex(assignmentId, i);
                        syncFormToStudent(i);
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

            {/* Score input */}
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
                    {scoreInput !== "" &&
                      !isNaN(parseFloat(scoreInput)) && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {Math.round(
                            (parseFloat(scoreInput) / maxScore) * 100,
                          )}
                          %
                        </span>
                      )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Feedback
                  </Label>
                  <FeedbackEditor
                    key={`feedback-${studentIndex}`}
                    onUpdate={setFeedback}
                  />
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

            {/* Recorded score summary */}
            {current && (
              <Card>
                <CardContent className="px-4 py-3">
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    Recorded score
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
                          : current.entry.score /
                                current.entry.max_score >=
                              0.9
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

