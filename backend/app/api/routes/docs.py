from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.comment import Comment
from app.models.workspace import Workspace
from app.schemas.document import DocumentCreate, DocumentUpdate, DocumentOut, DocumentVersion
from app.schemas.comment import CommentCreate, CommentUpdate, CommentOut
from app.schemas.user import UserOut
from app.core.security import get_current_user
from app.core.permissions import require_project_access, can_edit_doc
from app.core.exceptions import NotFoundError, PermissionError
from app.models.workspace import Role
from app.services import doc_service, search_service

router = APIRouter(prefix="/docs", tags=["docs"])


@router.get("/{project_id}", response_model=DocumentOut | None)
async def get_doc(
    project_id: str,
    path: str           = Query(..., description="File path"),
    commit: str         = Query(..., description="Commit SHA"),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db)
    doc = doc_service.get_doc(project_id, path, commit, db)
    if not doc:
        return None
    return DocumentOut.model_validate(doc)


@router.post("/{project_id}", response_model=DocumentOut, status_code=201)
async def save_doc(
    project_id: str,
    payload: DocumentCreate,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db, min_role=Role.developer)

    doc = doc_service.save_doc(
        project_id  = project_id,
        file_path   = payload.file_path,
        commit_sha  = payload.commit_sha,
        content     = payload.content,
        author_id   = current_user.id,
        db          = db,
    )

    # Index in search
    ws = db.get(Workspace, project.workspace_id)
    if ws:
        search_service.index_document(doc, ws.id)

    return DocumentOut.model_validate(doc)


@router.get("/{project_id}/history", response_model=list[DocumentVersion])
async def get_doc_history(
    project_id: str,
    path: str           = Query(..., description="File path"),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db)
    history  = doc_service.get_doc_history(project_id, path, db)
    result   = []
    for doc in history:
        result.append(DocumentVersion(
            commit_sha  = doc.commit_sha,
            author      = UserOut.model_validate(doc.author) if doc.author else None,
            updated_at  = doc.updated_at,
            preview     = doc.content[:200],
        ))
    return result


# ── Comments ──────────────────────────────────────────────────────────────────

@router.get("/{project_id}/comments", response_model=list[CommentOut])
async def list_comments(
    project_id: str,
    path: str           = Query(...),
    commit: str         = Query(...),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db)
    doc = doc_service.get_doc(project_id, path, commit, db)
    if not doc:
        return []
    return [CommentOut.model_validate(c) for c in doc.comments]


@router.post("/{project_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    project_id: str,
    payload: CommentCreate,
    path: str           = Query(...),
    commit: str         = Query(...),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db, min_role=Role.developer)
    doc = doc_service.get_doc(project_id, path, commit, db)
    if not doc:
        # Auto-create an empty document so comments always have a parent
        doc = doc_service.save_doc(
            project_id  = project_id,
            file_path   = path,
            commit_sha  = commit,
            content     = "",
            author_id   = current_user.id,
            db          = db,
        )

    comment = Comment(
        document_id  = doc.id,
        author_id    = current_user.id,
        content      = payload.content,
        line_number  = payload.line_number,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentOut.model_validate(comment)


@router.put("/{project_id}/comments/{comment_id}", response_model=CommentOut)
async def update_comment(
    project_id: str,
    comment_id: str,
    payload: CommentUpdate,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db)
    comment = db.get(Comment, comment_id)
    if not comment:
        raise NotFoundError("Comment")
    if comment.author_id != current_user.id:
        raise PermissionError("You can only edit your own comments")

    comment.content = payload.content
    db.commit()
    db.refresh(comment)
    return CommentOut.model_validate(comment)


@router.delete("/{project_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    project_id: str,
    comment_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project  = require_project_access(current_user, project_id, db)
    comment  = db.get(Comment, comment_id)
    if not comment:
        raise NotFoundError("Comment")

    # Author or admin+ can delete
    member = None
    from app.models.workspace import WorkspaceMember
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == project.workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    is_admin = member and member.role in (Role.admin, Role.owner)

    if comment.author_id != current_user.id and not is_admin:
        raise PermissionError("You can only delete your own comments")

    db.delete(comment)
    db.commit()