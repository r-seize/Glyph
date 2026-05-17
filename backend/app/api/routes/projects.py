import os
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.models.workspace import Workspace, Role
from app.models.commit import Commit
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut
from app.core.security import get_current_user
from app.core.permissions import require_workspace_member, require_project_access
from app.core.exceptions import NotFoundError, PermissionError
from app.utils.file_utils import slugify, get_repo_path
from app.services import git_service, doc_service, search_service
from app.core.crypto import decrypt

router = APIRouter(prefix="/projects", tags=["projects"])


def _build_project_out(project: Project, db: Session) -> ProjectOut:
    stats = doc_service.get_project_stats(project.id, db)
    # Get total files from git tree if repo exists
    if project.local_path and os.path.exists(project.local_path):
        tree               = git_service.get_tree(project.local_path)
        stats.total_files  = sum(1 for f in tree if f["type"] == "file")
    out        = ProjectOut.model_validate(project)
    out.stats  = stats
    return out


async def _sync_project_task(
    project_id: str,
    db: Session,
    access_token: str | None  = None,
    force_reset: bool         = False,
    discard_deleted: bool     = False,
) -> None:
    project = db.get(Project, project_id)
    if not project or not project.local_path:
        return

    # Pull latest (force reset to remote state when resolving diverged history)
    if project.repo_url:
        git_service.pull_repo(project.local_path, project.default_branch, access_token=access_token, force_reset=force_reset)

    # Sync ALL commits to DB (no limit)
    commits = git_service.get_commits(project.local_path, project.default_branch, limit=None)
    existing_shas = {
        c.sha for c in db.query(Commit.sha).filter(Commit.project_id == project_id)
    }
    for c in commits:
        if c["sha"] not in existing_shas:
            commit = Commit(
                project_id    = project_id,
                sha           = c["sha"],
                message       = c["message"],
                author_name   = c["author_name"],
                author_email  = c["author_email"],
                committed_at  = c["committed_at"],
            )
            db.add(commit)

    # Remove commits from DB that no longer exist on remote
    if discard_deleted:
        current_shas = {c["sha"] for c in commits}
        db.query(Commit).filter(
            Commit.project_id == project_id,
            ~Commit.sha.in_(current_shas),
        ).delete(synchronize_session=False)

    project.last_synced_at = datetime.now(timezone.utc)
    db.commit()

    # Index in Meilisearch
    ws = db.get(Workspace, project.workspace_id)
    if ws:
        search_service.index_project(project_id, ws.id, db)
        tree = git_service.get_tree(project.local_path)
        search_service.index_files(project_id, ws.id, tree)
        head_sha = git_service.get_head_sha(project.local_path, project.default_branch)
        if head_sha:
            search_service.index_code_files(project_id, ws.id, project.local_path, head_sha, tree)


@router.get("/workspace/{workspace_id}", response_model=list[ProjectOut])
async def list_projects(
    workspace_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_workspace_member(current_user, workspace_id, db)
    projects = db.query(Project).filter(Project.workspace_id == workspace_id).all()
    return [_build_project_out(p, db) for p in projects]


@router.post("/workspace/{workspace_id}", response_model=ProjectOut, status_code=201)
async def create_project(
    workspace_id: str,
    payload: ProjectCreate,
    background_tasks: BackgroundTasks,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    require_workspace_member(current_user, workspace_id, db, min_role=Role.developer)

    slug       = slugify(payload.name)
    base_slug  = slug
    counter    = 1
    while db.query(Project).filter(
        Project.workspace_id == workspace_id, Project.slug == slug
    ).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    project = Project(
        workspace_id    = workspace_id,
        name            = payload.name,
        slug            = slug,
        description     = payload.description,
        repo_url        = payload.repo_url,
        default_branch  = payload.default_branch,
        webhook_secret  = secrets.token_hex(32),
    )
    db.add(project)
    db.flush()

    # Set local path and clone/init
    local_path          = get_repo_path(project.id)
    project.local_path  = local_path

    user_token = decrypt(current_user.github_token_encrypted) if current_user.github_token_encrypted else None

    if payload.repo_url:
        try:
            git_service.clone_repo(payload.repo_url, project.id, access_token=user_token)
        except Exception:
            git_service.init_local_repo(project.id, project.default_branch)
    else:
        git_service.init_local_repo(project.id, project.default_branch)

    db.commit()
    db.refresh(project)

    # Sync in background
    background_tasks.add_task(_sync_project_task, project.id, db, user_token)

    return _build_project_out(project, db)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    return _build_project_out(project, db)


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db, min_role=Role.admin)

    if payload.name is not None:
        project.name = payload.name
    if payload.description is not None:
        project.description = payload.description
    if payload.default_branch is not None:
        project.default_branch = payload.default_branch
    if payload.visibility is not None:
        project.visibility = payload.visibility

    db.commit()
    db.refresh(project)
    return _build_project_out(project, db)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db, min_role=Role.admin)

    # Delete search index
    search_service.delete_project_index(project_id)

    # Remove local clone
    if project.local_path and os.path.exists(project.local_path):
        import shutil
        shutil.rmtree(project.local_path, ignore_errors=True)

    db.delete(project)
    db.commit()


@router.post("/{project_id}/sync", response_model=ProjectOut)
async def sync_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    force: bool            = Query(False, description="Force sync even if branch or commits are gone"),
    discard_deleted: bool  = Query(False, description="Remove commits from DB that no longer exist on remote"),
    current_user: User     = Depends(get_current_user),
    db: Session            = Depends(get_db),
):
    project     = require_project_access(current_user, project_id, db, min_role=Role.developer)
    user_token  = decrypt(current_user.github_token_encrypted) if current_user.github_token_encrypted else None

    if project.repo_url and project.local_path and not force:
        remote_branches = git_service.fetch_remote_branches(project.local_path, user_token)

        # Check if the default branch still exists on remote
        if remote_branches and project.default_branch not in remote_branches:
            raise HTTPException(
                status_code=409,
                detail={
                    "type": "branch_deleted",
                    "branch": project.default_branch,
                    "available_branches": remote_branches,
                },
            )

        # Check if commits were removed from remote (force push / rebase)
        if remote_branches and project.default_branch in remote_branches:
            deleted_commits = git_service.get_deleted_commits(project.local_path, project.default_branch)
            if deleted_commits:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "type": "commits_deleted",
                        "branch": project.default_branch,
                        "deleted_commits": deleted_commits,
                    },
                )

    background_tasks.add_task(_sync_project_task, project_id, db, user_token, force_reset=force, discard_deleted=discard_deleted)
    return _build_project_out(project, db)


@router.get("/{project_id}/contributors")
async def get_contributors(
    project_id: str,
    branch: str         = Query(None),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    if not project.local_path:
        return []
    target_branch = branch or project.default_branch
    return git_service.get_contributors(project.local_path, target_branch)