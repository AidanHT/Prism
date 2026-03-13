"use client";

/**
 * ThreadView – chronological list of forum threads rendered as shadcn Cards.
 * Clicking a thread calls onSelectThread so the parent can open ThreadDetail.
 */

import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Plus, Tag } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ForumThread } from "@/types/forum";

interface ThreadViewProps {
  threads: ForumThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
}

export function ThreadView({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
}: ThreadViewProps) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <MessageSquare className="h-10 w-10 opacity-20" />
        <p className="text-sm font-medium">No threads yet</p>
        <p className="max-w-xs text-center text-xs">
          Be the first to post a question or start a discussion.
        </p>
        <Button size="sm" onClick={onNewThread} className="mt-1">
          <Plus className="mr-1.5 h-4 w-4" />
          Start a thread
        </Button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {threads.map((thread) => {
        const isActive = thread.id === activeThreadId;
        const initials = thread.author_id?.slice(0, 2).toUpperCase() ?? "??";
        const relTime = formatDistanceToNow(new Date(thread.created_at), {
          addSuffix: true,
        });

        return (
          <li key={thread.id}>
            <Card
              className={`cursor-pointer transition-colors hover:bg-accent ${
                isActive ? "border-primary bg-accent/60" : ""
              }`}
              onClick={() => onSelectThread(thread.id)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-snug">
                    {thread.title}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {thread.cluster_id && (
                      <Badge
                        variant="secondary"
                        className="flex items-center gap-1 px-1.5 py-0 text-[10px]"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        cluster
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {relTime}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
