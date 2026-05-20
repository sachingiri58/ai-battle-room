import aiosqlite
import os

DB_PATH = os.getenv("DB_PATH", "./poiro.db")


async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.executescript("""
            PRAGMA journal_mode=WAL;

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                host_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'waiting',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (host_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS room_participants (
                room_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                joined_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (room_id, user_id),
                FOREIGN KEY (room_id) REFERENCES rooms(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS rounds (
                id TEXT PRIMARY KEY,
                room_id TEXT NOT NULL,
                round_number INTEGER NOT NULL,
                challenge TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                started_at TEXT,
                ended_at TEXT,
                FOREIGN KEY (room_id) REFERENCES rooms(id)
            );

            CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY,
                round_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                prompt TEXT NOT NULL,
                submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (round_id) REFERENCES rounds(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS generation_jobs (
                id TEXT PRIMARY KEY,
                submission_id TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'queued',
                output TEXT,
                error TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                started_at TEXT,
                completed_at TEXT,
                FOREIGN KEY (submission_id) REFERENCES submissions(id)
            );

            CREATE TABLE IF NOT EXISTS scores (
                id TEXT PRIMARY KEY,
                round_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                submission_id TEXT NOT NULL,
                points INTEGER NOT NULL DEFAULT 0,
                eliminated INTEGER NOT NULL DEFAULT 0,
                scored_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (round_id) REFERENCES rounds(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (submission_id) REFERENCES submissions(id)
            );

            CREATE TABLE IF NOT EXISTS room_events (
                id TEXT PRIMARY KEY,
                room_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (room_id) REFERENCES rooms(id)
            );
        """)
        await db.commit()
