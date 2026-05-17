import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.code_reference import CodeReference
from app.models.workspace import Role
from app.schemas.code_reference import (
    CodeReferenceCreate, CodeReferenceUpdate, CodeReferenceOut,
)
from app.core.security import get_current_user
from app.core.permissions import require_project_access
from app.core.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/code-refs", tags=["code-refs"])


def _validate_lines(line_start: int, line_end: int) -> None:
    if line_start < 1 or line_end < 1:
        raise ValidationError("Line numbers must be positive")
    if line_end < line_start:
        raise ValidationError("line_end must be >= line_start")


def _default_label(line_start: int, line_end: int) -> str:
    return f"L{line_start}" if line_start == line_end else f"L{line_start}-L{line_end}"


def _resolve_overlaps(
    db: Session,
    project_id: str,
    file_path: str,
    commit_sha: str,
    new_lines: set[int],
    exclude_id: str,
) -> None:
    """Remove `new_lines` from every other ref on the same file/commit.
    Refs that become empty are deleted."""
    others = (
        db.query(CodeReference)
        .filter(
            CodeReference.project_id == project_id,
            CodeReference.file_path == file_path,
            CodeReference.commit_sha == commit_sha,
            CodeReference.id != exclude_id,
        )
        .all()
    )
    for other in others:
        if other.lines:
            existing = set(json.loads(other.lines))
        else:
            existing = set(range(other.line_start, other.line_end + 1))

        remaining = sorted(existing - new_lines)
        if not remaining:
            db.delete(other)
        elif len(remaining) != len(existing):
            other.lines       = json.dumps(remaining)
            other.line_start  = remaining[0]
            other.line_end    = remaining[-1]


@router.get("/{project_id}/all", response_model=list[CodeReferenceOut])
async def list_all_refs(
    project_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db)
    refs = (
        db.query(CodeReference)
        .filter(CodeReference.project_id == project_id)
        .order_by(CodeReference.file_path.asc(), CodeReference.line_start.asc())
        .all()
    )
    return [CodeReferenceOut.model_validate(r) for r in refs]


@router.get("/{project_id}", response_model=list[CodeReferenceOut])
async def list_refs(
    project_id: str,
    path: str           = Query(..., description="File path"),
    commit: str         = Query(..., description="Commit SHA"),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db)
    refs = (
        db.query(CodeReference)
        .filter(
            CodeReference.project_id == project_id,
            CodeReference.file_path == path,
            CodeReference.commit_sha == commit,
        )
        .order_by(CodeReference.line_start.asc())
        .all()
    )
    return [CodeReferenceOut.model_validate(r) for r in refs]


@router.post("/{project_id}", response_model=CodeReferenceOut, status_code=201)
async def create_ref(
    project_id: str,
    payload: CodeReferenceCreate,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db, min_role=Role.developer)

    if payload.lines:
        line_start  = min(payload.lines)
        line_end    = max(payload.lines)
        lines_json  = json.dumps(sorted(payload.lines))
    else:
        _validate_lines(payload.line_start, payload.line_end)
        line_start  = payload.line_start
        line_end    = payload.line_end
        lines_json  = None

    label = (payload.label or "").strip() or _default_label(line_start, line_end)

    ref = CodeReference(
        project_id  = project_id,
        file_path   = payload.file_path,
        commit_sha  = payload.commit_sha,
        line_start  = line_start,
        line_end    = line_end,
        lines       = lines_json,
        label       = label,
        note        = payload.note,
        color       = payload.color,
        author_id   = current_user.id,
    )
    db.add(ref)
    db.flush()  # get ref.id before resolving overlaps

    new_lines_set = set(json.loads(lines_json)) if lines_json else set(range(line_start, line_end + 1))
    _resolve_overlaps(db, project_id, payload.file_path, payload.commit_sha, new_lines_set, ref.id)

    db.commit()
    db.refresh(ref)
    return CodeReferenceOut.model_validate(ref)


@router.put("/{project_id}/{ref_id}", response_model=CodeReferenceOut)
async def update_ref(
    project_id: str,
    ref_id: str,
    payload: CodeReferenceUpdate,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db, min_role=Role.developer)
    ref = db.get(CodeReference, ref_id)
    if not ref or ref.project_id != project_id:
        raise NotFoundError("Code reference")

    if payload.lines:
        sorted_lines    = sorted(payload.lines)
        ref.lines       = json.dumps(sorted_lines)
        ref.line_start  = sorted_lines[0]
        ref.line_end    = sorted_lines[-1]
        _resolve_overlaps(db, project_id, ref.file_path, ref.commit_sha, set(sorted_lines), ref.id)
    else:
        if payload.line_start is not None:
            ref.line_start = payload.line_start
        if payload.line_end is not None:
            ref.line_end = payload.line_end
        _validate_lines(ref.line_start, ref.line_end)
    # If `label` was explicitly sent (even as null or empty string), compute the
    # default from the current line range when it ends up empty. Fields that are
    # not present in the request keep their previous value.
    if "label" in payload.model_fields_set:
        label_str  = (payload.label or "").strip()
        ref.label  = label_str or _default_label(ref.line_start, ref.line_end)
    if payload.note is not None:
        ref.note = payload.note
    if payload.color is not None:
        ref.color = payload.color

    db.commit()
    db.refresh(ref)
    return CodeReferenceOut.model_validate(ref)


@router.delete("/{project_id}/{ref_id}", status_code=204)
async def delete_ref(
    project_id: str,
    ref_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_project_access(current_user, project_id, db, min_role=Role.developer)
    ref = db.get(CodeReference, ref_id)
    if not ref or ref.project_id != project_id:
        raise NotFoundError("Code reference")
    db.delete(ref)
    db.commit()
