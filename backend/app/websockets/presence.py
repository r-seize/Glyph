import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.security import decode_access_token
from app.core.exceptions import UnauthorizedError
from app.database import SessionLocal
from app.models.user import User
from app.websockets.manager import manager, ConnectedUser

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/doc/{project_id}/{commit_sha}/{file_path:path}")
async def doc_presence(
    websocket: WebSocket,
    project_id: str,
    commit_sha: str,
    file_path: str,
    token: str = Query(...),
) -> None:
    # Authenticate before accepting the connection
    try:
        token_data = decode_access_token(token)
    except UnauthorizedError:
        await websocket.close(code=4001)
        return

    db = SessionLocal()
    try:
        user: User | None = db.get(User, token_data.user_id)
    finally:
        db.close()

    if not user or not user.is_active:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    room_id = f"doc:{project_id}:{commit_sha}:{file_path}"
    connected = ConnectedUser(
        user_id=user.id,
        username=user.username,
        avatar_url=user.avatar_url,
        websocket=websocket,
    )

    await manager.connect(room_id, connected)
    logger.info("WS joined room=%s user=%s", room_id, user.username)

    _RELAY_EVENTS = {"doc-update", "invalidate"}

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
                event = msg.get("event")
                if event == "cursor":
                    # Server injects user identity so clients can't spoof each other
                    await manager.broadcast(room_id, {
                        "event": "cursor",
                        "user": {
                            "user_id": connected.user_id,
                            "username": connected.username,
                            "avatar_url": connected.avatar_url,
                        },
                        "from": msg.get("from"),
                        "to": msg.get("to"),
                    }, exclude=websocket)
                elif event in _RELAY_EVENTS:
                    await manager.broadcast(room_id, msg, exclude=websocket)
            except (json.JSONDecodeError, TypeError, AttributeError):
                pass
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(room_id, websocket)
        logger.info("WS left  room=%s user=%s", room_id, user.username)
