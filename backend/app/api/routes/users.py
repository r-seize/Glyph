from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.schemas.user import UserOut, UserUpdate, PasswordChange
from app.core.security import get_current_user, verify_password, hash_password
from app.core.exceptions import NotFoundError, UnauthorizedError

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/profile/{username}", response_model=UserOut)
async def get_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise NotFoundError("User")
    return user


@router.put("/me", response_model=UserOut)
async def update_me(
payload: UserUpdate,
current_user: User  = Depends(get_current_user),
db: Session         = Depends(get_db),
):
    if payload.username is not None:
        existing = db.query(User).filter(
            User.username == payload.username,
            User.id != current_user.id,
        ).first()
        if existing:
            from app.core.exceptions import ConflictError
            raise ConflictError("Username already taken")
        current_user.username = payload.username

    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url

    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
async def change_password(
    payload: PasswordChange,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    if not current_user.hashed_password:
        raise UnauthorizedError("Cannot change password for OAuth accounts")
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise UnauthorizedError("Current password is incorrect")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.delete("/me", status_code=204)
async def delete_me(
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    # Delete workspaces owned by this user (cascade removes members/projects)
    owned = db.query(Workspace).filter(Workspace.owner_id == current_user.id).all()
    for ws in owned:
        db.delete(ws)

    db.delete(current_user)
    db.commit()