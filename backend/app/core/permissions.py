from sqlalchemy.orm import Session
from app.models.workspace import WorkspaceMember, Role
from app.models.project import Project
from app.models.user import User
from app.core.exceptions import PermissionError, NotFoundError

ROLE_HIERARCHY = {
    Role.viewer: 0,
    Role.developer: 1,
    Role.admin: 2,
    Role.owner: 3,
}


def get_member(user: User, workspace_id: str, db: Session) -> WorkspaceMember | None:
    return (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
        .first()
    )


def require_workspace_member(
    user: User,
    workspace_id: str,
    db: Session,
    min_role: Role = Role.viewer,
) -> WorkspaceMember:
    member = get_member(user, workspace_id, db)
    if not member:
        raise PermissionError("You are not a member of this workspace")
    if ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[min_role]:
        raise PermissionError(f"This action requires at least the '{min_role.value}' role")
    return member


def require_project_access(
    user: User,
    project_id: str,
    db: Session,
    min_role: Role = Role.viewer,
) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise NotFoundError("Project")
    require_workspace_member(user, project.workspace_id, db, min_role)
    return project


def can_edit_doc(user: User, project_id: str, db: Session) -> bool:
    try:
        project = require_project_access(user, project_id, db, min_role=Role.developer)
        return project is not None
    except PermissionError:
        return False


def can_manage_workspace(user: User, workspace_id: str, db: Session) -> bool:
    try:
        require_workspace_member(user, workspace_id, db, min_role=Role.admin)
        return True
    except PermissionError:
        return False