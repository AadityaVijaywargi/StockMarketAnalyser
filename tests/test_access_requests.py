"""
Public access-request endpoint: validation, the three spam layers, and the
admin-only review queue.
"""
import time

import pytest
from fastapi.testclient import TestClient

from api import access_request_store, rate_limit, user_store
from api.api import create_app
from api.auth import create_access_token
from api.routers import access
from config.settings import settings

client = TestClient(create_app())

# conftest attaches an admin token to every TestClient, which would mask
# whether the POST is genuinely reachable without a session.
NO_AUTH = {"Authorization": ""}


@pytest.fixture(autouse=True)
def isolated_store(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "DATABASE_URL", "")
    monkeypatch.setattr(access_request_store, "_STORE_PATH", str(tmp_path / "access_requests.json"))
    monkeypatch.setattr(user_store, "_STORE_PATH", str(tmp_path / "users.json"))
    for limiter in rate_limit.ALL_LIMITERS:
        limiter.reset()
    yield
    for limiter in rate_limit.ALL_LIMITERS:
        limiter.reset()


def submit(**overrides):
    """Posts a plausible human submission unless a field is overridden."""
    payload = {
        "email": "someone@example.com",
        "message": "I trade NSE smallcaps and would like to try the scoring.",
        "company_website": "",
        # Rendered well over MIN_FILL_SECONDS ago.
        "rendered_at": int((time.time() - 30) * 1000),
    }
    payload.update(overrides)
    return client.post("/access-requests", json=payload, headers=NO_AUTH)


# --------------------------------------------------------------------------
# Happy path
# --------------------------------------------------------------------------

def test_submission_is_accepted_without_a_session():
    response = submit()
    assert response.status_code == 202
    assert response.json()["accepted"] is True
    assert [r["email"] for r in access_request_store.list_requests()] == ["someone@example.com"]


def test_email_is_normalised_to_lowercase():
    submit(email="Mixed.Case@Example.COM")
    assert access_request_store.list_requests()[0]["email"] == "mixed.case@example.com"


def test_message_is_optional():
    assert submit(message="").status_code == 202
    assert len(access_request_store.list_requests()) == 1


def test_resubmitting_same_email_updates_rather_than_duplicates():
    submit(message="first attempt")
    submit(message="second attempt")
    rows = access_request_store.list_requests()
    assert len(rows) == 1
    assert rows[0]["message"] == "second attempt"


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------

@pytest.mark.parametrize("bad_email", ["", "not-an-email", "missing@tld", "@example.com", "a b@example.com"])
def test_invalid_email_is_rejected(bad_email):
    assert submit(email=bad_email).status_code == 422
    assert access_request_store.list_requests() == []


def test_overlong_message_is_rejected():
    response = submit(message="x" * (access_request_store.MAX_MESSAGE_LENGTH + 1))
    assert response.status_code == 422
    assert access_request_store.list_requests() == []


# --------------------------------------------------------------------------
# Spam layer 1: honeypot
# --------------------------------------------------------------------------

def test_filled_honeypot_is_dropped():
    response = submit(company_website="http://spam.example.com")
    # Same status and body as a real acceptance - the bot learns nothing.
    assert response.status_code == 202
    assert response.json()["accepted"] is True
    assert access_request_store.list_requests() == []


def test_whitespace_only_honeypot_is_still_accepted():
    # Some browsers autofill a space; that should not lose a real request.
    assert submit(company_website="   ").status_code == 202
    assert len(access_request_store.list_requests()) == 1


# --------------------------------------------------------------------------
# Spam layer 2: minimum fill time
# --------------------------------------------------------------------------

def test_instant_submission_is_dropped():
    response = submit(rendered_at=int(time.time() * 1000))
    assert response.status_code == 202
    assert access_request_store.list_requests() == []


def test_future_timestamp_is_dropped():
    # A forged timestamp claiming the form renders in the future would
    # otherwise produce a negative elapsed time and sail past the check.
    submit(rendered_at=int((time.time() + 600) * 1000))
    assert access_request_store.list_requests() == []


