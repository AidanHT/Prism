"use client";

/**
 * ThreadDetail – shows all posts in a thread and the reply composer.
 *
 * Role-specific AI features:
 *   TA / Professor → "Run Tone Check" button on the composer (calls /forum/ta-check)
 *   Professor / TA → "Add to Brain" button on each post (calls /forum/add-to-brain)
 */

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle,
  Loader2,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { forumApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useForumStore } from "@/store/useForumStore";
import type { ForumPost, ForumThread, TaEvaluation } from "@/types/forum";

// ── TaWarningBanner ──────────────────────────────────────────────────────────

function TaWarningBanner({
  evaluation,
  onDismiss,
}: {
  evaluation: TaEvaluation;
  onDismiss: () => void;
}) {
  const { is_accurate, tone_score, suggested_edits } = evaluation;

  const tone =
    tone_score >= 8
      ? { label: "Great tone", icon: CheckCircle, color: "text-green-600" }
      : tone_score >= 5
        ? { label: "Acceptable tone", icon: AlertTriangle, color: "text-amber-600" }
        : { label: "Improve tone", icon: XCircle, color: "text-red-600" };

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/60 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-primary" />
          TA Tone Check Result
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
          <XCircle className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={is_accurate ? "default" : "destructive"} className="text-xs">
          {is_accurate ? "✓ Factually accurate" : "✗ Accuracy concern"}
        </Badge>
        <Badge variant="secondary" className={`text-xs ${tone.color}`}>
          <tone.icon className="mr-1 h-3 w-3" />
          {tone.label} ({tone_score}/10)
        </Badge>
      </div>

      {suggested_edits && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Suggestion: </span>
          {suggested_edits}
        </p>
      )}
    </div>
  );
}

// ── PostCard ─────────────────────────────────────────────────────────────────

function PostCard({
  post,
  thread,
  canAddToBrain,
}: {
  post: ForumPost;
  thread: ForumThread;
  canAddToBrain: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const [adding, setAdding] = useState(false);

  const handleAddToBrain = async () => {
    if (!user) return;
    setAdding(true);
    try {
      const role = user.role.toLowerCase() as "professor" | "ta";
      const result = await forumApi.addToBrain(
        { thread_id: thread.id },
        role,
        { userId: user.id },
      );
      toast.success("Added to Brain", { description: result.message });
    } catch {
      toast.error("Failed to add to Brain", {
        description: "Check the console for details.",
      });
    } finally {
      setAdding(false);
    }
  };

  const initials = post.author_id.slice(0, 2).toUpperCase();
  const formattedTime = new Date(post.timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-semibold leading-none">{post.author_id}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{formattedTime}</p>
            </div>
          </div>

          {canAddToBrain && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleAddToBrain}
              disabled={adding}
            >
              {adding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Brain className="h-3.5 w-3.5 text-primary" />
              )}
              Add to Brain
            </Button>
          )}
        </div>

        <div
          className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </CardContent>
    </Card>
  );
}

// ── ReplyComposer ────────────────────────────────────────────────────────────

function ReplyComposer({
  thread,
  courseId,
}: {
  thread: ForumThread;
  courseId: string;
}) {
  const user = useAuthStore((s) => s.user);
  const addPost = useForumStore((s) => s.addPost);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [evaluation, setEvaluation] = useState<TaEvaluation | null>(null);

  const isPrivileged =
    user?.role === "TA" || user?.role === "Professor";

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class:
          "min-h-[100px] rounded-md border bg-background px-3 py-2 text-sm focus:outline-none",
      },
    },
  });

  const handleToneCheck = async () => {
    if (!user || !editor) return;
    const html = editor.getHTML();
    const text = editor.getText().trim();
    if (!text) return;

    setChecking(true);
    setEvaluation(null);
    try {
      const result = await forumApi.taCheck(
        { thread_id: thread.id, course_id: courseId, draft_response: text },
        { userId: user.id },
      );
      setEvaluation(result);
    } catch {
      toast.error("Tone check failed", {
        description: "Backend unavailable or thread not found.",
      });
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !editor) return;
    const html = editor.getHTML();
    const text = editor.getText().trim();
    if (!text) return;

    setSubmitting(true);
    try {
      const post = await forumApi.createPost(
        thread.id,
        { author_id: user.id, content: html },
        { userId: user.id },
      );
      addPost(post);
      editor.commands.clearContent();
      setEvaluation(null);
      toast.success("Reply posted");
    } catch {
      toast.error("Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {evaluation && (
        <TaWarningBanner
          evaluation={evaluation}
          onDismiss={() => setEvaluation(null)}
        />
      )}

      <EditorContent editor={editor} />

      <div className="flex items-center justify-between">
        {isPrivileged ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleToneCheck}
            disabled={checking || submitting}
          >
            {checking ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-primary" />
            )}
            Run Tone Check
          </Button>
        ) : (
          <span />
        )}

        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-3.5 w-3.5" />
          )}
          Reply
        </Button>
      </div>
    </div>
  );
}

// ── ThreadDetail (root export) ───────────────────────────────────────────────

interface ThreadDetailProps {
  thread: ForumThread;
  courseId: string;
  onBack: () => void;
}

export function ThreadDetail({ thread, courseId, onBack }: ThreadDetailProps) {
  const user = useAuthStore((s) => s.user);
  const posts = useForumStore((s) => s.posts[thread.id] ?? []);
  const setPosts = useForumStore((s) => s.setPosts);

  const canAddToBrain =
    user?.role === "Professor" || user?.role === "TA";

  // Fetch posts on mount / thread change.
  useEffect(() => {
    if (!user) return;
    forumApi
      .listPosts(thread.id, { userId: user.id })
      .then((fetched) => setPosts(thread.id, fetched))
      .catch(() => {
        // Backend unavailable — keep any optimistically-added posts.
      });
  }, [thread.id, user, setPosts]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold leading-snug">{thread.title}</h2>
      </div>

      <Separator />

      {/* Posts */}
      <ScrollArea className="max-h-[calc(100vh-380px)]">
        <div className="flex flex-col gap-3 pr-2">
          {posts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No replies yet — be the first!
            </p>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                thread={thread}
                canAddToBrain={canAddToBrain}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Composer */}
      <ReplyComposer thread={thread} courseId={courseId} />
    </div>
  );
}
