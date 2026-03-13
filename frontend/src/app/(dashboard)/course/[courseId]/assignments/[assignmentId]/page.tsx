"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Star,
  Upload,
} from "lucide-react";

import { assignmentApi } from "@/lib/api";
import { useApiOpts } from "@/hooks/useApiOpts";
import { useAuthStore } from "@/store/useAuthStore";
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

// ── Read-only TipTap renderer ─────────────────────────────────────────────────

function RichContent({ html }: { html: string }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: html,
    editable: false,
    immediatelyRender: false,
  });

  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm dark:prose-invert max-w-none [&_.ProseMirror]:outline-none"
    />
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssignmentDetailPage() {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const opts = useApiOpts();
  const role = useAuthStore((s) => s.user?.role ?? "Student");
  const isInstructor = role === "Professor" || role === "TA";

  const {
    data: assignment,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => assignmentApi.get(assignmentId, opts),
    enabled: !!opts.userId,
    staleTime: 60_000,
  });

  const { data: mySubmission } = useQuery({
    queryKey: ["my-submission", assignmentId],
    queryFn: () => assignmentApi.mySubmission(assignmentId, opts),
    enabled: !!opts.userId && !isInstructor,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  if (isError || !assignment) {
    return (
      <p className="text-sm text-destructive">
        Could not load assignment. Is the backend running?
      </p>
    );
  }

  const isLocked =
    !!assignment.lock_date && new Date(assignment.lock_date) < new Date();
  const descriptionIsHtml =
    assignment.description?.trimStart().startsWith("<") ?? false;

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
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
            <BreadcrumbPage className="max-w-[200px] truncate">
              {assignment.title}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base leading-snug">
                <ClipboardList className="h-5 w-5 shrink-0 text-muted-foreground" />
                {assignment.title}
              </CardTitle>
              <div className="mt-2 flex flex-wrap gap-1">
                {assignment.submission_types.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs capitalize">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              {isInstructor ? (
                <Button asChild size="sm" variant="outline">
                  <Link
                    href={`/course/${courseId}/assignments/${assignmentId}/grade`}
                  >
                    <Star className="mr-1.5 h-4 w-4" />
                    SpeedGrader
                  </Link>
                </Button>
              ) : mySubmission ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Submitted
                </Badge>
              ) : (
                !isLocked && (
                  <Button asChild size="sm">
                    <Link
                      href={`/course/${courseId}/assignments/${assignmentId}/submit`}
                    >
                      <Upload className="mr-1.5 h-4 w-4" />
                      Submit
                    </Link>
                  </Button>
                )
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Star className="h-4 w-4" />
              <span className="font-medium text-foreground">
                {assignment.points_possible} pts
              </span>
            </span>
            {assignment.due_date && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Due{" "}
                <span className="font-medium text-foreground">
                  {format(
                    parseISO(assignment.due_date),
                    "MMM d, yyyy 'at' h:mm a",
                  )}
                </span>
              </span>
            )}
            {assignment.lock_date && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Locks{" "}
                <span className="font-medium text-foreground">
                  {format(
                    parseISO(assignment.lock_date),
                    "MMM d, yyyy 'at' h:mm a",
                  )}
                </span>
              </span>
            )}
          </div>

          <Separator />

          {/* Description rendered via read-only TipTap */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Instructions
            </p>
            {assignment.description ? (
              descriptionIsHtml ? (
                <RichContent html={assignment.description} />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {assignment.description}
                </p>
              )
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No description provided.
              </p>
            )}
          </div>

          {isLocked && !isInstructor && (
            <>
              <Separator />
              <p className="text-sm text-destructive">
                This assignment is locked and no longer accepts submissions.
              </p>
            </>
          )}

          {/* Student submission summary */}
          {!isInstructor && mySubmission && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Your Submission
                </p>
                <div className="space-y-1 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                  <p className="text-muted-foreground">
                    Submitted{" "}
                    <span className="font-medium text-foreground">
                      {format(
                        parseISO(mySubmission.submitted_at),
                        "MMM d, yyyy 'at' h:mm a",
                      )}
                    </span>
                  </p>
                  {mySubmission.grade !== null && (
                    <p className="text-muted-foreground">
                      Grade:{" "}
                      <span className="font-medium text-foreground">
                        {mySubmission.grade} / {assignment.points_possible}
                      </span>
                    </p>
                  )}
                  {mySubmission.feedback && (
                    <p className="text-muted-foreground">
                      Feedback:{" "}
                      <span className="text-foreground">
                        {mySubmission.feedback}
                      </span>
                    </p>
                  )}
                  {!isLocked && (
                    <div className="pt-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/course/${courseId}/assignments/${assignmentId}/submit`}
                        >
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          Resubmit
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
