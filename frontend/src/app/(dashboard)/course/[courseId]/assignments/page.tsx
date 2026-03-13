"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  formatDistanceToNow,
  isPast,
  parseISO,
  isValid,
} from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ClipboardList,
  Plus,
} from "lucide-react";

import { courseApi, assignmentApi } from "@/lib/api";
import { useApiOpts } from "@/hooks/useApiOpts";
import { useAuthStore } from "@/store/useAuthStore";
import type { AssignmentResponse, SubmissionResponse } from "@/lib/types";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeDate(iso: string | null): string {
  if (!iso) return "No due date";
  const d = parseISO(iso);
  if (!isValid(d)) return "Invalid date";
  return isPast(d)
    ? `Due ${formatDistanceToNow(d, { addSuffix: true })}`
    : `Due in ${formatDistanceToNow(d)}`;
}

// ── Assignment row ────────────────────────────────────────────────────────────

function AssignmentRow({
  assignment,
  courseId,
  submitted,
}: {
  assignment: AssignmentResponse;
  courseId: string;
  submitted: boolean;
}) {
  const isPastDue = assignment.due_date
    ? isPast(parseISO(assignment.due_date))
    : false;

  return (
    <Link
      href={`/course/${courseId}/assignments/${assignment.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{assignment.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-1 text-xs ${
              submitted
                ? "text-emerald-600 dark:text-emerald-400"
                : isPastDue
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {submitted ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : isPastDue ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {submitted ? "Submitted" : relativeDate(assignment.due_date)}
          </span>
          {assignment.submission_types.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] capitalize">
              {t}
            </Badge>
          ))}
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium text-muted-foreground">
        {assignment.points_possible} pts
      </span>
    </Link>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
      <ClipboardList className="h-10 w-10 opacity-20" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const opts = useApiOpts();
  const role = useAuthStore((s) => s.user?.role ?? "Student");
  const isInstructor = role === "Professor" || role === "TA";

  const { data: assignments = [], isLoading: aLoading } = useQuery({
    queryKey: ["assignments", courseId],
    queryFn: () => courseApi.assignments(courseId, opts),
    enabled: !!opts.userId,
    staleTime: 60_000,
  });

  const { data: mySubmissions = [], isLoading: sLoading } = useQuery({
    queryKey: ["my-submissions", courseId],
    queryFn: () => assignmentApi.myCourseSubmissions(courseId, opts),
    enabled: !!opts.userId && !isInstructor,
    staleTime: 30_000,
  });

  const submittedIds = useMemo<Set<string>>(
    () =>
      new Set(
        (mySubmissions as SubmissionResponse[])
          .map((s) => s.assignment_id)
          .filter(Boolean),
      ),
    [mySubmissions],
  );

  const grouped = useMemo(() => {
    const upcoming: AssignmentResponse[] = [];
    const pastDue: AssignmentResponse[] = [];
    const submitted: AssignmentResponse[] = [];

    for (const a of assignments) {
      if (submittedIds.has(a.id)) {
        submitted.push(a);
      } else if (a.due_date && isPast(parseISO(a.due_date))) {
        pastDue.push(a);
      } else {
        upcoming.push(a);
      }
    }
    return { upcoming, pastDue, submitted };
  }, [assignments, submittedIds]);

  const isLoading = aLoading || sLoading;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/course/${courseId}`}>Course</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Assignments</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {isInstructor && (
          <Button render={<Link href={`/course/${courseId}/assignments/new`} />} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New Assignment
          </Button>
        )}
      </div>

      {/* Content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <Empty label="No assignments have been published yet." />
          ) : isInstructor ? (
            /* Professors see a flat list */
            <div className="flex flex-col gap-2">
              {assignments.map((a) => (
                <AssignmentRow
                  key={a.id}
                  assignment={a}
                  courseId={courseId}
                  submitted={false}
                />
              ))}
            </div>
          ) : (
            /* Students see grouped tabs */
            <Tabs defaultValue="upcoming">
              <TabsList className="mb-4">
                <TabsTrigger value="upcoming">
                  Upcoming
                  {grouped.upcoming.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      {grouped.upcoming.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="past">
                  Past Due
                  {grouped.pastDue.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-1.5 text-[10px]"
                    >
                      {grouped.pastDue.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="submitted">
                  Submitted
                  {grouped.submitted.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      {grouped.submitted.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="flex flex-col gap-2">
                {grouped.upcoming.length === 0 ? (
                  <Empty label="No upcoming assignments." />
                ) : (
                  grouped.upcoming.map((a) => (
                    <AssignmentRow
                      key={a.id}
                      assignment={a}
                      courseId={courseId}
                      submitted={false}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="past" className="flex flex-col gap-2">
                {grouped.pastDue.length === 0 ? (
                  <Empty label="No past-due assignments." />
                ) : (
                  grouped.pastDue.map((a) => (
                    <AssignmentRow
                      key={a.id}
                      assignment={a}
                      courseId={courseId}
                      submitted={false}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="submitted" className="flex flex-col gap-2">
                {grouped.submitted.length === 0 ? (
                  <Empty label="No submitted assignments yet." />
                ) : (
                  grouped.submitted.map((a) => (
                    <AssignmentRow
                      key={a.id}
                      assignment={a}
                      courseId={courseId}
                      submitted={true}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
