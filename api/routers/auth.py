from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from api.auth import create_access_token, verify_password
from config.settings import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    if payload.username != settings.ADMIN_USERNAME or not verify_password(payload.password, settings.ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_access_token(payload.username)
    return LoginResponse(access_token=token, username=payload.username)
