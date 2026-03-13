"use client";

/**
 * SocketProvider – initialises the Socket.IO connection once per session and
 * wires real-time events into the TanStack Query cache and notification store.
 *
 * Mount this inside QueryProvider so ``useQueryClient`` is available.
 * It renders no DOM of its own.
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { notificationApi } from "@/lib/api";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { MOCK_NOTIFICATIONS } from "@/lib/mockData";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const qc = useQueryClient();

  // Seed the initial unread count from API (or fall back to mock data).
  useEffect(() => {
    if (!user) return;
    const opts = { userId: user.id };
    notificationApi
      .list(opts)
      .then((notifs) => {
        setUnreadCount(notifs.filter((n) => !n.is_read).length);
      })
      .catch(() => {
        // Backend unavailable – use mock data count for dev.
        setUnreadCount(MOCK_NOTIFICATIONS.filter((n) => !n.read).length);
      });
  }, [user, setUnreadCount]);

  // Establish the Socket.IO connection and register event listeners.
  useEffect(() => {
    if (!user) return;

    const socket = getSocket(user.id);

    socket.on("new_message", () => {
      // Refresh the inbox message list.
      qc.invalidateQueries({ queryKey: ["messages"] });
    });

    socket.on("new_notification", () => {
      incrementUnread();
      qc.invalidateQueries({ queryKey: ["notifications"] });
    });

    return () => {
      socket.off("new_message");
      socket.off("new_notification");
      disconnectSocket();
    };
  }, [user, incrementUnread, qc]);

  return <>{children}</>;
}
