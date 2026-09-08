"""
Generic per-user JSON key/value store, one file per user under
storage/user_data/<username>.json. Backs cloud-synced features (watchlist,
price alerts, etc.) so a logged-in user's data follows them across devices
instead of living only in that browser's localStorage.

Same ephemeral-storage caveat as api/user_store.py: on hosts with a
non-persistent filesystem (e.g. Render's free tier), this is wiped on
redeploy. Acceptable for now since it only holds re-creatable preferences,
not the user accounts themselves.
"""
import json
import os
import re
import threading
from typing import Any, Dict

from config.settings import settings

_LOCK = threading.Lock()
_DATA_DIR = os.path.join(settings.STORAGE_BASE, "user_data")
_SAFE_NAME = re.compile(r"^[A-Za-z0-9_.-]+$")


def _user_path(username: str) -> str:
    if not _SAFE_NAME.match(username):
        raise ValueError("Invalid username")
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


def get_value(username: str, key: str) -> Any:
    with _LOCK:
        return _load_user(username).get(key)


def set_value(username: str, key: str, value: Any) -> None:
    with _LOCK:
        data = _load_user(username)
        data[key] = value
        _save_user(username, data)


def get_all(username: str) -> Dict[str, Any]:
    with _LOCK:
        return _load_user(username)
