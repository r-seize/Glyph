"""Symmetric encryption helpers based on the app SECRET_KEY.

Used to store sensitive third-party tokens (e.g. GitHub OAuth access tokens)
in the database without keeping them as plaintext.
"""

import base64
import hashlib
from functools import lru_cache
from cryptography.fernet import Fernet, InvalidToken
from app.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    digest  = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    key     = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt(value: str) -> str:
    if not value:
        return ""
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt(token: str) -> str | None:
    if not token:
        return None
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None
