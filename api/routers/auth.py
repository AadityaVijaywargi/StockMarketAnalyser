from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
import jwt

from api.auth import create_access_token, decode_token_payload, hash_password, verify_password
from api import user_store
from config.settings import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


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
    # Must match api/user_data_store.py's _SAFE_NAME pattern: usernames are
    # used to build a per-user filename for cloud-synced data, so a username
    # outside this charset would sign up successfully but then hit an
    # unhandled ValueError (and silently fail) on every /me/data/ call.
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8)


class InviteResponse(BaseModel):
    code: str


class InviteInfo(BaseModel):
    code: str
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


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    if payload.username == settings.ADMIN_USERNAME:
        if not verify_password(payload.password, settings.ADMIN_PASSWORD_HASH):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
        token = create_access_token(payload.username, role="admin")
        return LoginResponse(access_token=token, username=payload.username, role="admin")

    user = user_store.get_user(payload.username)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_access_token(payload.username, role=user["role"])
    return LoginResponse(access_token=token, username=payload.username, role=user["role"])


@router.post("/signup", response_model=LoginResponse)
async def signup(payload: SignupRequest):
    password_hash = hash_password(payload.password)
    try:
        user_store.redeem_invite_and_create_user(payload.invite_code, payload.username, password_hash)
    except user_store.InviteError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except user_store.UsernameTakenError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    token = create_access_token(payload.username, role="user")
    return LoginResponse(access_token=token, username=payload.username, role="user")


@router.post("/invites", response_model=InviteResponse)
async def create_invite(admin=Depends(_require_admin)):
    code = user_store.create_invite(created_by=admin["sub"])
    return InviteResponse(code=code)


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
