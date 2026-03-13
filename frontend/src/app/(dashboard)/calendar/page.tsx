"use client";

/**
 * Calendar page – client component shell.
 *
 * FullCalendar accesses browser globals (window, document) during module
 * initialisation, so the interactive calendar is loaded as a dynamically
 * imported client component with ``ssr: false`` to prevent hydration errors.
 */
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const CalendarView = dynamic(
  () => import("./_components/CalendarView"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[680px] rounded-xl" />,
  },
);

export default function CalendarPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Assignments, quizzes, and events across all your courses
        </p>
      </div>
      <CalendarView />
    </div>
  );
}
