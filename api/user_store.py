"""
Lightweight JSON-backed store for invite-created user accounts.

The single admin account stays defined in settings/.env (see api/auth.py);
this store only holds accounts that signed up through an admin-issued
invite code, plus the invite codes themselves. Kept as a flat JSON file
rather than a real database since account volume here is expected to stay
tiny (friends/family, not the public).
"""
import json
import os
import secrets
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from config.settings import settings

_LOCK = threading.Lock()
_STORE_PATH = os.path.join(settings.STORAGE_BASE, "users.json")


def _empty_store() -> Dict[str, Any]:
    return {"users": {}, "invites": {}}


def _load() -> Dict[str, Any]:
    if not os.path.exists(_STORE_PATH):
        return _empty_store()
    with open(_STORE_PATH, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return _empty_store()
    data.setdefault("users", {})
    data.setdefault("invites", {})
    return data


def _save(data: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(_STORE_PATH), exist_ok=True)
    tmp_path = _STORE_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, _STORE_PATH)


def get_user(username: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        return _load()["users"].get(username)


def create_invite(created_by: str, email: str) -> str:
    code = secrets.token_urlsafe(9)
    with _LOCK:
        data = _load()
        data["invites"][code] = {
            "email": email.strip().lower(),
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "used": False,
            "used_by": None,
        }
        _save(data)
    return code


def list_invites() -> Dict[str, Any]:
    with _LOCK:
        return _load()["invites"]


def revoke_invite(code: str) -> bool:
    with _LOCK:
        data = _load()
        if code in data["invites"] and not data["invites"][code]["used"]:
            del data["invites"][code]
            _save(data)
            return True
        return False


class InviteError(Exception):
    pass


class UsernameTakenError(Exception):
    pass


def redeem_invite_and_create_user(invite_code: str, email: str, username: str, password_hash: str) -> None:
    """Atomically validates the invite code (and that it was issued to this
    email) and creates the user, or raises."""
    with _LOCK:
        data = _load()
        invite = data["invites"].get(invite_code)
        if not invite:
            raise InviteError("Invalid invite code")
        if invite["used"]:
            raise InviteError("This invite code has already been used")
        if invite.get("email") and invite["email"] != email.strip().lower():
            raise InviteError("This invite was issued to a different email address")
        if username == settings.ADMIN_USERNAME or username in data["users"]:
            raise UsernameTakenError("That username is already taken")

        data["users"][username] = {
            "password_hash": password_hash,
            "role": "user",
            "email": email.strip().lower(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "invited_by": invite["created_by"],
        }
        invite["used"] = True
        invite["used_by"] = username
        _save(data)
