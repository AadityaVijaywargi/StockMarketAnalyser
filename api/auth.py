"""Admin authentication: password hashing and JWT session tokens."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from config.settings import settings

PBKDF2_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    """Hashes a password as 'salt$hash', both hex-encoded."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, salted_hash: str) -> bool:
    if not salted_hash or "$" not in salted_hash:
        return False
    salt, expected_hex = salted_hash.split("$", 1)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return hmac.compare_digest(digest.hex(), expected_hex)


def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRY_HOURS)
    payload = {"sub": username, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    """Returns the username encoded in a valid token, raises jwt exceptions otherwise."""
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    return payload["sub"]
