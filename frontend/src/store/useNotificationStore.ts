import { create } from "zustand";

interface NotificationState {
  /** Number of unread notifications (drives the TopNav bell badge). */
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
  incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
}));
