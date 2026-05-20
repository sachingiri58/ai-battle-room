import asyncio
from collections import deque
from typing import Optional

job_queue: asyncio.Queue = asyncio.Queue()


async def enqueue_job(job_id: str):
    await job_queue.put(job_id)
