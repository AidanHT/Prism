"use client";

import { use, useState } from "react";
import { MOCK_CONVERSATIONS } from "@/lib/mockData";
import { useCourseStore } from "@/store/useCourseStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Search, Pencil, MessageSquare, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ conversationId: string }>;
}

export default function ConversationPage({ params }: PageProps) {
  const { conversationId } = use(params);
  const courses = useCourseStore((s) => s.courses);
  const [reply, setReply] = useState("");

  const activeConv = MOCK_CONVERSATIONS.find((c) => c.id === conversationId) ?? null;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/inbox">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Inbox
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Your messages</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[400px]">
        {/* ── Left pane: conversation list ────────────────────── */}
        <Card className="flex-col overflow-hidden hidden md:flex">
          <div className="p-3 border-b">
            <div className="flex gap-1.5 flex-wrap">
              <Button size="sm" variant="secondary" className="h-6 text-xs px-2">
                All
              </Button>
              {courses.slice(0, 3).map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2"
                >
                  {c.code}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {MOCK_CONVERSATIONS.map((conv, i) => (
              <div key={conv.id}>
                <Link href={`/inbox/${conv.id}`}>
                  <div
                    className={cn(
                      "px-3 py-3 hover:bg-muted/50 transition-colors cursor-pointer",
                      conv.id === conversationId && "bg-muted",
                      conv.unread && conv.id !== conversationId && "bg-blue-50/40 dark:bg-blue-950/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {conv.unread && conv.id !== conversationId && (
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
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    {conv.courseCode && (
                      <Badge variant="outline" className="mt-1 text-[10px] py-0">
                        {conv.courseCode}
                      </Badge>
                    )}
                  </div>
                </Link>
                {i < MOCK_CONVERSATIONS.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </Card>

        {/* ── Right pane: thread ────────────────────────────── */}
        <Card className="flex flex-col overflow-hidden">
          {activeConv === null ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Conversation not found.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b shrink-0">
                <h2 className="font-semibold text-sm">{activeConv.subject}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">
                    {activeConv.participants.join(", ")}
                  </p>
                  {activeConv.courseCode && (
                    <Badge variant="outline" className="text-[10px] py-0">
                      {activeConv.courseCode}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeConv.messages.map((msg) => {
                  const isSelf = msg.sender === "Dev User";
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex gap-3", isSelf && "flex-row-reverse")}
                    >
                      {/* Avatar */}
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {msg.senderInitials}
                      </div>
                      {/* Bubble */}
                      <div className={cn("max-w-[70%] space-y-1", isSelf && "items-end flex flex-col")}>
                        <div
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm",
                            isSelf
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground",
                          )}
                        >
                          {msg.body}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {msg.sender} · {formatDistanceToNow(msg.sentAt, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply input */}
              <div className="border-t p-3 shrink-0">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write a reply…"
                    rows={2}
                    className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button size="icon" className="h-9 w-9 shrink-0" disabled={!reply.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
