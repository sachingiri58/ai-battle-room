import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import aiosqlite
from app.core.database import DB_PATH
from app.core.deps import get_current_user
from app.core.ws_manager import manager

router = APIRouter()


class CreateRoundRequest(BaseModel):
    room_id: str
    challenge: str


@router.post("")
async def create_round(req: CreateRoundRequest, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        room = await (await db.execute("SELECT * FROM rooms WHERE id=?", (req.room_id,))).fetchone()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        if room["host_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Only the host can create rounds")

        # Count existing rounds
        count_row = await (await db.execute("SELECT COUNT(*) as cnt FROM rounds WHERE room_id=?", (req.room_id,))).fetchone()
        round_number = count_row["cnt"] + 1

        round_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO rounds (id, room_id, round_number, challenge) VALUES (?,?,?,?)",
            (round_id, req.room_id, round_number, req.challenge.strip()),
        )
        await db.execute("UPDATE rooms SET status='in_progress' WHERE id=?", (req.room_id,))
        await db.commit()

        round_data = {
            "id": round_id,
            "room_id": req.room_id,
            "round_number": round_number,
            "challenge": req.challenge,
            "status": "pending",
        }
        await manager.broadcast(req.room_id, "round_created", round_data)
        return round_data


@router.post("/{round_id}/start")
async def start_round(round_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        rnd = await (await db.execute("SELECT * FROM rounds WHERE id=?", (round_id,))).fetchone()
        if not rnd:
            raise HTTPException(status_code=404, detail="Round not found")
        room = await (await db.execute("SELECT * FROM rooms WHERE id=?", (rnd["room_id"],))).fetchone()
        if room["host_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Only the host can start rounds")
        if rnd["status"] != "pending":
            raise HTTPException(status_code=400, detail="Round already started")

        await db.execute(
            "UPDATE rounds SET status='active', started_at=datetime('now') WHERE id=?", (round_id,)
        )
        await db.commit()
        await manager.broadcast(rnd["room_id"], "round_started", {"round_id": round_id, "round_number": rnd["round_number"]})
        return {"round_id": round_id, "status": "active"}


@router.post("/{round_id}/end")
async def end_round(round_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        rnd = await (await db.execute("SELECT * FROM rounds WHERE id=?", (round_id,))).fetchone()
        if not rnd:
            raise HTTPException(status_code=404, detail="Round not found")
        room = await (await db.execute("SELECT * FROM rooms WHERE id=?", (rnd["room_id"],))).fetchone()
        if room["host_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Only the host can end rounds")

        await db.execute(
            "UPDATE rounds SET status='scoring', ended_at=datetime('now') WHERE id=?", (round_id,)
        )
        await db.commit()
        await manager.broadcast(rnd["room_id"], "round_ended", {"round_id": round_id})
        return {"round_id": round_id, "status": "scoring"}


@router.get("/{round_id}/submissions")
async def get_round_submissions(round_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        rows = await (await db.execute(
            """
            SELECT s.*, u.display_name,
                   gj.id as job_id, gj.status as job_status, gj.output, gj.error,
                   sc.points, sc.eliminated
            FROM submissions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN generation_jobs gj ON gj.submission_id = s.id
            LEFT JOIN scores sc ON sc.submission_id = s.id
            WHERE s.round_id=?
            ORDER BY s.submitted_at
            """,
            (round_id,),
        )).fetchall()
        return [dict(r) for r in rows]
