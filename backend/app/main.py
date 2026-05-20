import asyncio
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import init_db
from app.api import auth, rooms, rounds, submissions, ws
from app.workers.job_worker import start_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    worker_task = asyncio.create_task(start_worker())
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="Poiro Battle API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
app.include_router(rounds.router, prefix="/api/rounds", tags=["rounds"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["submissions"])
app.include_router(ws.router, prefix="/ws", tags=["websocket"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
