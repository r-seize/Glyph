from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.schemas.user import TokenData
from app.core.exceptions import UnauthorizedError

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {"sub": user_id, "exp": expire, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> TokenData:
    try:
        payload              = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        user_id: str | None  = payload.get("sub")
        if user_id is None:
            raise UnauthorizedError("Invalid token")
        return TokenData(user_id=user_id)
    except JWTError:
        raise UnauthorizedError("Invalid or expired token")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials]  = Depends(bearer_scheme),
    db: Session                                          = Depends(get_db),
):
    from app.models.user import User

    if credentials is None:
        raise UnauthorizedError()

    token_data  = decode_access_token(credentials.credentials)
    user        = db.get(User, token_data.user_id)

    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or inactive")

    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials]  = Depends(bearer_scheme),
    db: Session                                          = Depends(get_db),
):
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials, db)
    except UnauthorizedError:
        return None