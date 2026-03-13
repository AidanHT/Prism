"use client";

/**
 * TopicSummarySheet – shadcn/ui Sheet that slides in from the right when a
 * Bubble View node is clicked.
 *
 * Displays:
 *   - Claude Haiku 4.5 streamed AI synthesis of the topic cluster
 *   - List of threads in the cluster
 *   - "Add to Brain" CTA that pushes the cluster content into the RAG database
 */

import { useEffect, useState } from "react";
import { Brain, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { forumApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import type { ClusterNode, ClusterThreadSummary } from "@/types/forum";

// ── Streaming summary hook ────────────────────────────────────────────────────

function useClusterSummary(
  clusterId: string | null,
  threads: ClusterThreadSummary[],
  courseId: string,
) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clusterId || threads.length === 0) return;

    setSummary("");
    setLoading(true);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
        course_id: courseId,
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
        setSummary(
          `This cluster contains ${threads.length} thread${threads.length !== 1 ? "s" : ""} on related topics.`,
        );
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [clusterId, threads, courseId]);

  return { summary, loading };
}

// ── TopicSummarySheet ─────────────────────────────────────────────────────────

interface TopicSummarySheetProps {
  clusterId: string | null;
  clusters: ClusterNode[];
  courseId: string;
  onClose: () => void;
  onSelectThread: (threadId: string) => void;
}

export function TopicSummarySheet({
  clusterId,
  clusters,
  courseId,
  onClose,
  onSelectThread,
}: TopicSummarySheetProps) {
  const user = useAuthStore((s) => s.user);
  const [addingToBrain, setAddingToBrain] = useState(false);

  const activeCluster = clusterId
    ? clusters.find((c) => c.cluster_id === clusterId) ?? null
    : null;

  const clusterThreads = activeCluster?.threads ?? [];

  const { summary, loading } = useClusterSummary(clusterId, clusterThreads, courseId);

  const canAddToBrain =
    user?.role === "Professor" || user?.role === "TA";

  const handleAddToBrain = async () => {
    if (!user || !clusterId || clusterThreads.length === 0) return;
    setAddingToBrain(true);
    try {
      const role = user.role.toLowerCase() as "professor" | "ta";
      const result = await forumApi.addToBrain(
        { thread_id: clusterThreads[0].id },
        role,
        { userId: user.id },
      );
      toast.success("Cluster added to Brain", { description: result.message });
    } catch {
      toast.error("Failed to add to Brain");
    } finally {
      setAddingToBrain(false);
    }
  };

  return (
    <Sheet open={clusterId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg bg-white dark:bg-card shadow-[0_0_40px_rgba(0,0,0,0.08)]"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="flex items-center gap-2 text-base leading-tight">
              <Brain className="h-4 w-4 shrink-0 text-primary" />
              {activeCluster?.representative_topic ?? "Topic Summary"}
              <Badge variant="secondary" className="ml-1 text-xs font-normal">
                {clusterThreads.length} thread
                {clusterThreads.length !== 1 ? "s" : ""}
              </Badge>
            </SheetTitle>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-6 px-6 py-5">

            {/* AI Synthesis section */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Synthesis
                </h3>
                <Badge variant="secondary" className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0">
                  <Sparkles className="h-2.5 w-2.5" />
                  Claude Haiku 4.5
                </Badge>
              </div>

              {loading && !summary ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                  Generating synthesis…
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {summary || "No summary available."}
                  {loading && (
                    <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-primary align-middle" />
                  )}
                </p>
              )}
            </section>

            <Separator />

            {/* Thread list section */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Threads in this cluster
              </h3>
              <ul className="flex flex-col gap-2">
                {clusterThreads.map((thread) => (
                  <li key={thread.id}>
                    <button
                      className="group flex w-full items-start gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
                      onClick={() => {
                        onSelectThread(thread.id);
                        onClose();
                      }}
                    >
                      <Avatar className="mt-0.5 h-7 w-7 shrink-0">
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

        {/* Footer — Add to Brain CTA */}
        {canAddToBrain && (
          <SheetFooter className="border-t px-6 py-4">
            <Button
              className="w-full gap-2"
              onClick={handleAddToBrain}
              disabled={addingToBrain || clusterThreads.length === 0}
            >
              {addingToBrain ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Adding to Brain…
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Add to Brain
                </>
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
