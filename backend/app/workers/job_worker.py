import asyncio
import json
import uuid
import aiosqlite
from datetime import datetime

from app.core.job_queue import job_queue
from app.core.database import DB_PATH
from app.core.ws_manager import manager
from app.services.ai_provider import generate_content


async def process_job(job_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Mark as running
        await db.execute(
            "UPDATE generation_jobs SET status='running', started_at=datetime('now') WHERE id=?",
            (job_id,),
        )
        await db.commit()

        # Fetch job + submission + round + room info
        row = await db.execute_fetchall(
            """
            SELECT gj.id as job_id, gj.submission_id,
                   s.prompt, s.user_id, s.round_id,
                   r.room_id, r.challenge,
                   u.display_name
            FROM generation_jobs gj
            JOIN submissions s ON s.id = gj.submission_id
            JOIN rounds r ON r.id = s.round_id
            JOIN users u ON u.id = s.user_id
            WHERE gj.id = ?
            """,
            (job_id,),
        )
        if not row:
            return
        job = row[0]
        room_id = job["room_id"]

        # Broadcast: job running
        await manager.broadcast(room_id, "job_update", {
            "job_id": job_id,
            "submission_id": job["submission_id"],
            "user_id": job["user_id"],
            "display_name": job["display_name"],
            "status": "running",
        })

        try:
            output = await generate_content(job["prompt"], job["challenge"])

            await db.execute(
                "UPDATE generation_jobs SET status='completed', output=?, completed_at=datetime('now') WHERE id=?",
                (output, job_id),
            )
            await db.commit()

            await manager.broadcast(room_id, "job_update", {
                "job_id": job_id,
                "submission_id": job["submission_id"],
                "user_id": job["user_id"],
                "display_name": job["display_name"],
                "status": "completed",
                "output": output,
            })

        except Exception as e:
            error_msg = str(e)
            await db.execute(
                "UPDATE generation_jobs SET status='failed', error=?, completed_at=datetime('now') WHERE id=?",
                (error_msg, job_id),
            )
            await db.commit()

            await manager.broadcast(room_id, "job_update", {
                "job_id": job_id,
                "submission_id": job["submission_id"],
                "user_id": job["user_id"],
                "display_name": job["display_name"],
                "status": "failed",
                "error": error_msg,
            })


async def start_worker():
    """Background worker that processes jobs from the queue."""
    while True:
        try:
            job_id = await asyncio.wait_for(job_queue.get(), timeout=1.0)
            # Run job without blocking the worker loop
            asyncio.create_task(process_job(job_id))
        except asyncio.TimeoutError:
            continue
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Worker error: {e}")
