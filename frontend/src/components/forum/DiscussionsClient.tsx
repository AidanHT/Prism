"use client";

/**
 * DiscussionsClient – top-level client component for /course/[courseId]/discussions.
 *
 * Responsibilities:
 *   1. Fetch threads on mount and populate the Zustand store.
 *   2. Connect to the native WebSocket at ws://<host>/api/v1/forum/live/{courseId}
 *      and optimistically add new posts as they arrive.
 *   3. Render a flat segmented toggle (Thread / Bubble) with an unresolved-question
 *      stat badge, using Framer Motion AnimatePresence for jank-free view transitions.
 *   4. Manage the TopicSummarySheet open state for Bubble View clicks.
 *   5. Handle "New Thread" creation inline.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Boxes,
  CircleDot,
  Loader2,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { forumApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useForumStore } from "@/store/useForumStore";
import type { ForumPost } from "@/types/forum";

import { TopicSummarySheet } from "./TopicSummarySheet";
import { ThreadDetail } from "./ThreadDetail";
import { ThreadView } from "./ThreadView";

// Lazy-load BubbleView — it pulls in Three.js and is browser-only.
const BubbleView = dynamic(
  () => import("./BubbleView").then((m) => ({ default: m.BubbleView })),
  { ssr: false, loading: () => <BubbleViewSkeleton /> },
);

function BubbleViewSkeleton() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading 3D view…
    </div>
  );
}

// ── NewThreadForm ─────────────────────────────────────────────────────────────

function NewThreadForm({
  courseId,
  onCreated,
  onCancel,
}: {
  courseId: string;
  onCreated: (threadId: string) => void;
  onCancel: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const addThread = useForumStore((s) => s.addThread);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class:
          "min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm focus:outline-none",
      },
    },
  });

  const handleSubmit = async () => {
    if (!user || !title.trim() || !editor) return;
    const content = editor.getText().trim();
    if (!content) return;

    setSubmitting(true);
    try {
      const thread = await forumApi.createThread(
        {
          course_id: courseId,
          title: title.trim(),
          content,
          author_id: user.id,
        },
        { userId: user.id },
      );
      addThread(thread);
      toast.success("Thread created");
      onCreated(thread.id);
    } catch {
      toast.error("Failed to create thread");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">New Thread</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="thread-title" className="text-xs">
            Title
          </Label>
          <Input
            id="thread-title"
            placeholder="Ask a question or start a discussion…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Details</Label>
          <EditorContent editor={editor} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
          >
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Post Thread
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── ViewToggle ────────────────────────────────────────────────────────────────

function ViewToggle({
  view,
  onViewChange,
}: {
  view: "thread" | "bubble";
  onViewChange: (v: "thread" | "bubble") => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted p-1">
      <Button
        size="sm"
        variant={view === "thread" ? "default" : "ghost"}
        className="h-7 gap-1.5 px-3 text-xs"
        onClick={() => onViewChange("thread")}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Thread View
      </Button>
      <Button
        size="sm"
        variant={view === "bubble" ? "default" : "ghost"}
        className="h-7 gap-1.5 px-3 text-xs"
        onClick={() => onViewChange("bubble")}
      >
        <Boxes className="h-3.5 w-3.5" />
        Bubble View
      </Button>
    </div>
  );
}

// ── DiscussionsClient ─────────────────────────────────────────────────────────

interface DiscussionsClientProps {
  courseId: string;
}

export function DiscussionsClient({ courseId }: DiscussionsClientProps) {
  const user = useAuthStore((s) => s.user);

  const view = useForumStore((s) => s.view);
  const setView = useForumStore((s) => s.setView);
  const threads = useForumStore((s) => s.threads);
  const setThreads = useForumStore((s) => s.setThreads);
  const addPost = useForumStore((s) => s.addPost);
  const activeThreadId = useForumStore((s) => s.activeThreadId);
  const setActiveThreadId = useForumStore((s) => s.setActiveThreadId);
  const activeClusterId = useForumStore((s) => s.activeClusterId);
  const setActiveClusterId = useForumStore((s) => s.setActiveClusterId);
  const posts = useForumStore((s) => s.posts);

  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  // Derive unresolved count: threads that have no posts are considered unresolved.
  const unresolvedCount = threads.filter(
    (t) => (posts[t.id] ?? []).length === 0,
  ).length;

  // ── Load threads ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    forumApi
      .listThreads(courseId, { userId: user.id })
      .then(setThreads)
      .catch(() => {
        setThreads([]);
      })
      .finally(() => setLoading(false));
  }, [courseId, user, setThreads]);

  // ── WebSocket – real-time new_post events ─────────────────────────────────
  useEffect(() => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const wsUrl = API_BASE.replace(/^http/, "ws");

    const ws = new WebSocket(`${wsUrl}/api/v1/forum/live/${courseId}`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as {
          event: string;
          post: ForumPost;
        };
        if (msg.event === "new_post") {
          addPost(msg.post);
        }
      } catch {
        // ignore malformed messages
      }
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 25_000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
      wsRef.current = null;
    };
  }, [courseId, addPost]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
      setShowNewForm(false);
    },
    [setActiveThreadId],
  );

  const handleClusterClick = useCallback(
    (clusterId: string) => {
      setActiveClusterId(clusterId);
    },
    [setActiveClusterId],
  );

  const handleNewThreadCreated = useCallback(
    (threadId: string) => {
      setShowNewForm(false);
      setActiveThreadId(threadId);
    },
    [setActiveThreadId],
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <ViewToggle view={view} onViewChange={setView} />
          {/* Unresolved questions stat badge */}
          {threads.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1">
              <CircleDot className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-semibold text-foreground">
                {unresolvedCount}
              </span>
              <span className="text-xs text-muted-foreground">
                Unresolved
              </span>
            </div>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => {
            setShowNewForm(true);
            setActiveThreadId(null);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Thread
        </Button>
      </div>

      {/* New thread form */}
      {showNewForm && (
        <NewThreadForm
          courseId={courseId}
          onCreated={handleNewThreadCreated}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* Main content area */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {view === "bubble" ? (
            <motion.div
              key="bubble"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {/* ── Bubble View ── */}
              <Card className="relative overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Boxes className="h-4 w-4 text-primary" />
                    Visual Concept Map
                    <Badge variant="secondary" className="ml-1 text-xs font-normal">
                      {threads.length} thread{threads.length !== 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Semantic clusters derived from thread embeddings. Node size =
                    thread volume · Glow intensity = recent activity.
                  </CardDescription>
                </CardHeader>
                <Separator />
                <CardContent className="p-0">
                  <div className="relative h-[clamp(360px,50vh,640px)]">
                    <BubbleView
                      threads={threads}
                      onClusterClick={handleClusterClick}
                    />
                  </div>
                </CardContent>
              </Card>

              <TopicSummarySheet
                clusterId={activeClusterId}
                threads={threads}
                onClose={() => setActiveClusterId(null)}
                onSelectThread={(id) => {
                  setView("thread");
                  setActiveThreadId(id);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="thread"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {/* ── Thread View ── */}
              <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      Discussions
                      <span className="ml-auto text-xs font-normal text-muted-foreground">
                        {threads.length} thread{threads.length !== 1 ? "s" : ""}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ThreadView
                      threads={threads}
                      activeThreadId={activeThreadId}
                      onSelectThread={handleSelectThread}
                      onNewThread={() => setShowNewForm(true)}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    {activeThread ? (
                      <ThreadDetail
                        thread={activeThread}
                        courseId={courseId}
                        onBack={() => setActiveThreadId(null)}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                        <MessageSquare className="h-10 w-10 opacity-20" />
                        <p className="text-sm">Select a thread to read and reply</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
