"""
Auth hardening: rate limiting on login/signup, timing-safe unknown-user
handling, malformed hash handling, and startup config checks.
"""
import pytest
from fastapi.testclient import TestClient

from api import rate_limit, user_store
from api.api import create_app
from api.auth import hash_password
from api.rate_limit import SlidingWindowLimiter
from api.routers import auth as auth_router
from api.startup_checks import InsecureConfigError, check_config
from config.settings import settings

ADMIN_PASSWORD = "correct-horse-battery-staple"


@pytest.fixture(autouse=True)
def isolated_auth(monkeypatch, tmp_path):
    for limiter in rate_limit.ALL_LIMITERS:
        limiter.reset()
    monkeypatch.setattr(settings, "ADMIN_USERNAME", "admin")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD_HASH", hash_password(ADMIN_PASSWORD))
    monkeypatch.setattr(settings, "DATABASE_URL", "")
    monkeypatch.setattr(user_store, "_STORE_PATH", str(tmp_path / "users.json"))
    yield
    for limiter in rate_limit.ALL_LIMITERS:
        limiter.reset()


@pytest.fixture
def client():
    return TestClient(create_app())


def login(client, username="admin", password="wrong-password", ip="203.0.113.7"):
    return client.post(
        "/auth/login",
        json={"username": username, "password": password},
        headers={"X-Forwarded-For": ip},
    )


# ---------------------------------------------------------------------------
# SlidingWindowLimiter
# ---------------------------------------------------------------------------

class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def test_limiter_blocks_at_the_limit_and_recovers_after_the_window():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(max_events=3, window_seconds=60, clock=clock)

    for _ in range(3):
        assert limiter.retry_after("k") is None
        limiter.record("k")
    assert limiter.retry_after("k") == 61

    clock.now += 30
    assert limiter.retry_after("k") == 31
    assert limiter.retry_after("other") is None

    clock.now += 31
    assert limiter.retry_after("k") is None


def test_limiter_forgets_keys_with_no_recent_events():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(max_events=3, window_seconds=60, clock=clock)
    limiter.MAX_KEYS = 5
    for i in range(5):
        limiter.record(f"ip-{i}")
    clock.now += 61
    limiter.record("fresh")
    assert set(limiter._events) == {"fresh"}


# ---------------------------------------------------------------------------
# /auth/login
# ---------------------------------------------------------------------------

def test_correct_password_logs_in(client):
    resp = login(client, password=ADMIN_PASSWORD)
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


def test_username_is_locked_after_repeated_failures_even_from_new_ips(client):
    for i in range(10):
        assert login(client, ip=f"198.51.100.{i}").status_code == 401

    resp = login(client, password=ADMIN_PASSWORD, ip="192.0.2.99")
    assert resp.status_code == 429
    assert int(resp.headers["Retry-After"]) > 0


def test_ip_is_limited_across_usernames(client):
    for i in range(20):
        assert login(client, username=f"user{i}").status_code == 401
    assert login(client, username="someone-new").status_code == 429
    assert login(client, username="someone-new", ip="192.0.2.1").status_code == 401


def test_successful_logins_do_not_count_toward_the_limit(client):
    for _ in range(15):
        assert login(client, password=ADMIN_PASSWORD).status_code == 200


def test_unknown_username_still_pays_the_password_hashing_cost(client, monkeypatch):
    checked = []
    real_verify = auth_router.verify_password
    monkeypatch.setattr(auth_router, "verify_password", lambda pw, h: checked.append(h) or real_verify(pw, h))

    assert login(client, username="nobody").status_code == 401
    assert checked == [auth_router._DUMMY_PASSWORD_HASH]


def test_malformed_stored_hash_fails_login_instead_of_crashing(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_PASSWORD_HASH", "not-hex$abc")
    assert login(client, password=ADMIN_PASSWORD).status_code == 401


# ---------------------------------------------------------------------------
# /auth/signup
# ---------------------------------------------------------------------------

def test_signup_attempts_are_limited_per_ip(client):
    body = {"invite_code": "bogus", "email": "a@example.com", "username": "newuser", "password": "longenough1"}
    headers = {"X-Forwarded-For": "203.0.113.50"}
    for _ in range(10):
        assert client.post("/auth/signup", json=body, headers=headers).status_code == 400
    assert client.post("/auth/signup", json=body, headers=headers).status_code == 429


def test_signup_with_a_valid_invite_still_works(client):
    code = user_store.create_invite("admin", "new@example.com")
    resp = client.post("/auth/signup", json={
        "invite_code": code, "email": "new@example.com", "username": "newuser", "password": "longenough1",
    })
    assert resp.status_code == 200
    assert login(client, username="newuser", password="longenough1").status_code == 200


# ---------------------------------------------------------------------------
# Startup config checks
# ---------------------------------------------------------------------------

GOOD = {
    "JWT_SECRET_KEY": "x" * 64,
    "ADMIN_PASSWORD_HASH": hash_password("pw"),
    "DATABASE_URL": "postgresql://example/db",
    "ENV": "production",
}


def config(**overrides):
    return settings.model_copy(update={**GOOD, **overrides})


def test_good_config_has_no_warnings():
    assert check_config(config()) == []


def test_empty_jwt_secret_refuses_to_start():
    with pytest.raises(InsecureConfigError):
        check_config(config(JWT_SECRET_KEY=""))


def test_weak_or_missing_credentials_are_warned_about():
    assert any("shorter than" in w for w in check_config(config(JWT_SECRET_KEY="short")))
    assert any("not set" in w for w in check_config(config(ADMIN_PASSWORD_HASH="")))
    assert any("format" in w for w in check_config(config(ADMIN_PASSWORD_HASH="nope")))


def test_missing_database_is_warned_about_only_in_production(monkeypatch):
    monkeypatch.delenv("RENDER", raising=False)
    assert any("DATABASE_URL" in w for w in check_config(config(DATABASE_URL="")))
    assert check_config(config(DATABASE_URL="", ENV="development")) == []

    monkeypatch.setenv("RENDER", "true")
    assert any("DATABASE_URL" in w for w in check_config(config(DATABASE_URL="", ENV="development")))
