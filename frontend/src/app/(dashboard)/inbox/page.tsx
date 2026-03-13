"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { formatDistanceToNow } from "date-fns";
import { Search, Pencil, MessageSquare, X, Send } from "lucide-react";
import Link from "next/link";

import { messageApi, userApi } from "@/lib/api";
import type { UserSearchResult } from "@/lib/types";
import { MOCK_CONVERSATIONS } from "@/lib/mockData";
import { useApiOpts } from "@/hooks/useApiOpts";
import { useCourseStore } from "@/store/useCourseStore";
import { useAuthStore } from "@/store/useAuthStore";
import { getSocket } from "@/lib/socket";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── Compose Modal ─────────────────────────────────────────────────────────────

function ComposeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const opts = useApiOpts();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<UserSearchResult[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      },
    },
  });

  // Debounced recipient search (300 ms delay).
  const handleRecipientInput = useCallback(
    (value: string) => {
      setRecipientSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length < 2) {
        setSearchResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await userApi.search(value, opts);
          setSearchResults(
            results.filter((r) => !selectedRecipients.some((s) => s.id === r.id)),
          );
        } catch {
          setSearchResults([]);
        }
      }, 300);
    },
    [opts, selectedRecipients],
  );

  const sendMutation = useMutation({
    mutationFn: () =>
      messageApi.create(
        {
          subject,
          body: editor?.getHTML() ?? "",
          recipient_ids: selectedRecipients.map((r) => r.id),
        },
        opts,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      onClose();
    },
  });

  const canSend =
    subject.trim().length > 0 &&
    selectedRecipients.length > 0 &&
    (editor?.getText().trim().length ?? 0) > 0 &&
    !sendMutation.isPending;

  function addRecipient(user: UserSearchResult) {
    setSelectedRecipients((prev) => [...prev, user]);
    setRecipientSearch("");
    setSearchResults([]);
  }

  function removeRecipient(id: string) {
    setSelectedRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-1">
          {/* Recipients with autocomplete */}
          <div className="space-y-1.5">
            <label htmlFor="recipient-search" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              To
            </label>
            <div className="flex flex-wrap gap-1.5 min-h-9 rounded-md border border-input bg-background px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring">
              {selectedRecipients.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {r.name}
                  <button
                    type="button"
                    onClick={() => removeRecipient(r.id)}
                    className="hover:text-destructive transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="recipient-search"
                value={recipientSearch}
                onChange={(e) => handleRecipientInput(e.target.value)}
                placeholder={
                  selectedRecipients.length === 0 ? "Search by name or email…" : ""
                }
                className="flex-1 min-w-24 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-md bg-background shadow-sm divide-y overflow-hidden">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                    onClick={() => addRecipient(user)}
                  >
                    <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium shrink-0">
                      {user.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{user.name}</p>
                      <p className="text-muted-foreground text-xs truncate">
                        {user.email}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label htmlFor="message-subject" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Subject
            </label>
            <Input
              id="message-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Message subject…"
            />
          </div>

          {/* Body – TipTap rich-text editor */}
          <div className="space-y-1.5">
            <label htmlFor="message-body" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Message
            </label>
            <EditorContent editor={editor} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => sendMutation.mutate()} disabled={!canSend}>
              <Send className="h-4 w-4 mr-1.5" />
              {sendMutation.isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const opts = useApiOpts();
  const userId = useAuthStore((s) => s.user?.id);
  const courses = useCourseStore((s) => s.courses);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  // Fetch messages; list will refresh on socket new_message events.
  useQuery({
    queryKey: ["messages", opts.userId],
    queryFn: () => messageApi.list(opts),
    enabled: !!opts.userId,
    staleTime: 30_000,
  });

  // Socket.IO: real-time inbox refresh on new_message.
  useEffect(() => {
    if (!userId) return;
    const socket = getSocket(userId);
    const handler = () => qc.invalidateQueries({ queryKey: ["messages"] });
    socket.on("new_message", handler);
    return () => { socket.off("new_message", handler); };
  }, [userId, qc]);

  // Display mock conversations (real messages will be layered in once
  // the backend is connected and data is seeded).
  const unreadCount = MOCK_CONVERSATIONS.filter((c) => c.unread).length;

  const filtered = MOCK_CONVERSATIONS.filter((c) => {
    const matchSearch =
      c.subject.toLowerCase().includes(search.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase());
    const matchCourse = courseFilter === null || c.courseId === courseFilter;
    return matchSearch && matchCourse;
  });

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
        <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)}>
          <Pencil className="h-4 w-4 mr-1" /> Compose
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[400px]">
        {/* ── Left pane: conversation list ─────────────────── */}
        <Card className="flex flex-col overflow-hidden">
          {/* Search + course filter */}
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
                      <p className="text-xs text-muted-foreground truncate mb-0.5">
                        {conv.participants.join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.lastMessage}
                      </p>
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

        {/* ── Right pane: placeholder when no conversation selected ── */}
        <Card className="hidden md:flex items-center justify-center text-center">
          <div>
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              Select a conversation to read it.
            </p>
          </div>
        </Card>
      </div>

      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
