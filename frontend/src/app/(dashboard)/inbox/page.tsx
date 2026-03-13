"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOCK_CONVERSATIONS } from "@/lib/mockData";
import { useCourseStore } from "@/store/useCourseStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { Search, Pencil, MessageSquare } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const courses = useCourseStore((s) => s.courses);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string | null>(null);

  const filtered = MOCK_CONVERSATIONS.filter((c) => {
    const matchSearch =
      c.subject.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase());
    const matchCourse = courseFilter === null || c.courseId === courseFilter;
    return matchSearch && matchCourse;
  });

  const unreadCount = MOCK_CONVERSATIONS.filter((c) => c.unread).length;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Inbox
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your messages</p>
        </div>
        <Button size="sm" variant="outline">
          <Pencil className="h-4 w-4 mr-1" /> Compose
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[400px]">
        {/* ── Left pane: conversation list ────────────────────── */}
        <Card className="flex flex-col overflow-hidden">
          {/* Search + filter */}
          <div className="p-3 space-y-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant={courseFilter === null ? "secondary" : "ghost"}
                className="h-6 text-xs px-2"
                onClick={() => setCourseFilter(null)}
              >
                All
              </Button>
              {courses.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={courseFilter === c.id ? "secondary" : "ghost"}
                  className="h-6 text-xs px-2"
                  onClick={() => setCourseFilter(c.id)}
                  style={
                    courseFilter === c.id
                      ? { backgroundColor: c.colorCode + "22", color: c.colorCode }
                      : {}
                  }
                >
                  {c.code}
                </Button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No conversations found.</p>
              </div>
            ) : (
              filtered.map((conv, i) => (
                <div key={conv.id}>
                  <Link href={`/inbox/${conv.id}`}>
                    <div
                      className={cn(
                        "px-3 py-3 hover:bg-muted/50 transition-colors cursor-pointer",
                        conv.unread && "bg-blue-50/40 dark:bg-blue-950/20",
                      )}
                    >
                      {/* Top row */}
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {conv.unread && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                          )}
                          <span
                            className={cn(
                              "text-sm truncate",
                              conv.unread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {conv.subject}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(conv.lastAt, { addSuffix: false })}
                        </span>
                      </div>
                      {/* Participants */}
                      <p className="text-xs text-muted-foreground truncate mb-0.5">
                        {conv.participants.join(", ")}
                      </p>
                      {/* Preview */}
                      <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                      {conv.courseCode && (
                        <Badge variant="outline" className="mt-1.5 text-[10px] py-0">
                          {conv.courseCode}
                        </Badge>
                      )}
                    </div>
                  </Link>
                  {i < filtered.length - 1 && <Separator />}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* ── Right pane: no conversation selected ──────────── */}
        <Card className="hidden md:flex items-center justify-center text-center">
          <div>
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Select a conversation to read it.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
