"use client";

/**
 * ClusterSheet – shadcn/ui Sheet that slides in when a Bubble View node is
 * clicked.  Shows the Claude Opus 4.6 cluster summary (fetched on open) and
 * the list of threads that belong to the cluster.
 */

import { useEffect, useState } from "react";
import { Brain, MessageSquare, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ForumThread } from "@/types/forum";

interface ClusterSheetProps {
  clusterId: string | null;
  threads: ForumThread[];
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
}

/** Very lightweight streaming SSE reader for the /forum/ask summary. */
function useClusterSummary(clusterId: string | null, threads: ForumThread[]) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clusterId || threads.length === 0) return;

    setSummary("");
    setLoading(true);

    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

    // Build a representative question from the cluster's thread titles.
    const sampleTitles = threads
      .slice(0, 5)
      .map((t) => t.title)
      .join("; ");
    const question = `Summarise the key themes in this discussion cluster: ${sampleTitles}`;

    const ctrl = new AbortController();

    fetch(`${API_BASE}/api/v1/forum/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        course_id: threads[0]?.course_id ?? "unknown",
        author_id: "system-summary",
        k: 5,
      }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // Parse SSE lines.
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") break;
            try {
              const evt = JSON.parse(raw) as { type: string; v?: string };
              if (evt.type === "token" && evt.v) {
                setSummary((s) => s + evt.v);
              }
            } catch {
              // ignore malformed SSE frames
            }
          }
        }
      })
      .catch(() => {
        // Backend unreachable — show a graceful fallback.
        setSummary(
          `This cluster contains ${threads.length} thread${threads.length !== 1 ? "s" : ""} on related topics.`,
        );
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [clusterId, threads]);

  return { summary, loading };
}

export function ClusterSheet({
  clusterId,
  threads,
  onClose,
  onSelectThread,
}: ClusterSheetProps) {
  const clusterThreads = clusterId
    ? threads.filter(
        (t) => (t.cluster_id ?? t.id) === clusterId,
      )
    : [];

  const { summary, loading } = useClusterSummary(clusterId, clusterThreads);

  return (
    <Sheet open={clusterId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="flex items-center gap-2 text-base leading-tight">
              <Brain className="h-4 w-4 shrink-0 text-violet-500" />
              Concept Cluster
              <Badge variant="secondary" className="ml-1 text-xs">
                {clusterThreads.length} thread
                {clusterThreads.length !== 1 ? "s" : ""}
              </Badge>
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-6 px-6 py-5">
            {/* AI Summary */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Summary · Claude Opus 4.6
              </h3>
              {loading && !summary ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                  Generating summary…
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {summary || "No summary available."}
                  {loading && (
                    <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-violet-400 align-middle" />
                  )}
                </p>
              )}
            </section>

            {/* Thread list */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Threads in this cluster
              </h3>
              <ul className="flex flex-col gap-2">
                {clusterThreads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      className="group flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
                      onClick={() => {
                        onSelectThread(thread.id);
                        onClose();
                      }}
                    >
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px]">
                          <MessageSquare className="h-3.5 w-3.5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium group-hover:text-primary">
                          {thread.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(thread.created_at).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
