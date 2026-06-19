from dataclasses import dataclass, field
from typing import Dict, List
from fastapi import WebSocket


@dataclass
class ConnectedUser:
    user_id: str
    username: str
    avatar_url: str | None
    websocket: WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._rooms: Dict[str, List[ConnectedUser]] = {}

    def _room(self, room_id: str) -> List[ConnectedUser]:
        return self._rooms.setdefault(room_id, [])

    async def connect(self, room_id: str, user: ConnectedUser) -> None:
        room = self._room(room_id)
        room.append(user)

        # Send the current room members to the newcomer (everyone except themselves)
        await user.websocket.send_json({
            "event": "room-users",
            "users": [_serialize(u) for u in room if u.websocket is not user.websocket],
        })

        # Notify all others that this user joined
        await self.broadcast(room_id, {
            "event": "user-joined",
            "user": _serialize(user),
        }, exclude=user.websocket)

    async def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return

        user = next((u for u in room if u.websocket is websocket), None)
        if user:
            room.remove(user)
            await self.broadcast(room_id, {
                "event": "user-left",
                "user_id": user.user_id,
            })

        if not room:
            del self._rooms[room_id]

    async def broadcast(
        self,
        room_id: str,
        message: dict,
        exclude: WebSocket | None = None,
    ) -> None:
        room = self._rooms.get(room_id, [])
        dead: list[ConnectedUser] = []
        for user in room:
            if user.websocket is exclude:
                continue
            try:
                await user.websocket.send_json(message)
            except Exception:
                dead.append(user)
        for u in dead:
            room.remove(u)


def _serialize(user: ConnectedUser) -> dict:
    return {
        "user_id": user.user_id,
        "username": user.username,
        "avatar_url": user.avatar_url,
    }


manager = ConnectionManager()
