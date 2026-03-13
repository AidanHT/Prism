"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import type { EventClickArg } from "@fullcalendar/core";
import { parseISO, subMonths, addMonths } from "date-fns";

import { calendarApi } from "@/lib/api";
import type { CalendarEventResponse } from "@/lib/types";
import { useApiOpts } from "@/hooks/useApiOpts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ── Colour helpers ────────────────────────────────────────────────────────────

const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981",
  "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
];

function courseColor(courseId: string | null): string {
  if (!courseId) return "#6b7280";
  let h = 0;
  for (let i = 0; i < courseId.length; i++)
    h = (h * 31 + courseId.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  assignment_due: "Assignment Due",
  quiz_due: "Quiz",
  course_event: "Course Event",
  personal: "Personal",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarView() {
  const opts = useApiOpts();
  const calendarRef = useRef<FullCalendar>(null);
  const [selected, setSelected] = useState<CalendarEventResponse | null>(null);

  // Read user's timezone from the browser as a sane default.
  const userTimezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  const now = new Date("2026-03-13");
  const startDate = subMonths(now, 2).toISOString();
  const endDate = addMonths(now, 4).toISOString();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["calendar", startDate, endDate, opts.userId],
    queryFn: () => calendarApi.events(startDate, endDate, opts),
    enabled: !!opts.userId,
    staleTime: 60_000,
  });

  const fcEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start_date,
        end: e.end_date,
        backgroundColor: courseColor(e.course_id),
        borderColor: courseColor(e.course_id),
        textColor: "#fff",
        extendedProps: { raw: e },
      })),
    [events],
  );

  const courseIds: string[] = useMemo(
    () => [
      ...new Set(
        events.map((e) => e.course_id).filter((id): id is string => id !== null),
      ),
    ],
    [events],
  );

  function handleEventClick(info: EventClickArg) {
    info.jsEvent.preventDefault();
    setSelected(info.event.extendedProps.raw as CalendarEventResponse);
  }

  // Format a UTC ISO string in the user's selected timezone using Intl.
  function tzFormat(iso: string): string {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: userTimezone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(parseISO(iso));
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-4">
      {/* Course colour legend */}
      {courseIds.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {courseIds.map((id) => (
            <div key={id} className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-sm inline-block"
                style={{ backgroundColor: courseColor(id) }}
              />
              <span className="text-xs text-muted-foreground font-mono">
                {id.slice(0, 8)}…
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Timezone indicator */}
      <p className="text-xs text-muted-foreground">
        Showing times in <span className="font-medium">{userTimezone}</span>
      </p>

      {/* Calendar */}
      {isLoading ? (
        <Skeleton className="h-[600px] rounded-xl" />
      ) : (
        <Card>
          <CardContent className="p-4">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
              initialView="dayGridMonth"
              initialDate="2026-03-13"
              timeZone={userTimezone}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,listWeek",
              }}
              buttonText={{
                today: "Today",
                month: "Month",
                week: "Week",
                list: "Agenda",
              }}
              events={fcEvents}
              eventClick={handleEventClick}
              height="auto"
              dayMaxEvents={3}
              eventDisplay="block"
            />
          </CardContent>
        </Card>
      )}

      {/* Event detail dialog */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: courseColor(selected.course_id) }}
                  />
                  <Badge variant="secondary" className="text-xs capitalize">
                    {EVENT_TYPE_LABELS[selected.event_type] ?? selected.event_type}
                  </Badge>
                </div>
                <DialogTitle className="text-base leading-snug">
                  {selected.title}
                </DialogTitle>
                {selected.description && (
                  <DialogDescription className="text-sm mt-1">
                    {selected.description}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="text-sm space-y-2 mt-2">
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-medium text-foreground">Starts</span>
                  <span>{tzFormat(selected.start_date)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-medium text-foreground">Ends</span>
                  <span>{tzFormat(selected.end_date)}</span>
                </div>
                {selected.course_id && (
                  <div className="flex justify-between text-muted-foreground">
                    <span className="font-medium text-foreground">Course ID</span>
                    <span className="font-mono text-xs">{selected.course_id}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
