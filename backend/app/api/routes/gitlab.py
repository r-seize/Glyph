from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.connected_account import ConnectedAccount, Provider
from app.core.security import get_current_user
from app.core.crypto import decrypt
from app.core.exceptions import NotFoundError, UnauthorizedError
from app.database import get_db
from app.services import gitlab_service

router = APIRouter(prefix="/gitlab", tags=["gitlab"])


@router.get("/status")
async def gitlab_status(
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    count = db.query(ConnectedAccount).filter(
        ConnectedAccount.user_id == current_user.id,
        ConnectedAccount.provider == Provider.gitlab,
    ).count()
    return {"connected": count > 0}


@router.get("/repos")
async def list_gitlab_repos(
    account_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    account = db.query(ConnectedAccount).filter(
        ConnectedAccount.id == account_id,
        ConnectedAccount.user_id == current_user.id,
        ConnectedAccount.provider == Provider.gitlab,
    ).first()
    if not account:
        raise NotFoundError("GitLab account not found")
    token = decrypt(account.token_encrypted)
    if not token:
        raise UnauthorizedError("Invalid GitLab token, please reconnect")
    return await gitlab_service.list_repos(token)
