/**
 * Socket.IO singleton client.
 *
 * Call ``getSocket(userId)`` once (e.g. in SocketProvider) to establish the
 * connection.  The same Socket instance is returned on subsequent calls so
 * there is always exactly one connection per browser tab.
 *
 * NOTE: This module uses browser-only APIs.  Import it only inside
 * ``"use client"`` components or inside ``useEffect`` callbacks.
 */
import { io, type Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

let _socket: Socket | null = null;

/** Return (or lazily create) the singleton Socket.IO connection. */
export function getSocket(userId: string): Socket {
  if (!_socket) {
    _socket = io(SOCKET_URL, {
      auth: { userId },
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return _socket;
}

/** Disconnect and clear the singleton (call on sign-out). */
export function disconnectSocket(): void {
  _socket?.disconnect();
  _socket = null;
}
