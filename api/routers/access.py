"""
Public access-request endpoint backing the marketing page CTA.

This is the only unauthenticated write endpoint in the API, so it carries
three independent layers of spam defence rather than relying on any one:

1. A honeypot field the real form hides from humans. Bots fill every input
   they find; a non-empty value is a bot with near-zero false positives.
2. A minimum fill time. The form stamps when it was rendered, and a
   submission that arrives implausibly fast was not typed by a person.
3. Per-IP rate limiting, reusing the sliding-window limiter already used by
   login and signup.

All three fail *quietly*: a rejected submission gets the same 202 and the
same response body as an accepted one. Telling a bot which layer caught it
is telling whoever wrote it how to get past it next time.

No CAPTCHA: it would add a third-party script, a cookie, and an
accessibility barrier to a form that gets a handful of legitimate
submissions a week.
"""
import logging
import time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from api import access_request_store, rate_limit, user_store
# Reuses the auth router's admin gate rather than re-implementing the role
# check, so there is one definition of what "admin" means.
from api.routers.auth import _require_admin as require_admin

router = APIRouter(tags=["Access requests"])
logger = logging.getLogger("AIEquityResearchPlatform")

# A human cannot read the page, type an email and submit in under this long.
MIN_FILL_SECONDS = 3.0
# Guards against a stale or forged timestamp claiming an absurd render time.
MAX_FORM_AGE_SECONDS = 24 * 60 * 60

# Deliberately generic: the same text is returned whether the request was
# stored or silently dropped as spam.
_ACCEPTED_MESSAGE = "Thanks - your request is in. We review these by hand and will email you."


class AccessRequestPayload(BaseModel):
    email: EmailStr
    message: str = Field(default="", max_length=access_request_store.MAX_MESSAGE_LENGTH)
    # Honeypot. Named to look like a field worth filling in to a scraper, and
    # hidden from humans in the form. Any value means a bot.
    company_website: str = Field(default="", max_length=200)
    # Epoch milliseconds stamped by the client when the form was rendered.
    rendered_at: Optional[int] = None


class AccessRequestResponse(BaseModel):
    accepted: bool = True
    message: str = _ACCEPTED_MESSAGE


class AccessRequestInfo(BaseModel):
    id: str
    email: str
    message: str = ""
    created_at: str
    status: str = "pending"


def _looks_automated(payload: AccessRequestPayload) -> Optional[str]:
    """Returns a reason string when the submission looks like a bot, else None."""
    if payload.company_website.strip():
        return "honeypot filled"

    if payload.rendered_at is not None:
        elapsed = time.time() - (payload.rendered_at / 1000.0)
        if elapsed < MIN_FILL_SECONDS:
            # Negative elapsed means a clock-skewed or forged timestamp.
            return f"submitted after {elapsed:.2f}s"
        if elapsed > MAX_FORM_AGE_SECONDS:
            return "form timestamp too old"
    return None


@router.post(
    "/access-requests",
    response_model=AccessRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def submit_access_request(payload: AccessRequestPayload, request: Request):
    ip_key = rate_limit.client_ip(request)
    rate_limit.enforce(
        rate_limit.ACCESS_REQUESTS_PER_IP,
        ip_key,
        "Too many access requests from this network. Please try again later.",
    )
    rate_limit.ACCESS_REQUESTS_PER_IP.record(ip_key)

    reason = _looks_automated(payload)
    if reason:
        # Logged so a spam wave is visible in the logs, but answered exactly
        # like a success so the bot learns nothing.
        logger.info("Dropped automated access request (%s)", reason)
        return AccessRequestResponse()

    try:
        access_request_store.record_request(
            email=str(payload.email), message=payload.message, source_ip=ip_key
        )
    except Exception:
        logger.exception("Failed to persist access request")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We could not record your request just now. Please try again shortly.",
        )

    return AccessRequestResponse()


@router.get("/access-requests", response_model=List[AccessRequestInfo])
def get_access_requests(admin=Depends(require_admin)):
    """Admin-only review queue. Never reachable without an admin session."""
    return [AccessRequestInfo(**row) for row in access_request_store.list_requests()]


@router.delete("/access-requests/{request_id}")
def delete_access_request(request_id: str, admin=Depends(require_admin)):
    if not access_request_store.delete_request(request_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return {"deleted": request_id}


class ApproveResponse(BaseModel):
    code: str
    email: str


@router.post("/access-requests/{request_id}/approve", response_model=ApproveResponse)
def approve_access_request(request_id: str, admin=Depends(require_admin)):
    """
    Issues an invite for the request's email and marks the request invited,
    so the review queue and the invite list cannot drift apart.

    Approving an already-invited request issues a fresh code - useful when
    the first one was lost - rather than failing.
    """
    found = access_request_store.get_request(request_id)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    code = user_store.create_invite(created_by=admin["sub"], email=found["email"])
    access_request_store.set_status(request_id, access_request_store.STATUS_INVITED)
    return ApproveResponse(code=code, email=found["email"])
