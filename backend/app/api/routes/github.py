from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.connected_account import ConnectedAccount, Provider
from app.core.security import get_current_user
from app.core.crypto import decrypt
from app.core.exceptions import UnauthorizedError, NotFoundError
from app.database import get_db
from app.services import github_service

router = APIRouter(prefix="/github", tags=["github"])


def _resolve_token(user: User, account_id: str | None, db: Session) -> str:
    if account_id:
        account = db.query(ConnectedAccount).filter(
            ConnectedAccount.id == account_id,
            ConnectedAccount.user_id == user.id,
            ConnectedAccount.provider == Provider.github,
        ).first()
        if not account:
            raise NotFoundError("GitHub account not found")
        token = decrypt(account.token_encrypted)
        if not token:
            raise UnauthorizedError("Invalid GitHub token, please reconnect")
        return token

    if not user.github_token_encrypted:
        raise UnauthorizedError("Connect your GitHub account first")
    token = decrypt(user.github_token_encrypted)
    if not token:
        raise UnauthorizedError("Invalid GitHub token, please reconnect your account")
    return token


@router.get("/status")
async def github_status(current_user: User = Depends(get_current_user)):
    return {"connected": bool(current_user.github_token_encrypted)}


@router.get("/repos")
async def list_github_repos(
    account_id: str | None  = None,
    current_user: User      = Depends(get_current_user),
    db: Session             = Depends(get_db),
):
    token = _resolve_token(current_user, account_id, db)
    return await github_service.list_repos(token)
