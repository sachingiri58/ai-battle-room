import os
import hashlib
import hmac
import uuid
import json
import base64
import time
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("SECRET_KEY", "poiro-secret-key-change-in-production")


def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    h = hmac.new(SECRET_KEY.encode(), (salt + password).encode(), hashlib.sha256).hexdigest()
    return f"{salt}:{h}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, h = password_hash.split(":", 1)
        expected = hmac.new(SECRET_KEY.encode(), (salt + password).encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(h, expected)
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": int(time.time()) + 7 * 24 * 3600,
    }
    data = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    sig = hmac.new(SECRET_KEY.encode(), data.encode(), hashlib.sha256).hexdigest()
    return f"{data}.{sig}"


def verify_token(token: str) -> dict | None:
    try:
        data, sig = token.rsplit(".", 1)
        expected_sig = hmac.new(SECRET_KEY.encode(), data.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(data.encode()).decode())
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None
