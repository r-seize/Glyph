from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
import mimetypes
import os
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.document import Document
from app.core.security import get_current_user
from app.core.permissions import require_project_access
from app.core.exceptions import NotFoundError
from app.services import git_service
from app.utils.file_utils import is_binary_file, language_from_extension

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/{project_id}/tree")
async def get_file_tree(
    project_id: str,
    commit: str         = Query(None, description="Commit SHA (defaults to HEAD)"),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    if not project.local_path:
        return []

    tree = git_service.get_tree(project.local_path, commit)

    # Enrich with documentation status
    documented_paths = {
        d.file_path
        for d in db.query(Document.file_path)
        .filter(Document.project_id == project_id)
        .all()
    }
    for node in tree:
        node["is_documented"] = node["path"] in documented_paths

    return tree


@router.get("/{project_id}/content")
async def get_file_content(
    project_id: str,
    path: str           = Query(..., description="File path relative to repo root"),
    commit: str         = Query(None, description="Commit SHA (defaults to HEAD)"),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    if not project.local_path:
        raise NotFoundError("Repository")

    if is_binary_file(path):
        return {"content": None, "binary": True, "language": language_from_extension(path)}

    # Resolve HEAD if no commit specified
    if not commit:
        head_sha: str | None = git_service.get_head_sha(project.local_path, project.default_branch)
        if not head_sha:
            raise NotFoundError("Repository HEAD")
        commit = head_sha

    content = git_service.get_file_content(project.local_path, path, commit)
    if content is None:
        raise NotFoundError("File")

    return {
        "content": content,
        "binary": False,
        "language": language_from_extension(path),
        "commit_sha": commit,
        "path": path,
    }


@router.get("/{project_id}/raw")
async def get_raw_file(
    project_id: str,
    path: str           = Query(...),
    commit: str         = Query(None),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    if not project.local_path:
        raise NotFoundError("Repository")

    from git import Repo
    from app.core.exceptions import NotFoundError as NFE
    try:
        repo  = Repo(project.local_path)
        sha   = commit or git_service.get_head_sha(project.local_path, project.default_branch)
        blob  = repo.commit(sha).tree[path]
        data  = blob.data_stream.read()
    except Exception:
        raise NotFoundError("File")

    mime, _ = mimetypes.guess_type(path)
    return Response(content=data, media_type=mime or "application/octet-stream")


@router.get("/{project_id}/history")
async def get_file_history(
    project_id: str,
    path: str           = Query(..., description="File path relative to repo root"),
    branch: str         = Query(None, description="Branch name (defaults to project default)"),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    if not project.local_path:
        return []

    target_branch  = branch or project.default_branch
    history        = git_service.get_file_history(project.local_path, path, target_branch)

    # Enrich with doc status
    documented_shas = {
        d.commit_sha
        for d in db.query(Document.commit_sha)
        .filter(Document.project_id == project_id, Document.file_path == path)
        .all()
    }
    for entry in history:
        entry["is_documented"] = entry["sha"] in documented_shas

    return history


@router.get("/{project_id}/languages")
async def get_language_stats(
    project_id: str,
    commit: str         = Query(None),
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    if not project.local_path:
        return {}

    return git_service.get_language_stats(project.local_path, commit)


@router.get("/{project_id}/branches")
async def get_branches(
    project_id: str,
    current_user: User  = Depends(get_current_user),
    db: Session         = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    if not project.local_path:
        return []
    return git_service.get_remote_tracking_branches(project.local_path)


_IGNORE_DIRS: set[str] = {
    "node_modules", ".git", "dist", "build", "__pycache__", ".venv", "venv",
    ".next", ".nuxt", "out", ".turbo", ".cache", "vendor", "target",
    ".gradle", ".idea", ".vscode", "coverage", ".mypy_cache", ".pytest_cache",
    ".tox", "eggs", ".eggs", "htmlcov", ".sass-cache", "tmp", "temp",
    "Pods", "DerivedData", ".pub-cache", ".dart_tool",
}

_IGNORE_FILES: set[str] = {
    ".DS_Store", "Thumbs.db", "desktop.ini",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "composer.lock", "Gemfile.lock", "poetry.lock", "Pipfile.lock",
    "bun.lockb",
}

_IGNORE_EXTENSIONS: set[str] = {
    ".pyc", ".pyo", ".pyd", ".so", ".dll", ".exe", ".bin",
    ".log", ".map", ".lock",
}


def _should_ignore(rel_path: str) -> bool:
    parts     = rel_path.replace("\\", "/").split("/")
    filename  = parts[-1]
    # Ignore .env files (any variant)
    if filename == ".env" or filename.startswith(".env."):
        return True
    # Ignore hidden/generated directories
    for part in parts[:-1]:
        if part in _IGNORE_DIRS or part.startswith(".env"):
            return True
    if filename in _IGNORE_FILES:
        return True
    ext = os.path.splitext(filename)[1].lower()
    if ext in _IGNORE_EXTENSIONS:
        return True
    return False


@router.post("/{project_id}/upload")
async def upload_files(
    project_id: str,
    files: list[UploadFile]  = File(...),
    paths: list[str]         = Form(...),
    current_user: User       = Depends(get_current_user),
    db: Session              = Depends(get_db),
):
    project = require_project_access(current_user, project_id, db)
    if not project.local_path:
        raise NotFoundError("Repository")

    from git import Repo, Actor

    repo     = Repo(project.local_path)
    written  = 0

    for upload_file, rel_path in zip(files, paths):
        if _should_ignore(rel_path):
            continue
        dest = os.path.join(project.local_path, rel_path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        content = await upload_file.read()
        with open(dest, "wb") as f:
            f.write(content)
        written += 1

    if written == 0:
        return {"uploaded": 0, "ignored": len(files)}

    repo.git.add("--all")
    author = Actor(current_user.username, current_user.email)

    # Detect whether there are staged changes (fresh repo has no HEAD yet)
    is_fresh = not repo.head.is_valid()
    if is_fresh:
        has_staged = bool(repo.index.entries)
    else:
        has_staged = bool(repo.index.diff("HEAD"))

    if has_staged:
        repo.index.commit(
            f"Initial import ({written} files)",
            author     = author,
            committer  = author,
        )
        # Ensure the branch matches the project default_branch
        current = repo.active_branch.name
        if current != project.default_branch:
            repo.head.reference.rename(project.default_branch)

    return {"uploaded": written, "ignored": len(files) - written}