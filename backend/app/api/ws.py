from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.ws_manager import manager
from app.core.auth import verify_token

router = APIRouter()


@router.websocket("/room/{room_id}")
async def room_websocket(websocket: WebSocket, room_id: str, token: str = Query(...)):
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=4001)
        return

    user_id = payload["sub"]
    await manager.connect(websocket, room_id, user_id)
    try:
        while True:
            # Keep alive — client can send ping
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
