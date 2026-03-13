"""Socket.IO real-time server for Prism.

Mounted on the FastAPI ASGI app via ``create_socket_app`` in main.py.
Clients authenticate by passing ``auth: { userId }`` during the handshake.
On connect each client joins a personal room ``user:<userId>`` so events
can be targeted to a specific user.
"""
from __future__ import annotations

import socketio

# AsyncServer – compatible with any ASGI runner (uvicorn, hypercorn).
sio: socketio.AsyncServer = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",  # Tighten at API Gateway in production.
    logger=False,
    engineio_logger=False,
)


def create_socket_app(fastapi_app: object) -> socketio.ASGIApp:
    """Wrap the FastAPI ASGI app with the Socket.IO ASGI layer."""
    return socketio.ASGIApp(sio, other_asgi_app=fastapi_app)


@sio.event
async def connect(  # type: ignore[no-untyped-def]
    sid: str,
    environ: dict,  # type: ignore[type-arg]
    auth: dict | None = None,  # type: ignore[type-arg]
) -> None:
    """Join a personal room on connection for targeted push events."""
    user_id = (auth or {}).get("userId", "")
    if user_id:
        await sio.enter_room(sid, f"user:{user_id}")


@sio.event
async def disconnect(sid: str) -> None:  # type: ignore[no-untyped-def]
    pass


# ── Helper emitters (called from routers) ─────────────────────────────────────


async def emit_new_message(
    recipient_id: str,
    payload: dict,  # type: ignore[type-arg]
) -> None:
    """Push a ``new_message`` event to a specific user's personal room."""
    await sio.emit("new_message", payload, room=f"user:{recipient_id}")


async def emit_new_notification(
    user_id: str,
    payload: dict,  # type: ignore[type-arg]
) -> None:
    """Push a ``new_notification`` event to a specific user."""
    await sio.emit("new_notification", payload, room=f"user:{user_id}")
