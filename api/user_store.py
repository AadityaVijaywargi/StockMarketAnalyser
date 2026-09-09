"""
Store for invite-created user accounts and invites.

The single admin account stays defined in settings/.env (see api/auth.py);
this store only holds accounts that signed up through an admin-issued
invite code, plus the invite codes themselves.

Backed by Postgres (api/db.py) when settings.DATABASE_URL is configured -
otherwise falls back to a flat JSON file. The JSON file lives on local
container disk, which most PaaS free tiers wipe on every redeploy
(confirmed live on Render), so it's a reasonable default for local dev /
before a database is set up, but not for real invited users.
"""
import json
import os
import secrets
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from config.settings import settings
from api import db

_LOCK = threading.Lock()
_STORE_PATH = os.path.join(settings.STORAGE_BASE, "users.json")


class InviteError(Exception):
    pass


class UsernameTakenError(Exception):
    pass


# ---------------------------------------------------------------------------
# JSON file backend (default, used when DATABASE_URL is not set)
# ---------------------------------------------------------------------------

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


def _json_get_user(username: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        return _load()["users"].get(username)


def _json_create_invite(created_by: str, email: str) -> str:
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


def _json_list_invites() -> Dict[str, Any]:
    with _LOCK:
        return _load()["invites"]


def _json_revoke_invite(code: str) -> bool:
    with _LOCK:
        data = _load()
        if code in data["invites"] and not data["invites"][code]["used"]:
            del data["invites"][code]
            _save(data)
            return True
        return False


def _json_redeem_invite_and_create_user(invite_code: str, email: str, username: str, password_hash: str) -> None:
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


# ---------------------------------------------------------------------------
# Postgres backend (used when settings.DATABASE_URL is set)
# ---------------------------------------------------------------------------

def _db_get_user(username: str) -> Optional[Dict[str, Any]]:
    with db.get_cursor() as cur:
        cur.execute("SELECT * FROM users WHERE username = %s", (username,))
        row = cur.fetchone()
        return dict(row) if row else None


def _db_create_invite(created_by: str, email: str) -> str:
    code = secrets.token_urlsafe(9)
    with db.get_cursor() as cur:
        cur.execute(
            "INSERT INTO invites (code, email, created_by, created_at, used, used_by) "
            "VALUES (%s, %s, %s, %s, FALSE, NULL)",
            (code, email.strip().lower(), created_by, datetime.now(timezone.utc).isoformat()),
        )
    return code


def _db_list_invites() -> Dict[str, Any]:
    with db.get_cursor() as cur:
        cur.execute("SELECT * FROM invites ORDER BY created_at")
        rows = cur.fetchall()
        return {row["code"]: {k: v for k, v in row.items() if k != "code"} for row in rows}


def _db_revoke_invite(code: str) -> bool:
    with db.get_cursor() as cur:
        cur.execute("DELETE FROM invites WHERE code = %s AND used = FALSE", (code,))
        return cur.rowcount > 0


def _db_redeem_invite_and_create_user(invite_code: str, email: str, username: str, password_hash: str) -> None:
    with db.get_cursor() as cur:
        cur.execute("SELECT * FROM invites WHERE code = %s", (invite_code,))
        invite = cur.fetchone()
        if not invite:
            raise InviteError("Invalid invite code")
        if invite["used"]:
            raise InviteError("This invite code has already been used")
        if invite.get("email") and invite["email"] != email.strip().lower():
            raise InviteError("This invite was issued to a different email address")

        cur.execute("SELECT 1 FROM users WHERE username = %s", (username,))
        if username == settings.ADMIN_USERNAME or cur.fetchone():
            raise UsernameTakenError("That username is already taken")

        cur.execute(
            "INSERT INTO users (username, password_hash, role, email, created_at, invited_by) "
            "VALUES (%s, %s, 'user', %s, %s, %s)",
            (username, password_hash, email.strip().lower(), datetime.now(timezone.utc).isoformat(), invite["created_by"]),
        )
        cur.execute(
            "UPDATE invites SET used = TRUE, used_by = %s WHERE code = %s",
            (username, invite_code),
        )


# ---------------------------------------------------------------------------
# Public API - dispatches to Postgres when configured, JSON file otherwise
# ---------------------------------------------------------------------------

def get_user(username: str) -> Optional[Dict[str, Any]]:
    return _db_get_user(username) if db.is_configured() else _json_get_user(username)


def create_invite(created_by: str, email: str) -> str:
    return _db_create_invite(created_by, email) if db.is_configured() else _json_create_invite(created_by, email)


def list_invites() -> Dict[str, Any]:
    return _db_list_invites() if db.is_configured() else _json_list_invites()


def revoke_invite(code: str) -> bool:
    return _db_revoke_invite(code) if db.is_configured() else _json_revoke_invite(code)


def redeem_invite_and_create_user(invite_code: str, email: str, username: str, password_hash: str) -> None:
    if db.is_configured():
        _db_redeem_invite_and_create_user(invite_code, email, username, password_hash)
    else:
        _json_redeem_invite_and_create_user(invite_code, email, username, password_hash)
