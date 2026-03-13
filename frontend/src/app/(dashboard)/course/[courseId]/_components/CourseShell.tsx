"use client";

/**
 * CourseShell – interactive client wrapper for the /course/[courseId] layout.
 *
 * Kept as a Client Component because it relies on:
 *   - usePathname()     (active nav highlighting)
 *   - useQuery()        (course title/code fetch)
 *   - useEffect()       (Zustand store sync)
 *   - AnimatePresence   (per-route transition animation)
 *
 * The parent layout.tsx is a Server Component that reads courseId from
 * params and passes it down, keeping the RSC boundary as high as possible.
 */

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Megaphone,
  BookMarked,
  Layers,
  ClipboardList,
  HelpCircle,
  MessageSquare,
  Users,
  BookOpen,
  FolderOpen,
  BarChart2,
  TableProperties,
  ListChecks,
  TrendingUp,
  Settings,
  Menu,
} from "lucide-react";

import { courseApi } from "@/lib/api";
import { useApiOpts } from "@/hooks/useApiOpts";
import { useCourseStore } from "@/store/useCourseStore";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}

// ── Nav builder ───────────────────────────────────────────────────────────────

function buildNav(courseId: string): {
  common: NavItem[];
  studentOnly: NavItem[];
  instructorOnly: NavItem[];
} {
  const b = `/course/${courseId}`;
  return {
    common: [
      { label: "Home", href: b, Icon: Home },
      { label: "Announcements", href: `${b}/announcements`, Icon: Megaphone },
      { label: "Syllabus", href: `${b}/syllabus`, Icon: BookMarked },
      { label: "Modules", href: `${b}/modules`, Icon: Layers },
      { label: "Assignments", href: `${b}/assignments`, Icon: ClipboardList },
      { label: "Quizzes", href: `${b}/quizzes`, Icon: HelpCircle },
      { label: "Discussions", href: `${b}/discussions`, Icon: MessageSquare },
      { label: "People", href: `${b}/people`, Icon: Users },
      { label: "Pages", href: `${b}/pages`, Icon: BookOpen },
      { label: "Files", href: `${b}/files`, Icon: FolderOpen },
    ],
    studentOnly: [{ label: "Grades", href: `${b}/grades`, Icon: BarChart2 }],
    instructorOnly: [
      { label: "Gradebook", href: `${b}/gradebook`, Icon: TableProperties },
      { label: "Rubrics", href: `${b}/rubrics`, Icon: ListChecks },
      { label: "Analytics", href: `${b}/analytics`, Icon: TrendingUp },
      { label: "Settings", href: `${b}/settings`, Icon: Settings },
    ],
  };
}

function isNavActive(
  itemHref: string,
  pathname: string,
  courseBase: string,
): boolean {
  if (itemHref === courseBase) return pathname === courseBase;
  return pathname === itemHref || pathname.startsWith(itemHref + "/");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CourseNavList({
  items,
  pathname,
  courseBase,
  onNavClick,
}: {
  items: NavItem[];
  pathname: string;
  courseBase: string;
  onNavClick?: () => void;
}) {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavClick}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
            isNavActive(item.href, pathname, courseBase)
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <item.Icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Link>
      ))}
    </>
  );
}

function SidebarNav({
  courseId,
  pathname,
  role,
  onNavClick,
}: {
  courseId: string;
  pathname: string;
  role: string;
  onNavClick?: () => void;
}) {
  const { common, studentOnly, instructorOnly } = buildNav(courseId);
  const courseBase = `/course/${courseId}`;

  return (
    <div className="flex flex-col gap-1 p-2">
      <CourseNavList
        items={common}
        pathname={pathname}
        courseBase={courseBase}
        onNavClick={onNavClick}
      />
      <Separator className="my-1" />
      {role === "Student" ? (
        <CourseNavList
          items={studentOnly}
          pathname={pathname}
          courseBase={courseBase}
          onNavClick={onNavClick}
        />
      ) : (
        <CourseNavList
          items={instructorOnly}
          pathname={pathname}
          courseBase={courseBase}
          onNavClick={onNavClick}
        />
      )}
    </div>
  );
}

// Deterministic color hash — same palette as dashboard
const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981",
  "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
];
function courseColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── CourseShell (exported) ────────────────────────────────────────────────────

interface CourseShellProps {
  courseId: string;
  children: ReactNode;
}

export function CourseShell({ courseId, children }: CourseShellProps) {
  const pathname = usePathname();
  const opts = useApiOpts();
  const setActiveCourse = useCourseStore((s) => s.setActiveCourse);
  const clearActiveCourse = useCourseStore((s) => s.clearActiveCourse);
  const courses = useCourseStore((s) => s.courses);
  const user = useAuthStore((s) => s.user);

  const { data: apiCourse } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => courseApi.get(courseId, opts),
    enabled: !!opts.userId && !!courseId,
    staleTime: 120_000,
  });

  const mockCourse = courses.find((c) => c.id === courseId);
  const courseTitle = apiCourse?.title ?? mockCourse?.title ?? "Loading…";
  const courseCode = apiCourse?.code ?? mockCourse?.code ?? "";
  const courseTerm = apiCourse?.term ?? mockCourse?.term ?? "";
  const color = apiCourse
    ? courseColor(apiCourse.id)
    : (mockCourse?.colorCode ?? "#6366f1");

  const role = user?.role ?? "Student";

  useEffect(() => {
    if (courseId) setActiveCourse(courseId);
    return () => clearActiveCourse();
  }, [courseId, setActiveCourse, clearActiveCourse]);

  return (
    <div
      className="flex flex-1 flex-col"
      style={{ minHeight: "calc(100svh - 4rem)" }}
    >
      {/* ── Course Header ─────────────────────────────────── */}
      <header className="flex items-center gap-3 border-b bg-background px-4 py-3 shrink-0">
        {/* Mobile nav trigger */}
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0 h-8 w-8"
              />
            }
          >
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open course navigation</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="text-left text-sm">
                Course Navigation
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto">
              <SidebarNav
                courseId={courseId}
                pathname={pathname}
                role={role}
              />
            </div>
          </SheetContent>
        </Sheet>

        {/* Course color accent */}
        <div
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight">
            {courseTitle}
          </h1>
          <p className="text-muted-foreground text-xs">
            {courseCode} &middot; {courseTerm}
          </p>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sub-sidebar */}
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r overflow-y-auto">
          <SidebarNav courseId={courseId} pathname={pathname} role={role} />
        </aside>

        {/* Animated page content */}
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="p-4"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
