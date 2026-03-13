"use client";

import { useState } from "react";
import { MOCK_NOTIFICATIONS } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCircle, Mail, Clock, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type NotifType = "grade" | "announcement" | "message" | "deadline";

interface PreferenceState {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

const DEFAULT_PREFS: Record<NotifType, PreferenceState> = {
  grade: { email: true, push: true, inApp: true },
  announcement: { email: true, push: false, inApp: true },
  message: { email: false, push: true, inApp: true },
  deadline: { email: true, push: true, inApp: true },
};

const TYPE_META: Record<NotifType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  grade: { label: "Grade Posted", icon: CheckCircle },
  announcement: { label: "Announcement", icon: Bell },
  message: { label: "Message", icon: Mail },
  deadline: { label: "Deadline", icon: Clock },
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  function togglePref(type: NotifType, channel: keyof PreferenceState) {
    setPrefs((prev) => ({
      ...prev,
      [type]: { ...prev[type], [channel]: !prev[type][channel] },
    }));
  }

  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          Notifications
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Stay on top of your courses</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* ── Feed ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Feed
          </h2>
          <motion.div
            className="space-y-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {MOCK_NOTIFICATIONS.map((notif) => {
              const meta = TYPE_META[notif.type];
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
                            notif.type === "grade" && "bg-green-100 text-green-600 dark:bg-green-900/30",
                            notif.type === "announcement" && "bg-purple-100 text-purple-600 dark:bg-purple-900/30",
                            notif.type === "message" && "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
                            notif.type === "deadline" && "bg-orange-100 text-orange-600 dark:bg-orange-900/30",
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
                          <p className="text-xs text-muted-foreground mt-0.5">{notif.body}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {notif.courseCode && (
                              <Badge variant="outline" className="text-[10px] py-0">
                                {notif.courseCode}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
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
        </section>

        {/* ── Preferences ──────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Preferences
          </h2>
          <Card>
            <CardContent className="pt-4 pb-2">
              {(Object.keys(prefs) as NotifType[]).map((type, i) => {
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
                          <div key={channel} className="flex items-center justify-between">
                            <span className="text-xs capitalize text-muted-foreground">
                              {channel === "inApp" ? "In-App" : channel.charAt(0).toUpperCase() + channel.slice(1)}
                            </span>
                            <Switch
                              checked={prefs[type][channel]}
                              onCheckedChange={() => togglePref(type, channel)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    {i < (Object.keys(prefs).length - 1) && <Separator />}
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
