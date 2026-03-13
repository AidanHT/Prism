"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { Bell, CheckCircle, Mail, Clock, CheckCheck } from "lucide-react";
import { motion } from "framer-motion";

import { notificationApi } from "@/lib/api";
import type { NotificationResponse } from "@/lib/types";
import { MOCK_NOTIFICATIONS } from "@/lib/mockData";
import { useApiOpts } from "@/hooks/useApiOpts";
import { useNotificationStore } from "@/store/useNotificationStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ── Notification display types ────────────────────────────────────────────────

type NotifDisplayType = "grade" | "announcement" | "message" | "deadline";

interface DisplayNotif {
  id: string;
  displayType: NotifDisplayType;
  title: string;
  body: string;
  courseCode: string | null;
  createdAt: Date;
  read: boolean;
}

function mapApiType(type: string): NotifDisplayType {
  if (type === "grade_published" || type === "submission_received") return "grade";
  if (type === "deadline_reminder") return "deadline";
  if (type === "message") return "message";
  return "announcement";
}

const TYPE_META: Record<
  NotifDisplayType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  grade: { label: "Grade Posted", icon: CheckCircle },
  announcement: { label: "Announcement", icon: Bell },
  message: { label: "Message", icon: Mail },
  deadline: { label: "Deadline", icon: Clock },
};

// ── Date grouping ─────────────────────────────────────────────────────────────

type DateGroup = "Today" | "Yesterday" | "Older";

function groupByDate(items: DisplayNotif[]): Record<DateGroup, DisplayNotif[]> {
  const groups: Record<DateGroup, DisplayNotif[]> = {
    Today: [],
    Yesterday: [],
    Older: [],
  };
  for (const n of items) {
    if (isToday(n.createdAt)) groups.Today.push(n);
    else if (isYesterday(n.createdAt)) groups.Yesterday.push(n);
    else groups.Older.push(n);
  }
  return groups;
}

// ── Notification preferences ──────────────────────────────────────────────────

type PreferenceState = { email: boolean; push: boolean; inApp: boolean };

const DEFAULT_PREFS: Record<NotifDisplayType, PreferenceState> = {
  grade: { email: true, push: true, inApp: true },
  announcement: { email: true, push: false, inApp: true },
  message: { email: false, push: true, inApp: true },
  deadline: { email: true, push: true, inApp: true },
};

// ── Animations ────────────────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const opts = useApiOpts();
  const qc = useQueryClient();
  const resetUnread = useNotificationStore((s) => s.resetUnread);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [localReadAll, setLocalReadAll] = useState(false);

  // Fetch from API; gracefully fall back to mock data when backend is offline.
  const { data: apiNotifs, isError } = useQuery({
    queryKey: ["notifications", opts.userId],
    queryFn: () => notificationApi.list(opts),
    enabled: !!opts.userId,
    staleTime: 30_000,
  });

  // Build a unified display list regardless of data source.
  const displayNotifs: DisplayNotif[] =
    isError || !apiNotifs
      ? MOCK_NOTIFICATIONS.map(
          (n): DisplayNotif => ({
            id: n.id,
            displayType: n.type as NotifDisplayType,
            title: n.title,
            body: n.body,
            courseCode: n.courseCode,
            createdAt: n.createdAt,
            read: localReadAll || n.read,
          }),
        )
      : (apiNotifs as NotificationResponse[]).map(
          (n): DisplayNotif => ({
            id: n.id,
            displayType: mapApiType(n.type),
            title: n.title,
            body: n.body,
            courseCode: null,
            createdAt: new Date(n.created_at),
            read: localReadAll || n.is_read,
          }),
        );

  const unreadCount = displayNotifs.filter((n) => !n.read).length;

  // Keep the TopNav bell badge in sync while this page is mounted.
  useEffect(() => {
    setUnreadCount(unreadCount);
  }, [unreadCount, setUnreadCount]);

  // ── Mark all as read ──────────────────────────────────────────────────
  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(opts),
    onMutate: () => {
      // Optimistic: update local state immediately.
      setLocalReadAll(true);
      resetUnread();
      qc.setQueryData<NotificationResponse[]>(
        ["notifications", opts.userId],
        (prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? [],
      );
    },
  });

  function togglePref(type: NotifDisplayType, channel: keyof PreferenceState) {
    setPrefs((prev) => ({
      ...prev,
      [type]: { ...prev[type], [channel]: !prev[type][channel] },
    }));
  }

  const groups = groupByDate(displayNotifs);
  const DATE_GROUPS: DateGroup[] = ["Today", "Yesterday", "Older"];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Stay on top of your courses
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* ── Feed grouped by date ─────────────────────────── */}
        <section className="space-y-6">
          {DATE_GROUPS.map((group) => {
            const items = groups[group];
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {group}
                </h2>
                <motion.div
                  className="space-y-2"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {items.map((notif) => {
                    const meta = TYPE_META[notif.displayType];
                    const Icon = meta.icon;
                    return (
                      <motion.div key={notif.id} variants={itemVariants}>
                        <Card
                          className={cn(
                            "transition-colors",
                            !notif.read && "bg-blue-50/40 dark:bg-blue-950/20",
                          )}
                        >
                          <CardContent className="py-3 px-4">
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                                  notif.displayType === "grade" &&
                                    "bg-green-100 text-green-600 dark:bg-green-900/30",
                                  notif.displayType === "announcement" &&
                                    "bg-purple-100 text-purple-600 dark:bg-purple-900/30",
                                  notif.displayType === "message" &&
                                    "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
                                  notif.displayType === "deadline" &&
                                    "bg-orange-100 text-orange-600 dark:bg-orange-900/30",
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={cn(
                                      "text-sm",
                                      !notif.read ? "font-semibold" : "font-medium",
                                    )}
                                  >
                                    {notif.title}
                                  </span>
                                  {!notif.read && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {notif.body}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {notif.courseCode && (
                                    <Badge variant="outline" className="text-[10px] py-0">
                                      {notif.courseCode}
                                    </Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(notif.createdAt, {
                                      addSuffix: true,
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            );
          })}

          {displayNotifs.length === 0 && (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          )}
        </section>

        {/* ── Preferences ──────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Preferences
          </h2>
          <Card>
            <CardContent className="pt-4 pb-2">
              {(Object.keys(prefs) as NotifDisplayType[]).map((type, i) => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <div key={type}>
                    <div className="py-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{meta.label}</span>
                      </div>
                      <div className="space-y-2.5 pl-6">
                        {(["email", "push", "inApp"] as const).map((channel) => (
                          <div
                            key={channel}
                            className="flex items-center justify-between"
                          >
                            <span className="text-xs capitalize text-muted-foreground">
                              {channel === "inApp"
                                ? "In-App"
                                : channel.charAt(0).toUpperCase() + channel.slice(1)}
                            </span>
                            <Switch
                              checked={prefs[type][channel]}
                              onCheckedChange={() => togglePref(type, channel)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    {i < Object.keys(prefs).length - 1 && <Separator />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
