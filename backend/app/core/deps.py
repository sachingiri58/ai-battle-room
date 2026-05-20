from fastapi import Depends, HTTPException, Header
from typing import Optional
from app.core.auth import verify_token


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"user_id": payload["sub"], "email": payload["email"]}


async def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None
