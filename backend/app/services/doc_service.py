from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from app.models.document import Document
from app.models.commit import Commit
from app.models.user import User
from app.schemas.project import ProjectStats
from typing import Optional


def get_doc(project_id: str, file_path: str, commit_sha: str, db: Session) -> Optional[Document]:
    return (
        db.query(Document)
        .filter(
            Document.project_id     == project_id,
            Document.file_path      == file_path,
            Document.commit_sha     == commit_sha,
        )
        .first()
    )


def save_doc(project_id: str, file_path: str, commit_sha: str, content: str, author_id: str, db: Session) -> Document:
    doc = get_doc(project_id, file_path, commit_sha, db)
    if doc:
        doc.content    = content
        doc.author_id  = author_id
    else:
        doc = Document(
            project_id  = project_id,
            file_path   = file_path,
            commit_sha  = commit_sha,
            content     = content,
            author_id   = author_id,
        )
        db.add(doc)

    # Mark commit as documented
    commit = (
        db.query(Commit)
        .filter(Commit.project_id == project_id, Commit.sha == commit_sha)
        .first()
    )
    if commit and not commit.is_documented:
        commit.is_documented = True

    db.commit()
    db.refresh(doc)
    return doc


def get_doc_history(project_id: str, file_path: str, db: Session) -> list[Document]:
    return (
        db.query(Document)
        .filter(
            Document.project_id == project_id,
            Document.file_path == file_path,
        )
        .order_by(Document.updated_at.desc())
        .all()
    )


def get_project_stats(project_id: str, db: Session) -> ProjectStats:
    total_commits = (
        db.query(func.count(Commit.id))
        .filter(Commit.project_id == project_id)
        .scalar() or 0
    )
    documented_commits = (
        db.query(func.count(Commit.id))
        .filter(Commit.project_id == project_id, Commit.is_documented == True)
        .scalar() or 0
    )
    documented_files = (
        db.query(func.count(distinct(Document.file_path)))
        .filter(Document.project_id == project_id)
        .scalar() or 0
    )
    active_contributors = (
        db.query(func.count(distinct(Commit.author_email)))
        .filter(Commit.project_id == project_id)
        .scalar() or 0
    )
    coverage = (documented_commits / total_commits * 100) if total_commits > 0 else 0.0

    return ProjectStats(
        total_files             = 0,  # filled by caller from git tree
        documented_files        = documented_files,
        total_commits           = total_commits,
        documented_commits      = documented_commits,
        active_contributors     = active_contributors,
        documentation_coverage  = round(coverage, 1),
    )


def delete_project_docs(project_id: str, db: Session) -> None:
    db.query(Document).filter(Document.project_id == project_id).delete()
    db.commit()