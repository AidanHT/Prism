import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ForumPost, ForumThread } from "@/types/forum";

export type ForumView = "thread" | "bubble";

interface ForumState {
  // ── View toggle ────────────────────────────────────────────────────────────
  view: ForumView;
  setView: (v: ForumView) => void;

  // ── Thread list ─────────────────────────────────────────────────────────────
  threads: ForumThread[];
  setThreads: (threads: ForumThread[]) => void;
  /** Prepend a thread if it isn't already present (used for WS optimistic add). */
  addThread: (thread: ForumThread) => void;

  // ── Post map (keyed by thread_id) ──────────────────────────────────────────
  posts: Record<string, ForumPost[]>;
  setPosts: (threadId: string, posts: ForumPost[]) => void;
  /** Append a post if it isn't already present (used for WS optimistic add). */
  addPost: (post: ForumPost) => void;

  // ── Active thread (Thread View) ────────────────────────────────────────────
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;

  // ── Active cluster (Bubble View sheet) ────────────────────────────────────
  activeClusterId: string | null;
  setActiveClusterId: (id: string | null) => void;
}

export const useForumStore = create<ForumState>()(
  persist(
    (set) => ({
      view: "thread",
      setView: (view) => set({ view }),

      threads: [],
      setThreads: (threads) => set({ threads }),
      addThread: (thread) =>
        set((s) => ({
          threads: s.threads.some((t) => t.id === thread.id)
            ? s.threads
            : [thread, ...s.threads],
        })),

      posts: {},
      setPosts: (threadId, posts) =>
        set((s) => ({ posts: { ...s.posts, [threadId]: posts } })),
      addPost: (post) =>
        set((s) => {
          const existing = s.posts[post.thread_id] ?? [];
          if (existing.some((p) => p.id === post.id)) return s;
          return {
            posts: {
              ...s.posts,
              [post.thread_id]: [...existing, post],
            },
          };
        }),

      activeThreadId: null,
      setActiveThreadId: (id) => set({ activeThreadId: id }),

      activeClusterId: null,
      setActiveClusterId: (id) => set({ activeClusterId: id }),
    }),
    {
      name: "prism-forum-view",
      // Only persist the view preference — threads/posts are refetched on mount.
      partialize: (state) => ({ view: state.view }),
    },
  ),
);
