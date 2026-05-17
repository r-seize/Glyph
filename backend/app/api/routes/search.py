from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.core.security import get_current_user
from app.services import search_service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/")
async def search(
    q: str                       = Query(..., min_length=1),
    workspace_id: Optional[str]  = Query(None),
    type: str                    = Query("all"),
    limit: int                   = Query(20, ge=1, le=50),
    current_user: User           = Depends(get_current_user),
    db: Session                  = Depends(get_db),
):
    if workspace_id:
        from app.core.permissions import require_workspace_member
        require_workspace_member(current_user, workspace_id, db)
        workspace_ids = [workspace_id]
    else:
        memberships = db.query(WorkspaceMember).filter(
            WorkspaceMember.user_id == current_user.id
        ).all()
        workspace_ids = [m.workspace_id for m in memberships]

    return search_service.search(
        query          = q,
        workspace_ids  = workspace_ids,
        result_type    = type,
        limit          = limit,
        db             = db,
    )