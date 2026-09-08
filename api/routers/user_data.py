from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel
import jwt

from api.auth import decode_token_payload
from api import user_data_store

router = APIRouter(prefix="/me", tags=["User data sync"])


class ValuePayload(BaseModel):
    value: Any


def _current_username(authorization: Optional[str] = Header(None)) -> str:
    token = authorization[len("Bearer "):] if authorization and authorization.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        return decode_token_payload(token)["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")


@router.get("/data/{key}")
async def get_data(key: str, authorization: Optional[str] = Header(None)):
    username = _current_username(authorization)
    return {"key": key, "value": user_data_store.get_value(username, key)}


@router.put("/data/{key}")
async def put_data(key: str, payload: ValuePayload, authorization: Optional[str] = Header(None)):
    username = _current_username(authorization)
    user_data_store.set_value(username, key, payload.value)
    return {"key": key, "value": payload.value}
