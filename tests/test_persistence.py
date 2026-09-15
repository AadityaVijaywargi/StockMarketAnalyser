"""
Persistence tests for per-user synced data (api/user_data_store.py) and
invite-based accounts (api/user_store.py), run against both backends:

- "json": the flat-file fallback, always run, pointed at a temp directory.
- "postgres": run only when TEST_DATABASE_URL is set (CI provides a Postgres
  service container). This is the backend production relies on to survive
  redeploys, so it must not go untested.
"""
import os
import uuid

import pytest
from fastapi.testclient import TestClient

from api import db, user_data_store, user_store
from api.api import create_app
from api.auth import create_access_token
from config.settings import settings

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")

BACKENDS = [
    "json",
    pytest.param(
        "postgres",
        marks=pytest.mark.skipif(not TEST_DATABASE_URL, reason="TEST_DATABASE_URL not set"),
    ),
]


@pytest.fixture(params=BACKENDS)
def backend(request, monkeypatch, tmp_path):
    if request.param == "json":
        monkeypatch.setattr(settings, "DATABASE_URL", "")
        monkeypatch.setattr(user_data_store, "_DATA_DIR", str(tmp_path / "user_data"))
        monkeypatch.setattr(user_store, "_STORE_PATH", str(tmp_path / "users.json"))
    else:
        monkeypatch.setattr(settings, "DATABASE_URL", TEST_DATABASE_URL)
        db.reset_pool()
    yield request.param
    if request.param == "postgres":
        db.reset_pool()


def _unique_username() -> str:
    return f"test_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# user_data_store
# ---------------------------------------------------------------------------

def test_missing_key_returns_none(backend):
    assert user_data_store.get_value(_unique_username(), "watchlist") is None


def test_set_then_get_roundtrips_json_structures(backend):
    username = _unique_username()
    watchlist = [{"ticker": "RELIANCE.NS", "pinned": True, "tags": ["energy"], "note": None}]
    user_data_store.set_value(username, "watchlist", watchlist)
    assert user_data_store.get_value(username, "watchlist") == watchlist


def test_set_overwrites_existing_value(backend):
    username = _unique_username()
    user_data_store.set_value(username, "alerts", [{"ticker": "TCS.NS", "price": 3000}])
    user_data_store.set_value(username, "alerts", [])
    assert user_data_store.get_value(username, "alerts") == []


def test_get_all_returns_every_key_for_that_user_only(backend):
    alice, bob = _unique_username(), _unique_username()
    user_data_store.set_value(alice, "watchlist", ["INFY.NS"])
    user_data_store.set_value(alice, "trades", [{"id": 1}])
    user_data_store.set_value(bob, "watchlist", ["HDFCBANK.NS"])

    assert user_data_store.get_all(alice) == {"watchlist": ["INFY.NS"], "trades": [{"id": 1}]}
    assert user_data_store.get_value(bob, "watchlist") == ["HDFCBANK.NS"]


def test_rejects_unsafe_username(backend):
    with pytest.raises(ValueError):
        user_data_store.set_value("../etc/passwd", "watchlist", [])


def test_me_data_endpoints_roundtrip(backend):
    username = _unique_username()
    client = TestClient(create_app())
    headers = {"Authorization": f"Bearer {create_access_token(username)}"}

    resp = client.put("/me/data/watchlist", json={"value": ["SBIN.NS"]}, headers=headers)
    assert resp.status_code == 200

    resp = client.get("/me/data/watchlist", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == {"key": "watchlist", "value": ["SBIN.NS"]}


# ---------------------------------------------------------------------------
# user_store (invites + accounts)
# ---------------------------------------------------------------------------

def test_invite_redeem_creates_user_and_marks_invite_used(backend):
    username = _unique_username()
    code = user_store.create_invite("admin", "Invitee@Example.com")

    user_store.redeem_invite_and_create_user(code, "invitee@example.com", username, "salt$hash")

    user = user_store.get_user(username)
    assert user["role"] == "user"
    assert user["email"] == "invitee@example.com"
    assert user["invited_by"] == "admin"
    assert user_store.list_invites()[code]["used_by"] == username

    with pytest.raises(user_store.InviteError):
        user_store.redeem_invite_and_create_user(code, "invitee@example.com", _unique_username(), "salt$hash")


def test_invite_is_bound_to_its_email(backend):
    code = user_store.create_invite("admin", "right@example.com")
    with pytest.raises(user_store.InviteError):
        user_store.redeem_invite_and_create_user(code, "wrong@example.com", _unique_username(), "salt$hash")


def test_revoke_only_removes_unused_invites(backend):
    unused = user_store.create_invite("admin", "a@example.com")
    used = user_store.create_invite("admin", "b@example.com")
    user_store.redeem_invite_and_create_user(used, "b@example.com", _unique_username(), "salt$hash")

    assert user_store.revoke_invite(unused) is True
    assert user_store.revoke_invite(used) is False
    assert unused not in user_store.list_invites()
