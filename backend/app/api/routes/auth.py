from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from urllib.parse import quote, urlencode
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.connected_account import ConnectedAccount, Provider
from app.schemas.user import UserCreate, UserLogin, UserOut, Token
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token, get_current_user
from app.core.crypto import encrypt
from app.core.exceptions import ConflictError, UnauthorizedError
from app.config import settings
import app.services.github_service as github_service
import app.services.gitlab_service as gitlab_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _upsert_connected_account(
    db: Session,
    user: User,
    provider: Provider,
    provider_account_id: str,
    username: str,
    avatar_url: str | None,
    access_token: str,
) -> None:
    account = db.query(ConnectedAccount).filter(
        ConnectedAccount.user_id == user.id,
        ConnectedAccount.provider == provider,
        ConnectedAccount.provider_account_id == provider_account_id,
    ).first()
    if account:
        account.token_encrypted  = encrypt(access_token)
        account.username         = username
        account.avatar_url       = avatar_url
    else:
        account = ConnectedAccount(
            user_id              = user.id,
            provider             = provider,
            provider_account_id  = provider_account_id,
            username             = username,
            avatar_url           = avatar_url,
            token_encrypted      = encrypt(access_token),
        )
        db.add(account)
    db.commit()


def _resolve_connecting_user(state: str, db: Session) -> User | None:
    if not state:
        return None
    try:
        token_data  = decode_access_token(state)
        user        = db.get(User, token_data.user_id)
        return user if user and user.is_active else None
    except Exception:
        return None


@router.get("/config")
async def auth_config():
    return {
        "github_oauth": bool(settings.github_client_id and settings.github_client_secret),
        "gitlab_oauth": bool(settings.gitlab_client_id and settings.gitlab_client_secret),
    }


@router.post("/register", response_model=Token, status_code=201)
async def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        (User.email == payload.email) | (User.username == payload.username)
    ).first()
    if existing:
        if existing.email == payload.email:
            raise ConflictError("An account with this email already exists")
        raise ConflictError("This username is already taken")

    user = User(
        email            = payload.email,
        username         = payload.username,
        hashed_password  = hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.hashed_password:
        raise UnauthorizedError("Invalid email or password")
    if not verify_password(payload.password, user.hashed_password):
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise UnauthorizedError("Account is disabled")

    token = create_access_token(user.id)
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


# ── GitHub OAuth ──────────────────────────────────────────────────────────────

@router.get("/github")
async def github_login(state: str = ""):
    if not settings.github_client_id:
        raise UnauthorizedError("GitHub OAuth is not configured on this server")
    params = urlencode({
        "client_id": settings.github_client_id,
        "scope": "read:user,user:email,repo",
        "state": state,
    })
    oauth_path = f"/login/oauth/authorize?{params}"
    if state:
        # Add-account flow: force GitHub to show the login page so the user
        # can select a different account instead of silently reusing the session.
        url = f"https://github.com/login?return_to={quote(oauth_path, safe='')}"
    else:
        url = f"https://github.com{oauth_path}"
    return RedirectResponse(url)


@router.get("/github/callback")
async def github_callback(code: str, state: str = "", db: Session = Depends(get_db)):
    access_token = await github_service.exchange_code_for_token(code)
    if not access_token:
        raise UnauthorizedError("GitHub authentication failed")

    github_user = await github_service.get_github_user(access_token)
    if not github_user:
        raise UnauthorizedError("Could not fetch GitHub user info")

    github_id    = str(github_user["id"])
    gh_username  = github_user["login"]
    gh_avatar    = github_user.get("avatar_url")

    # If state is a valid JWT → account-connect request from settings page
    connecting_user = _resolve_connecting_user(state, db)
    if connecting_user:
        _upsert_connected_account(db, connecting_user, Provider.github, github_id, gh_username, gh_avatar, access_token)
        if not connecting_user.avatar_url:
            connecting_user.avatar_url = gh_avatar
            db.commit()
        return RedirectResponse(f"{settings.frontend_url}/settings?connected=github")

    # Regular login / register
    email = github_user.get("email") or f"{gh_username}@github.local"
    user = db.query(User).filter(
        (User.github_id == github_id) | (User.email == email)
    ).first()

    if user:
        user.github_id               = github_id
        user.avatar_url              = gh_avatar
        user.github_token_encrypted  = encrypt(access_token)
        db.commit()
    else:
        username  = gh_username
        base      = username
        counter   = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base}{counter}"
            counter += 1
        user = User(
            email                   = email,
            username                = username,
            github_id               = github_id,
            avatar_url              = gh_avatar,
            github_token_encrypted  = encrypt(access_token),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    _upsert_connected_account(db, user, Provider.github, github_id, gh_username, gh_avatar, access_token)
    token = create_access_token(user.id)
    return RedirectResponse(f"{settings.frontend_url}/callback?token={token}")


# ── GitLab OAuth ──────────────────────────────────────────────────────────────

def _gitlab_redirect_uri() -> str:
    return f"{settings.app_url}/api/auth/gitlab/callback"


@router.get("/gitlab")
async def gitlab_login(state: str = ""):
    if not settings.gitlab_client_id:
        raise UnauthorizedError("GitLab OAuth is not configured on this server")
    params: dict = {
        "client_id": settings.gitlab_client_id,
        "response_type": "code",
        "scope": "read_user read_api",
        "redirect_uri": _gitlab_redirect_uri(),
        "state": state,
    }
    if state:
        # Add-account flow: prompt=login forces GitLab to re-authenticate
        # so the user can select a different account.
        params["prompt"] = "login"
    url = f"{settings.gitlab_oauth_url}/authorize?{urlencode(params)}"
    return RedirectResponse(url)


@router.get("/gitlab/callback")
async def gitlab_callback(code: str, state: str = "", db: Session = Depends(get_db)):
    access_token = await gitlab_service.exchange_code_for_token(code, _gitlab_redirect_uri())
    if not access_token:
        raise UnauthorizedError("GitLab authentication failed")

    gitlab_user = await gitlab_service.get_gitlab_user(access_token)
    if not gitlab_user:
        raise UnauthorizedError("Could not fetch GitLab user info")

    gitlab_id    = str(gitlab_user["id"])
    gl_username  = gitlab_user.get("username", "")
    gl_avatar    = gitlab_user.get("avatar_url")

    # Account-connect from settings page
    connecting_user = _resolve_connecting_user(state, db)
    if connecting_user:
        _upsert_connected_account(db, connecting_user, Provider.gitlab, gitlab_id, gl_username, gl_avatar, access_token)
        return RedirectResponse(f"{settings.frontend_url}/settings?connected=gitlab")

    # Register / login with GitLab
    email  = gitlab_user.get("email") or f"{gl_username}@gitlab.local"
    user   = db.query(User).filter(User.email == email).first()

    if user:
        user.avatar_url = user.avatar_url or gl_avatar
        db.commit()
    else:
        username  = gl_username
        base      = username
        counter   = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base}{counter}"
            counter += 1
        user = User(email=email, username=username, avatar_url=gl_avatar)
        db.add(user)
        db.commit()
        db.refresh(user)

    _upsert_connected_account(db, user, Provider.gitlab, gitlab_id, gl_username, gl_avatar, access_token)
    token = create_access_token(user.id)
    return RedirectResponse(f"{settings.frontend_url}/callback?token={token}")
