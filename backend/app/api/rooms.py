import uuid
import random
import string
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import aiosqlite
from app.core.database import DB_PATH
from app.core.deps import get_current_user
from app.core.ws_manager import manager

router = APIRouter()


def generate_room_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


class CreateRoomRequest(BaseModel):
    title: str


@router.post("")
async def create_room(req: CreateRoomRequest, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        room_id = str(uuid.uuid4())
        code = generate_room_code()
        # Ensure unique code
        while await (await db.execute("SELECT id FROM rooms WHERE code=?", (code,))).fetchone():
            code = generate_room_code()

        await db.execute(
            "INSERT INTO rooms (id, code, title, host_id) VALUES (?,?,?,?)",
            (room_id, code, req.title.strip(), current_user["user_id"]),
        )
        # Host auto-joins
        await db.execute(
            "INSERT INTO room_participants (room_id, user_id) VALUES (?,?)",
            (room_id, current_user["user_id"]),
        )
        await db.commit()
        return {"id": room_id, "code": code, "title": req.title, "host_id": current_user["user_id"], "status": "waiting"}


@router.get("/{room_id_or_code}")
async def get_room(room_id_or_code: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await (await db.execute(
            "SELECT * FROM rooms WHERE id=? OR code=?",
            (room_id_or_code, room_id_or_code.upper()),
        )).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Room not found")

        room = dict(row)
        participants = await (await db.execute(
            """SELECT u.id, u.display_name, u.email FROM room_participants rp
               JOIN users u ON u.id = rp.user_id WHERE rp.room_id=?""",
            (room["id"],),
        )).fetchall()

        rounds = await (await db.execute(
            "SELECT * FROM rounds WHERE room_id=? ORDER BY round_number",
            (room["id"],),
        )).fetchall()

        return {
            **room,
            "participants": [dict(p) for p in participants],
            "rounds": [dict(r) for r in rounds],
        }


@router.post("/{room_id}/join")
async def join_room(room_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        room = await (await db.execute("SELECT * FROM rooms WHERE id=? OR code=?", (room_id, room_id.upper()))).fetchone()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        if room["status"] not in ("waiting", "in_progress"):
            raise HTTPException(status_code=400, detail="Room is not accepting new participants")

        existing = await (await db.execute(
            "SELECT 1 FROM room_participants WHERE room_id=? AND user_id=?",
            (room["id"], current_user["user_id"]),
        )).fetchone()
        if not existing:
            await db.execute(
                "INSERT INTO room_participants (room_id, user_id) VALUES (?,?)",
                (room["id"], current_user["user_id"]),
            )
            await db.commit()

            # Broadcast new participant
            user = await (await db.execute("SELECT display_name FROM users WHERE id=?", (current_user["user_id"],))).fetchone()
            await manager.broadcast(room["id"], "participant_joined", {
                "user_id": current_user["user_id"],
                "display_name": user["display_name"],
            })

        return {"room_id": room["id"], "joined": True}
