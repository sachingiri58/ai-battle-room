import asyncio
import json
from collections import defaultdict
from fastapi import WebSocket
from typing import Dict, Set


class ConnectionManager:
    def __init__(self):
        # room_id -> set of (websocket, user_id)
        self._rooms: Dict[str, list] = defaultdict(list)

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str):
        await websocket.accept()
        self._rooms[room_id].append({"ws": websocket, "user_id": user_id})

    def disconnect(self, websocket: WebSocket, room_id: str):
        self._rooms[room_id] = [
            c for c in self._rooms[room_id] if c["ws"] is not websocket
        ]

    async def broadcast(self, room_id: str, event_type: str, payload: dict):
        message = json.dumps({"type": event_type, "payload": payload})
        dead = []
        for conn in list(self._rooms.get(room_id, [])):
            try:
                await conn["ws"].send_text(message)
            except Exception:
                dead.append(conn)
        for c in dead:
            if c in self._rooms[room_id]:
                self._rooms[room_id].remove(c)

    async def send_to_user(self, room_id: str, user_id: str, event_type: str, payload: dict):
        message = json.dumps({"type": event_type, "payload": payload})
        for conn in list(self._rooms.get(room_id, [])):
            if conn["user_id"] == user_id:
                try:
                    await conn["ws"].send_text(message)
                except Exception:
                    pass

    def get_connected_users(self, room_id: str) -> list:
        return [c["user_id"] for c in self._rooms.get(room_id, [])]


manager = ConnectionManager()
