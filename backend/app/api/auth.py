import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
import aiosqlite
from app.core.database import DB_PATH
from app.core.auth import hash_password, verify_password, create_token
from app.core.deps import get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(req: RegisterRequest):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        existing = await (await db.execute("SELECT id FROM users WHERE email=?", (req.email,))).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        user_id = str(uuid.uuid4())
        pw_hash = hash_password(req.password)
        await db.execute(
            "INSERT INTO users (id, email, password_hash, display_name) VALUES (?,?,?,?)",
            (user_id, req.email.lower().strip(), pw_hash, req.display_name.strip()),
        )
        await db.commit()
        token = create_token(user_id, req.email)
        return {"token": token, "user": {"id": user_id, "email": req.email, "display_name": req.display_name}}


@router.post("/login")
async def login(req: LoginRequest):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await (await db.execute("SELECT * FROM users WHERE email=?", (req.email.lower().strip(),))).fetchone()
        if not row or not verify_password(req.password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_token(row["id"], row["email"])
        return {
            "token": token,
            "user": {"id": row["id"], "email": row["email"], "display_name": row["display_name"]},
        }


@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        row = await (await db.execute("SELECT * FROM users WHERE id=?", (current_user["user_id"],))).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": row["id"], "email": row["email"], "display_name": row["display_name"]}