def test_stale_form_is_dropped():
    stale = (time.time() - access.MAX_FORM_AGE_SECONDS - 60) * 1000
    submit(rendered_at=int(stale))
    assert access_request_store.list_requests() == []


def test_missing_timestamp_is_allowed():
    # A real visitor with JS timing unavailable must still be able to apply;
    # the honeypot and rate limit still cover them.
    assert submit(rendered_at=None).status_code == 202
    assert len(access_request_store.list_requests()) == 1


# --------------------------------------------------------------------------
# Spam layer 3: rate limiting
# --------------------------------------------------------------------------

def test_repeated_submissions_are_rate_limited():
    limit = rate_limit.ACCESS_REQUESTS_PER_IP.max_events
    for i in range(limit):
        assert submit(email=f"user{i}@example.com").status_code == 202

    blocked = submit(email="one-too-many@example.com")
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers
    assert "one-too-many@example.com" not in [r["email"] for r in access_request_store.list_requests()]


def test_dropped_spam_still_counts_toward_the_rate_limit():
    # Otherwise a bot could submit unlimited honeypot-tripping requests for
    # free and use the endpoint as an amplifier.
    limit = rate_limit.ACCESS_REQUESTS_PER_IP.max_events
    for _ in range(limit):
        submit(company_website="spam")
    assert submit().status_code == 429


# --------------------------------------------------------------------------
# Admin review queue
# --------------------------------------------------------------------------

def test_listing_requests_requires_a_session():
    assert client.get("/access-requests", headers=NO_AUTH).status_code == 401


def test_listing_requests_requires_admin_role():
    user_token = create_access_token("regular-user", role="user")
    response = client.get("/access-requests", headers={"Authorization": f"Bearer {user_token}"})
    assert response.status_code == 403


def test_admin_can_list_and_delete_requests():
    submit()
    listed = client.get("/access-requests")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    request_id = listed.json()[0]["id"]
    assert client.delete(f"/access-requests/{request_id}").status_code == 200
    assert client.get("/access-requests").json() == []


def test_deleting_an_unknown_request_is_404():
    assert client.delete("/access-requests/does-not-exist").status_code == 404


def test_public_post_does_not_expose_other_peoples_requests():
    submit(email="first@example.com")
    body = submit(email="second@example.com").json()
    # The response must carry only an acknowledgement, never the queue.
    assert set(body) == {"accepted", "message"}
    assert "first@example.com" not in str(body)


# --------------------------------------------------------------------------
# Approval
# --------------------------------------------------------------------------

def _only_request_id():
    return client.get("/access-requests").json()[0]["id"]


def test_approve_creates_invite_for_the_requested_email_and_marks_invited():
    submit(email="approve.me@example.com")
    request_id = _only_request_id()

    response = client.post(f"/access-requests/{request_id}/approve")
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "approve.me@example.com"

    invites = user_store.list_invites()
    assert invites[body["code"]]["email"] == "approve.me@example.com"
    assert client.get("/access-requests").json()[0]["status"] == "invited"


def test_approving_twice_issues_a_fresh_code():
    submit()
    request_id = _only_request_id()
    first = client.post(f"/access-requests/{request_id}/approve").json()["code"]
    second = client.post(f"/access-requests/{request_id}/approve").json()["code"]
    assert first != second


def test_approve_unknown_request_is_404():
    assert client.post("/access-requests/nope/approve").status_code == 404


def test_approve_requires_admin():
    submit()
    request_id = _only_request_id()
    user_token = create_access_token("regular-user", role="user")
    response = client.post(
        f"/access-requests/{request_id}/approve",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert response.status_code == 403
    assert user_store.list_invites() == {}
    # Without any session the auth middleware rejects it before the route runs.
    assert client.post(f"/access-requests/{request_id}/approve", headers=NO_AUTH).status_code == 401
