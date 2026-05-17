from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember, Role
from app.models.project import Project
from app.schemas.workspace import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceOut, WorkspaceDetail,
    WorkspaceMemberOut, InviteUser, UpdateMemberRole,
)
from app.core.security import get_current_user
from app.core.permissions import require_workspace_member, can_manage_workspace
from app.core.exceptions import NotFoundError, ConflictError, PermissionError
from app.utils.file_utils import slugify

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _workspace_out(ws: Workspace, db: Session) -> WorkspaceOut:
    member_count = db.query(func.count(WorkspaceMember.id)).filter(
        WorkspaceMember.workspace_id == ws.id
    ).scalar() or 0
    project_count = db.query(func.count(Project.id)).filter(
        Project.workspace_id == ws.id
    ).scalar() or 0

    out                = WorkspaceOut.model_validate(ws)
    out.member_count   = member_count
    out.project_count  = project_count
    return out


@router.get("/", response_model=list[WorkspaceOut])
async def list_workspaces(
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    memberships = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.user_id == current_user.id)
        .all()
    )
    workspaces = [db.get(Workspace, m.workspace_id) for m in memberships]
    return [_workspace_out(ws, db) for ws in workspaces if ws]


@router.post("/", response_model=WorkspaceOut, status_code=201)
async def create_workspace(
    payload: WorkspaceCreate,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    slug            = slugify(payload.name)
    # Ensure unique slug
    base_slug  = slug
    counter    = 1
    while db.query(Workspace).filter(Workspace.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    ws = Workspace(name=payload.name, slug=slug, owner_id=current_user.id)
    db.add(ws)
    db.flush()

    member = WorkspaceMember(
        workspace_id  = ws.id,
        user_id       = current_user.id,
        role          = Role.owner,
    )
    db.add(member)
    db.commit()
    db.refresh(ws)
    return _workspace_out(ws, db)


@router.get("/{workspace_id}", response_model=WorkspaceDetail)
async def get_workspace(
    workspace_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    ws = db.get(Workspace, workspace_id)
    if not ws:
        raise NotFoundError("Workspace")
    require_workspace_member(current_user, workspace_id, db)
    out               = WorkspaceDetail.model_validate(ws)
    out.member_count  = len(ws.members)
    out.members       = [WorkspaceMemberOut.model_validate(m) for m in ws.members]
    return out


@router.put("/{workspace_id}", response_model=WorkspaceOut)
async def update_workspace(
    workspace_id: str,
    payload: WorkspaceUpdate,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    ws = db.get(Workspace, workspace_id)
    if not ws:
        raise NotFoundError("Workspace")
    require_workspace_member(current_user, workspace_id, db, min_role=Role.admin)

    if payload.name:
        ws.name = payload.name
    db.commit()
    db.refresh(ws)
    return _workspace_out(ws, db)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    workspace_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    ws = db.get(Workspace, workspace_id)
    if not ws:
        raise NotFoundError("Workspace")
    if ws.owner_id != current_user.id:
        raise PermissionError("Only the workspace owner can delete it")
    db.delete(ws)
    db.commit()


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberOut])
async def list_members(
    workspace_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_workspace_member(current_user, workspace_id, db)
    members = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id
    ).all()
    return [WorkspaceMemberOut.model_validate(m) for m in members]


@router.post("/{workspace_id}/invite", response_model=WorkspaceMemberOut, status_code=201)
async def invite_member(
    workspace_id: str,
    payload: InviteUser,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_workspace_member(current_user, workspace_id, db, min_role=Role.admin)

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise NotFoundError("No Glyph account found with this email")

    existing = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user.id,
    ).first()
    if existing:
        raise ConflictError("User is already a member of this workspace")

    member = WorkspaceMember(
        workspace_id  = workspace_id,
        user_id       = user.id,
        role          = payload.role,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return WorkspaceMemberOut.model_validate(member)


@router.put("/{workspace_id}/members/{user_id}", response_model=WorkspaceMemberOut)
async def update_member_role(
    workspace_id: str,
    user_id: str,
    payload: UpdateMemberRole,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_workspace_member(current_user, workspace_id, db, min_role=Role.admin)

    ws = db.get(Workspace, workspace_id)
    if ws and ws.owner_id == user_id:
        raise PermissionError("Cannot change the owner's role")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first()
    if not member:
        raise NotFoundError("Member")

    member.role = payload.role
    db.commit()
    db.refresh(member)
    return WorkspaceMemberOut.model_validate(member)


@router.delete("/{workspace_id}/leave", status_code=204)
async def leave_workspace(
    workspace_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    ws = db.get(Workspace, workspace_id)
    if ws and ws.owner_id == current_user.id:
        raise PermissionError("The workspace owner cannot leave - transfer ownership first")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise NotFoundError("Member")

    db.delete(member)
    db.commit()


@router.delete("/{workspace_id}/members/{user_id}", status_code=204)
async def remove_member(
    workspace_id: str,
    user_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_workspace_member(current_user, workspace_id, db, min_role=Role.admin)

    ws = db.get(Workspace, workspace_id)
    if ws and ws.owner_id == user_id:
        raise PermissionError("Cannot remove the workspace owner")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == user_id,
    ).first()
    if not member:
        raise NotFoundError("Member")

    db.delete(member)
    db.commit()