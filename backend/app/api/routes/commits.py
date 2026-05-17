from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.commit import Commit
from app.schemas.commit import CommitOut, CommitDetail
from app.core.security import get_current_user
from app.core.permissions import require_project_access
from app.core.exceptions import NotFoundError
from app.services import git_service

router = APIRouter(prefix="/commits", tags=["commits"])


@router.get("/{project_id}")
async def list_commits(
    project_id: str,
    branch: str         = Query(None),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project        = require_project_access(current_user, project_id, db)
    target_branch  = branch or project.default_branch

    if project.local_path:
        # Fetch ALL commits from git for the specified branch (no limit)
        git_commits = git_service.get_commits(project.local_path, target_branch, limit=None)

        # Build SHA → DB commit map for documentation status
        shas_chunk = [c["sha"] for c in git_commits[:2000]]
        db_by_sha = {
            c.sha: c
            for c in db.query(Commit).filter(
                Commit.project_id == project_id,
                Commit.sha.in_(shas_chunk),
            ).all()
        }

        return [
            {
                "id": db_by_sha[c["sha"]].id if c["sha"] in db_by_sha else c["sha"],
                "sha": c["sha"],
                "message": c["message"],
                "author_name": c["author_name"],
                "author_email": c["author_email"],
                "committed_at": c["committed_at"].isoformat(),
                "is_documented": db_by_sha[c["sha"]].is_documented if c["sha"] in db_by_sha else False,
            }
            for c in git_commits
        ]

    # Fallback: no local repo, query DB
    return db.query(Commit).filter(
        Commit.project_id == project_id
    ).order_by(Commit.committed_at.desc()).all()


@router.get("/{project_id}/{sha}", response_model=CommitDetail)
async def get_commit(
    project_id: str,
    sha: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)

    commit = db.query(Commit).filter(
        Commit.project_id == project_id,
        Commit.sha == sha,
    ).first()
    if not commit:
        raise NotFoundError("Commit")

    # Get files changed from git
    files_changed  = []
    stats          = {}
    if project.local_path:
        diffs          = git_service.get_commit_diff(project.local_path, sha)
        files_changed  = [d["file_path"] for d in diffs]
        total_add      = sum(d.get("additions", 0) for d in diffs)
        total_del      = sum(d.get("deletions", 0) for d in diffs)
        stats = {
            "additions": total_add,
            "deletions": total_del,
            "files_changed": len(diffs),
        }

    detail                = CommitDetail.model_validate(commit)
    detail.files_changed  = files_changed
    detail.stats          = stats
    return detail


@router.get("/{project_id}/{sha}/diff")
async def get_commit_diff(
    project_id: str,
    sha: str,
    path: str           = Query(None, description="Filter to a specific file"),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    if not project.local_path:
        raise NotFoundError("Repository")

    diffs = git_service.get_commit_diff(project.local_path, sha)

    if path:
        diffs = [d for d in diffs if d["file_path"] == path]

    return diffs