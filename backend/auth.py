"""Password hashing (PBKDF2) + JWT login tokens."""
import hashlib
import hmac
import os
import time

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import db

# Set your own secret in production:  set RESEARCHAI_SECRET=some-long-random-text
SECRET = os.environ.get("RESEARCHAI_SECRET", "dev-only-secret-change-me-0123456789abcdef")
TOKEN_HOURS = 12
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return salt.hex() + ":" + dk.hex()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split(":")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 200_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def create_token(user_id: int, username: str) -> str:
    payload = {"sub": str(user_id), "username": username, "exp": int(time.time()) + TOKEN_HOURS * 3600}
    return jwt.encode(payload, SECRET, algorithm="HS256")


def current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)):
    if creds is None:
        raise HTTPException(401, "Please log in.")
    try:
        data = jwt.decode(creds.credentials, SECRET, algorithms=["HS256"])
        user = db.get_user_by_id(int(data["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(401, "Session expired. Please log in again.")
    if not user:
        raise HTTPException(401, "User not found.")
    return {"id": user["id"], "username": user["username"]}
