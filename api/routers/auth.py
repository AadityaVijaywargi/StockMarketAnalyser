from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
import jwt

from api.auth import create_access_token, decode_token_payload, hash_password, verify_password
from api import rate_limit, user_store
from config.settings import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Verified against when a username doesn't exist, so a login attempt costs the
# same PBKDF2 work either way and response time doesn't reveal valid usernames.
_DUMMY_PASSWORD_HASH = hash_password("timing-equalizer-not-a-real-password")


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class SignupRequest(BaseModel):
    invite_code: str
    email: EmailStr
    # Must match api/user_data_store.py's _SAFE_NAME pattern: usernames are
    # used to build a per-user filename for cloud-synced data, so a username
    # outside this charset would sign up successfully but then hit an
    # unhandled ValueError (and silently fail) on every /me/data/ call.
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8)


class InviteCreateRequest(BaseModel):
    email: EmailStr


class InviteResponse(BaseModel):
    code: str
    email: str


class InviteInfo(BaseModel):
    code: str
    email: Optional[str] = None
    created_by: str
    created_at: str
    used: bool
    used_by: Optional[str]


def _current_payload(authorization: Optional[str] = Header(None)) -> dict:
    token = authorization[len("Bearer "):] if authorization and authorization.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        return decode_token_payload(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")


def _require_admin(authorization: Optional[str] = Header(None)) -> dict:
    payload = _current_payload(authorization)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return payload


# Plain `def` (not async): PBKDF2 hashing is CPU-bound and deliberately slow,
# so FastAPI runs these in its thread pool instead of blocking the event loop
# (and every other request) for the duration of each attempt.
@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request):
    ip_key = rate_limit.client_ip(request)
    username_key = payload.username.strip().lower()
    too_many = "Too many failed login attempts. Please wait before trying again."
    rate_limit.enforce(rate_limit.FAILED_LOGINS_PER_USERNAME, username_key, too_many)
    rate_limit.enforce(rate_limit.FAILED_LOGINS_PER_IP, ip_key, too_many)

    if payload.username == settings.ADMIN_USERNAME:
        role, password_hash = "admin", settings.ADMIN_PASSWORD_HASH
    else:
        user = user_store.get_user(payload.username)
        role, password_hash = (user["role"], user["password_hash"]) if user else (None, _DUMMY_PASSWORD_HASH)

    # Always verify (even for unknown users) - don't short-circuit on role.
    password_ok = verify_password(payload.password, password_hash)
    if role is None or not password_ok:
        rate_limit.FAILED_LOGINS_PER_USERNAME.record(username_key)
        rate_limit.FAILED_LOGINS_PER_IP.record(ip_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_access_token(payload.username, role=role)
    return LoginResponse(access_token=token, username=payload.username, role=role)


@router.post("/signup", response_model=LoginResponse)
def signup(payload: SignupRequest, request: Request):
    ip_key = rate_limit.client_ip(request)
    rate_limit.enforce(rate_limit.SIGNUPS_PER_IP, ip_key, "Too many sign-up attempts. Please wait before trying again.")
    rate_limit.SIGNUPS_PER_IP.record(ip_key)

    password_hash = hash_password(payload.password)
    try:
        user_store.redeem_invite_and_create_user(payload.invite_code, payload.email, payload.username, password_hash)
    except user_store.InviteError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except user_store.UsernameTakenError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    token = create_access_token(payload.username, role="user")
    return LoginResponse(access_token=token, username=payload.username, role="user")


@router.post("/invites", response_model=InviteResponse)
async def create_invite(payload: InviteCreateRequest, admin=Depends(_require_admin)):
    code = user_store.create_invite(created_by=admin["sub"], email=payload.email)
    return InviteResponse(code=code, email=payload.email.lower())


@router.get("/invites", response_model=List[InviteInfo])
async def get_invites(admin=Depends(_require_admin)):
    invites = user_store.list_invites()
    return [InviteInfo(code=code, **info) for code, info in invites.items()]


@router.delete("/invites/{code}")
async def delete_invite(code: str, admin=Depends(_require_admin)):
    ok = user_store.revoke_invite(code)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found or already used")
    return {"revoked": code}
