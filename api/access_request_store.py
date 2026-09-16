"""
Store for access requests submitted from the public marketing page.

Mirrors api/user_store.py: Postgres when settings.DATABASE_URL is set,
otherwise a flat JSON file under storage/. The JSON fallback lives on local
container disk, which free PaaS tiers wipe on redeploy - acceptable for
local development, but an access request lost that way is a prospective
user who never hears back, so production should have DATABASE_URL set.

Deduplication is by email: someone submitting twice updates their existing
pending request rather than creating a second one, so a keen applicant
cannot fill the review queue.
"""
import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config.settings import settings
from api import db

_LOCK = threading.Lock()
_STORE_PATH = os.path.join(settings.STORAGE_BASE, "access_requests.json")

# Anything longer is a bot pasting an essay, not a person asking for access.
MAX_MESSAGE_LENGTH = 2000
MAX_EMAIL_LENGTH = 254  # RFC 5321 maximum


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# JSON file backend (default, used when DATABASE_URL is not set)
# ---------------------------------------------------------------------------

def _load() -> Dict[str, Any]:
    if not os.path.exists(_STORE_PATH):
        return {"requests": {}}
    try:
        with open(_STORE_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (json.JSONDecodeError, OSError):
        # A truncated file (e.g. killed mid-write) should not take the public
        # endpoint down; start clean rather than 500 on every submission.
        return {"requests": {}}
    data.setdefault("requests", {})
    return data


def _save(data: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(_STORE_PATH), exist_ok=True)
    tmp = f"{_STORE_PATH}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
    os.replace(tmp, _STORE_PATH)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def record_request(email: str, message: str = "", source_ip: Optional[str] = None) -> str:
    """
    Persists an access request and returns its id.

    Re-submitting the same email updates the existing row instead of adding
    another, so the id returned may belong to an earlier request.
    """
    email = email.strip().lower()[:MAX_EMAIL_LENGTH]
    message = (message or "").strip()[:MAX_MESSAGE_LENGTH]
    created_at = _now()

    if db.is_configured():
        with db.get_cursor() as cur:
            cur.execute("SELECT id FROM access_requests WHERE email = %s", (email,))
            row = cur.fetchone()
            if row:
                cur.execute(
                    "UPDATE access_requests SET message = %s, created_at = %s, source_ip = %s WHERE id = %s",
                    (message, created_at, source_ip, row["id"]),
                )
                return row["id"]
            request_id = uuid.uuid4().hex
            cur.execute(
                "INSERT INTO access_requests (id, email, message, created_at, source_ip, status)"
                " VALUES (%s, %s, %s, %s, %s, 'pending')",
                (request_id, email, message, created_at, source_ip),
            )
            return request_id

    with _LOCK:
        data = _load()
        for request_id, existing in data["requests"].items():
            if existing.get("email") == email:
                existing.update(message=message, created_at=created_at, source_ip=source_ip)
                _save(data)
                return request_id
        request_id = uuid.uuid4().hex
        data["requests"][request_id] = {
            "email": email,
            "message": message,
            "created_at": created_at,
            "source_ip": source_ip,
            "status": "pending",
        }
        _save(data)
        return request_id


def list_requests() -> List[Dict[str, Any]]:
    """All access requests, newest first. Admin-only - never exposed publicly."""
    if db.is_configured():
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM access_requests ORDER BY created_at DESC")
            return [dict(row) for row in cur.fetchall()]

    with _LOCK:
        data = _load()
        rows = [{"id": rid, **info} for rid, info in data["requests"].items()]
    return sorted(rows, key=lambda r: r.get("created_at") or "", reverse=True)


def delete_request(request_id: str) -> bool:
    """Removes a request. Returns False when the id was not found."""
    if db.is_configured():
        with db.get_cursor() as cur:
            cur.execute("DELETE FROM access_requests WHERE id = %s", (request_id,))
            return cur.rowcount > 0

    with _LOCK:
        data = _load()
        if request_id not in data["requests"]:
            return False
        del data["requests"][request_id]
        _save(data)
        return True
