from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket


class MessagingConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        connections = self._connections.get(user_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: dict[str, object]) -> None:
        stale: list[WebSocket] = []
        for websocket in list(self._connections.get(user_id, set())):
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                stale.append(websocket)

        for websocket in stale:
            self.disconnect(user_id, websocket)


messaging_manager = MessagingConnectionManager()
