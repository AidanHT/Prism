"use client";

import { useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatDistanceToNow, differenceInDays, parseISO } from "date-fns";
import Link from "next/link";
import { Clock, BookOpen, Megaphone, CheckSquare } from "lucide-react";

import { courseApi } from "@/lib/api";
import type { AssignmentResponse, AnnouncementResponse } from "@/lib/types";
import { useApiOpts } from "@/hooks/useApiOpts";
import { useAuthStore } from "@/store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const NOW = new Date("2026-03-13T12:00:00");

const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981",
  "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
];
function courseColor(courseId: string): string {
  let h = 0;
  for (let i = 0; i < courseId.length; i++)
    h = (h * 31 + courseId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function dueBadge(due: string): "destructive" | "secondary" | "outline" {
  const d = differenceInDays(parseISO(due), NOW);
  if (d <= 2) return "destructive";
  if (d <= 5) return "secondary";
  return "outline";
}
function dueLabel(due: string): string {
  const d = differenceInDays(parseISO(due), NOW);
  if (d < 0) return "Overdue";
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d}d`;
}

const container = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export default function DashboardPage() {
  const opts = useApiOpts();
  const user = useAuthStore((s) => s.user);

  const [coursesQuery] = useQueries({
    queries: [
      {
        queryKey: ["courses", opts.userId],
        queryFn: () => courseApi.list(opts),
        enabled: !!opts.userId,
        staleTime: 60_000,
      },
    ],
  });

  const courses = coursesQuery.data ?? [];

  const assignmentQueries = useQueries({
    queries: courses.map((c) => ({
      queryKey: ["assignments", c.id],
      queryFn: () => courseApi.assignments(c.id, opts),
      staleTime: 60_000,
    })),
  });

  const announcementQueries = useQueries({
    queries: courses.map((c) => ({
      queryKey: ["announcements", c.id],
      queryFn: () => courseApi.announcements(c.id, opts),
      staleTime: 60_000,
    })),
  });

  type RichAssignment = AssignmentResponse & {
    courseId: string;
    courseCode: string;
    color: string;
  };

  const upcoming: RichAssignment[] = assignmentQueries
    .flatMap((q, i) =>
      (q.data ?? []).map((a) => ({
        ...a,
        courseId: courses[i]?.id ?? "",
        courseCode: courses[i]?.code ?? "",
        color: courseColor(courses[i]?.id ?? ""),
      })),
    )
    .filter((a) => a.due_date != null && differenceInDays(parseISO(a.due_date), NOW) >= 0)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 5);

  type RichAnnouncement = AnnouncementResponse & {
    courseCode: string;
    color: string;
  };

  const announcements: RichAnnouncement[] = announcementQueries
    .flatMap((q, i) =>
      (q.data ?? []).map((ann) => ({
        ...ann,
        courseCode: courses[i]?.code ?? "",
        color: courseColor(courses[i]?.id ?? ""),
      })),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);

  const loading = coursesQuery.isLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user?.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Spring 2026 — here&apos;s your overview.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* ── Left column ─────────────────────────────────────── */}
        <div className="space-y-6">
          {/* My Courses */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> My Courses
            </h2>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((n) => (
                  <Skeleton key={n} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No courses found. Ensure the backend is running and your User ID
                matches a seeded user UUID.
              </p>
            ) : (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                variants={container}
                initial="hidden"
                animate="visible"
              >
                {courses.map((course) => {
                  const color = courseColor(course.id);
                  return (
                    <motion.div key={course.id} variants={fadeUp}>
                      <Link href={`/course/${course.id}`}>
                        <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
                          <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
                          <CardHeader className="pb-2 pt-3">
                            <div className="flex items-start justify-between gap-2">
                              <Badge
                                variant="secondary"
                                className="text-xs font-mono shrink-0"
                                style={{ borderColor: color, color }}
                              >
                                {course.code}
                              </Badge>
                              <span className="text-muted-foreground text-xs">{course.term}</span>
                            </div>
                            <CardTitle className="text-sm leading-snug mt-2 group-hover:text-primary transition-colors">
                              {course.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pb-3">
                            <p className="text-muted-foreground text-xs line-clamp-2">
                              {course.description ?? "—"}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </section>

          {/* Recent Announcements */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Megaphone className="h-3.5 w-3.5" /> Recent Announcements
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((n) => (
                  <Skeleton key={n} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent announcements.</p>
            ) : (
              <motion.div
                className="space-y-3"
                variants={container}
                initial="hidden"
                animate="visible"
              >
                {announcements.map((ann) => (
                  <motion.div key={ann.id} variants={fadeUp}>
                    <Card>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-1 h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: ann.color }}
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-mono text-muted-foreground">
                              {ann.courseCode}
                            </span>
                            <p className="text-sm font-medium leading-snug mt-0.5">{ann.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ann.body}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(parseISO(ann.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>
        </div>

        {/* ── Right sidebar ─────────────────────────────────────── */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" /> Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((n) => (
                    <Skeleton key={n} className="h-7" />
                  ))}
                </div>
              ) : upcoming.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nothing due soon 🎉</p>
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((a, i) => (
                    <li key={a.id}>
                      <div className="flex items-start gap-2">
                        <div
                          className="mt-1 h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: a.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/course/${a.courseId}/assignments/${a.id}`}
                            className="text-xs font-medium leading-snug truncate hover:underline block"
                          >
                            {a.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">{a.courseCode}</p>
                        </div>
                        <Badge variant={dueBadge(a.due_date!)} className="text-[10px] shrink-0">
                          {dueLabel(a.due_date!)}
                        </Badge>
                      </div>
                      {i < upcoming.length - 1 && <Separator className="mt-3" />}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4 text-muted-foreground" /> To-Do
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {upcoming.length === 0 ? (
                <p className="text-muted-foreground text-xs">All clear 🎉</p>
              ) : (
                <ul className="space-y-2.5">
                  {upcoming.map((a) => (
                    <li key={a.id} className="text-xs leading-snug">
                      <Link
                        href={`/course/${a.courseId}/assignments/${a.id}`}
                        className="hover:underline font-medium"
                      >
                        {a.title}
                      </Link>
                      <span className="text-muted-foreground ml-1">({a.courseCode})</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
