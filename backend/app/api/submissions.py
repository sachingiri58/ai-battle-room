import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import aiosqlite
from app.core.database import DB_PATH
from app.core.deps import get_current_user
from app.core.ws_manager import manager
from app.core.job_queue import enqueue_job

router = APIRouter()


class SubmitPromptRequest(BaseModel):
    round_id: str
    prompt: str


class ScoreRequest(BaseModel):
    submission_id: str
    points: int
    eliminated: bool = False


@router.post("")
async def submit_prompt(req: SubmitPromptRequest, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        rnd = await (await db.execute("SELECT * FROM rounds WHERE id=?", (req.round_id,))).fetchone()
        if not rnd:
            raise HTTPException(status_code=404, detail="Round not found")
        if rnd["status"] != "active":
            raise HTTPException(status_code=400, detail="Round is not accepting submissions")

        room = await (await db.execute("SELECT * FROM rooms WHERE id=?", (rnd["room_id"],))).fetchone()

        # Host cannot submit as contestant
        if room["host_id"] == current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Host cannot submit as a contestant")

        # Check participant is in room
        in_room = await (await db.execute(
            "SELECT 1 FROM room_participants WHERE room_id=? AND user_id=?",
            (rnd["room_id"], current_user["user_id"]),
        )).fetchone()
        if not in_room:
            raise HTTPException(status_code=403, detail="You are not in this room")

        # One submission per round per user
        existing = await (await db.execute(
            "SELECT id FROM submissions WHERE round_id=? AND user_id=?",
            (req.round_id, current_user["user_id"]),
        )).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="You have already submitted for this round")

        if not req.prompt.strip():
            raise HTTPException(status_code=400, detail="Prompt cannot be empty")

        submission_id = str(uuid.uuid4())
        job_id = str(uuid.uuid4())

        await db.execute(
            "INSERT INTO submissions (id, round_id, user_id, prompt) VALUES (?,?,?,?)",
            (submission_id, req.round_id, current_user["user_id"], req.prompt.strip()),
        )
        await db.execute(
            "INSERT INTO generation_jobs (id, submission_id) VALUES (?,?)",
            (job_id, submission_id),
        )
        await db.commit()

        user = await (await db.execute("SELECT display_name FROM users WHERE id=?", (current_user["user_id"],))).fetchone()

        # Broadcast submission received
        await manager.broadcast(rnd["room_id"], "submission_received", {
            "submission_id": submission_id,
            "user_id": current_user["user_id"],
            "display_name": user["display_name"],
            "prompt": req.prompt,
            "job_id": job_id,
            "job_status": "queued",
        })

        # Enqueue async job (non-blocking)
        await enqueue_job(job_id)

        return {"submission_id": submission_id, "job_id": job_id, "status": "queued"}


@router.post("/{submission_id}/retry")
async def retry_submission(submission_id: str, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        job = await (await db.execute(
            "SELECT * FROM generation_jobs WHERE submission_id=?", (submission_id,)
        )).fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job["status"] != "failed":
            raise HTTPException(status_code=400, detail="Can only retry failed jobs")

        sub = await (await db.execute("SELECT * FROM submissions WHERE id=?", (submission_id,))).fetchone()
        if sub["user_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Not your submission")

        job_id = str(uuid.uuid4())
        await db.execute("DELETE FROM generation_jobs WHERE submission_id=?", (submission_id,))
        await db.execute(
            "INSERT INTO generation_jobs (id, submission_id) VALUES (?,?)",
            (job_id, submission_id),
        )
        await db.commit()
        await enqueue_job(job_id)
        return {"job_id": job_id, "status": "queued"}


@router.post("/score")
async def score_submission(req: ScoreRequest, current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        sub = await (await db.execute("SELECT * FROM submissions WHERE id=?", (req.submission_id,))).fetchone()
        if not sub:
            raise HTTPException(status_code=404, detail="Submission not found")

        rnd = await (await db.execute("SELECT * FROM rounds WHERE id=?", (sub["round_id"],))).fetchone()
        room = await (await db.execute("SELECT * FROM rooms WHERE id=?", (rnd["room_id"],))).fetchone()
        if room["host_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Only the host can score submissions")

        existing = await (await db.execute(
            "SELECT id FROM scores WHERE submission_id=?", (req.submission_id,)
        )).fetchone()
        if existing:
            await db.execute(
                "UPDATE scores SET points=?, eliminated=?, scored_at=datetime('now') WHERE submission_id=?",
                (req.points, 1 if req.eliminated else 0, req.submission_id),
            )
        else:
            score_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO scores (id, round_id, user_id, submission_id, points, eliminated) VALUES (?,?,?,?,?,?)",
                (score_id, sub["round_id"], sub["user_id"], req.submission_id, req.points, 1 if req.eliminated else 0),
            )
        await db.commit()

        await manager.broadcast(room["id"], "score_updated", {
            "submission_id": req.submission_id,
            "user_id": sub["user_id"],
            "points": req.points,
            "eliminated": req.eliminated,
        })
        return {"scored": True}
