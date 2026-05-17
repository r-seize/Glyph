from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
import httpx
from app.database import get_db
from app.models.user import User
from app.models.connected_account import ConnectedAccount, Provider
from app.core.security import get_current_user
from app.core.crypto import encrypt
from app.core.exceptions import NotFoundError
from app.config import settings

router = APIRouter(prefix="/accounts", tags=["accounts"])


class ConnectedAccountOut(BaseModel):
    id: str
    provider: str
    username: str
    avatar_url: str | None
    created_at: str

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_model(cls, account: ConnectedAccount) -> "ConnectedAccountOut":
        return cls(
            id          = account.id,
            provider    = account.provider.value,
            username    = account.username,
            avatar_url  = account.avatar_url,
            created_at  = account.created_at.isoformat(),
        )


@router.get("/", response_model=list[ConnectedAccountOut])
async def list_accounts(
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    accounts = db.query(ConnectedAccount).filter(
        ConnectedAccount.user_id == current_user.id
    ).all()
    return [ConnectedAccountOut.from_orm_model(a) for a in accounts]


@router.delete("/{account_id}", status_code=204)
async def disconnect_account(
    account_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    account = db.query(ConnectedAccount).filter(
        ConnectedAccount.id == account_id,
        ConnectedAccount.user_id == current_user.id,
    ).first()
    if not account:
        raise NotFoundError("Account not found")

    # If disconnecting the primary GitHub account, clear User fields
    if account.provider.value == "github" and current_user.github_id == account.provider_account_id:
        current_user.github_id               = None
        current_user.github_token_encrypted  = None

    db.delete(account)
    db.commit()


class TokenPayload(BaseModel):
    token: str


def _upsert_account(db: Session, user: User, provider: Provider, provider_id: str, username: str, avatar_url: str | None, token: str) -> ConnectedAccount:
    account = db.query(ConnectedAccount).filter(
        ConnectedAccount.user_id == user.id,
        ConnectedAccount.provider == provider,
        ConnectedAccount.provider_account_id == provider_id,
    ).first()
    if account:
        account.token_encrypted  = encrypt(token)
        account.username         = username
        account.avatar_url       = avatar_url
    else:
        account = ConnectedAccount(
            user_id              = user.id,
            provider             = provider,
            provider_account_id  = provider_id,
            username             = username,
            avatar_url           = avatar_url,
            token_encrypted      = encrypt(token),
        )
        db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.post("/github/token", response_model=ConnectedAccountOut)
async def add_github_token(
    payload: TokenPayload,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    token = payload.token.strip()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.github_api_url}/user",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=422, detail="Invalid or insufficient GitHub token (required scopes: read:user, user:email, repo)")

    data = resp.json()
    account = _upsert_account(
        db, current_user, Provider.github,
        str(data["id"]), data["login"], data.get("avatar_url"), token,
    )
    return ConnectedAccountOut.from_orm_model(account)


@router.post("/gitlab/token", response_model=ConnectedAccountOut)
async def add_gitlab_token(
    payload: TokenPayload,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    token = payload.token.strip()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.gitlab_api_url}/user",
            headers={"Authorization": f"Bearer {token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=422, detail="Invalid or insufficient GitLab token (required scopes: read_user, read_api)")

    data = resp.json()
    account = _upsert_account(
        db, current_user, Provider.gitlab,
        str(data["id"]), data.get("username", ""), data.get("avatar_url"), token,
    )
    return ConnectedAccountOut.from_orm_model(account)
