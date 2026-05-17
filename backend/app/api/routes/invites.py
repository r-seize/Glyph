import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, Role
from app.models.workspace_invite import WorkspaceInvite
from app.core.security import get_current_user
from app.core.exceptions import NotFoundError, ConflictError
from app.config import settings
from app.services import email_service

router = APIRouter(prefix="/invites", tags=["invites"])

INVITE_EXPIRY_DAYS = 7


# ── Public endpoints (no auth required) ───────────────────────────────────────

@router.get("/{token}")
async def get_invite(token: str, db: Session = Depends(get_db)):
    invite = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.token == token,
        WorkspaceInvite.used_at == None,  # noqa: E711
    ).first()
    if not invite or invite.expires_at < datetime.utcnow():
        raise NotFoundError("Invitation")
    workspace = db.get(Workspace, invite.workspace_id)
    return {
        "workspace_id": invite.workspace_id,
        "workspace_name": workspace.name if workspace else "Workspace",
        "role": invite.role,
        "expires_at": invite.expires_at.isoformat(),
    }


# ── Authenticated endpoints ────────────────────────────────────────────────────

@router.post("/{token}/accept")
async def accept_invite(
    token: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    invite = db.query(WorkspaceInvite).filter(
        WorkspaceInvite.token == token,
        WorkspaceInvite.used_at == None,  # noqa: E711
    ).first()
    if not invite or invite.expires_at < datetime.utcnow():
        raise NotFoundError("Invitation expired or not found")

    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == invite.workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not existing:
        db.add(WorkspaceMember(
            workspace_id  = invite.workspace_id,
            user_id       = current_user.id,
            role          = invite.role,
        ))

    invite.used_at  = datetime.utcnow()
    invite.used_by  = current_user.id
    db.commit()
    return {"workspace_id": invite.workspace_id}


# ── Workspace-scoped invite management ────────────────────────────────────────

def _workspace_invites_router() -> APIRouter:
    ws_router = APIRouter()

    @ws_router.post("/{workspace_id}/invites", status_code=201)
    async def create_invite(
        workspace_id: str,
        payload: dict,
        current_user: User  = Depends(get_current_user),
        db: Session         = Depends(get_db),
    ):
        from app.core.permissions import require_workspace_member
        require_workspace_member(current_user, workspace_id, db, min_role=Role.admin)

        role_str  = payload.get("role", "developer")
        email     = payload.get("email")

        token       = secrets.token_urlsafe(48)
        expires_at  = datetime.utcnow() + timedelta(days=INVITE_EXPIRY_DAYS)
        invite = WorkspaceInvite(
            workspace_id  = workspace_id,
            token         = token,
            role          = role_str,
            created_by    = current_user.id,
            email         = email,
            expires_at    = expires_at,
        )
        db.add(invite)
        db.commit()
        db.refresh(invite)

        invite_url = f"{settings.frontend_url}/invite?token={token}"

        email_configured  = email_service.is_configured()
        email_sent        = False
        if email:
            if email_configured:
                workspace = db.get(Workspace, workspace_id)
                email_sent = email_service.send_invite_email(
                    to              = email,
                    workspace_name  = workspace.name if workspace else "Workspace",
                    invite_url      = invite_url,
                    role            = role_str,
                )

        return {
            "id": invite.id,
            "token": token,
            "url": invite_url,
            "role": role_str,
            "email": email,
            "expires_at": expires_at.isoformat(),
            "email_configured": email_configured,
            "email_sent": email_sent,
        }

    @ws_router.get("/{workspace_id}/invites")
    async def list_invites(
        workspace_id: str,
        current_user: User  = Depends(get_current_user),
        db: Session         = Depends(get_db),
    ):
        from app.core.permissions import require_workspace_member
        require_workspace_member(current_user, workspace_id, db, min_role=Role.admin)

        invites = db.query(WorkspaceInvite).filter(
            WorkspaceInvite.workspace_id == workspace_id,
            WorkspaceInvite.used_at == None,  # noqa: E711
            WorkspaceInvite.expires_at > datetime.utcnow(),
        ).all()
        return [
            {
                "id": inv.id,
                "token": inv.token,
                "url": f"{settings.frontend_url}/invite?token={inv.token}",
                "role": inv.role,
                "email": inv.email,
                "expires_at": inv.expires_at.isoformat(),
                "created_at": inv.created_at.isoformat(),
            }
            for inv in invites
        ]

    @ws_router.delete("/{workspace_id}/invites/{invite_id}", status_code=204)
    async def revoke_invite(
        workspace_id: str,
        invite_id: str,
        current_user: User  = Depends(get_current_user),
        db: Session         = Depends(get_db),
    ):
        from app.core.permissions import require_workspace_member
        require_workspace_member(current_user, workspace_id, db, min_role=Role.admin)

        invite = db.query(WorkspaceInvite).filter(
            WorkspaceInvite.id == invite_id,
            WorkspaceInvite.workspace_id == workspace_id,
        ).first()
        if invite:
            db.delete(invite)
            db.commit()

    return ws_router


workspace_invites_router = _workspace_invites_router()
