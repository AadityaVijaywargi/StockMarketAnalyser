"""
Generic per-user JSON key/value store. Backs cloud-synced features
(watchlist, trades, price alerts, etc.) so a logged-in user's data follows
them across devices instead of living only in that browser's localStorage.

Backed by Postgres (api/db.py, table user_data) when settings.DATABASE_URL is
configured - otherwise falls back to one JSON file per user under
storage/user_data/<username>.json. Same caveat as api/user_store.py: that
file lives on local container disk, which PaaS free tiers (e.g. Render) wipe
on every redeploy, so production should run with DATABASE_URL set.
"""
import json
import os
import re
import threading
from typing import Any, Dict

from config.settings import settings
from api import db

_LOCK = threading.Lock()
_DATA_DIR = os.path.join(settings.STORAGE_BASE, "user_data")
_SAFE_NAME = re.compile(r"^[A-Za-z0-9_.-]+$")


def _validate_username(username: str) -> None:
    if not _SAFE_NAME.match(username):
        raise ValueError("Invalid username")


# ---------------------------------------------------------------------------
# JSON file backend (default, used when DATABASE_URL is not set)
# ---------------------------------------------------------------------------

def _user_path(username: str) -> str:
    _validate_username(username)
    return os.path.join(_DATA_DIR, f"{username}.json")


def _load_user(username: str) -> Dict[str, Any]:
    path = _user_path(username)
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}


def _save_user(username: str, data: Dict[str, Any]) -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    path = _user_path(username)
    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp_path, path)


def _json_get_value(username: str, key: str) -> Any:
    with _LOCK:
        return _load_user(username).get(key)


def _json_set_value(username: str, key: str, value: Any) -> None:
    with _LOCK:
        data = _load_user(username)
        data[key] = value
        _save_user(username, data)


def _json_get_all(username: str) -> Dict[str, Any]:
    with _LOCK:
        return _load_user(username)


# ---------------------------------------------------------------------------
# Postgres backend (used when settings.DATABASE_URL is set)
# ---------------------------------------------------------------------------

def _db_get_value(username: str, key: str) -> Any:
    _validate_username(username)
    with db.get_cursor() as cur:
        cur.execute("SELECT value FROM user_data WHERE username = %s AND key = %s", (username, key))
        row = cur.fetchone()
        return row["value"] if row else None


def _db_set_value(username: str, key: str, value: Any) -> None:
    from psycopg2.extras import Json
    _validate_username(username)
    with db.get_cursor() as cur:
        cur.execute(
            "INSERT INTO user_data (username, key, value, updated_at) VALUES (%s, %s, %s, now()) "
            "ON CONFLICT (username, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
            (username, key, Json(value)),
        )


def _db_get_all(username: str) -> Dict[str, Any]:
    _validate_username(username)
    with db.get_cursor() as cur:
        cur.execute("SELECT key, value FROM user_data WHERE username = %s", (username,))
        return {row["key"]: row["value"] for row in cur.fetchall()}


# ---------------------------------------------------------------------------
# Public API - dispatches to Postgres when configured, JSON file otherwise
# ---------------------------------------------------------------------------

def get_value(username: str, key: str) -> Any:
    return _db_get_value(username, key) if db.is_configured() else _json_get_value(username, key)


def set_value(username: str, key: str, value: Any) -> None:
    if db.is_configured():
        _db_set_value(username, key, value)
    else:
        _json_set_value(username, key, value)


def get_all(username: str) -> Dict[str, Any]:
    return _db_get_all(username) if db.is_configured() else _json_get_all(username)
