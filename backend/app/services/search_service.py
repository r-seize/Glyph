import meilisearch
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.config import settings
from app.models.document import Document
from app.models.commit import Commit
from app.models.project import Project
from typing import Optional

_client: Optional[meilisearch.Client]  = None
_indexes_ready: bool                   = False

DOCS_INDEX      = "documents"
COMMITS_INDEX   = "commits"
FILES_INDEX     = "files"
CODE_INDEX      = "code"
MEILI_TIMEOUT   = 5  # seconds
CODE_MAX_FILES  = 500   # max files indexed per project
CODE_MAX_CHARS  = 3000  # max content chars stored per file


def _get_client() -> meilisearch.Client:
    global _client
    if _client is None:
        _client = meilisearch.Client(
            settings.meilisearch_url,
            settings.meilisearch_key,
            timeout=MEILI_TIMEOUT,
        )
    return _client


def _ensure_indexes() -> None:
    global _indexes_ready
    if _indexes_ready:
        return
    try:
        client = _get_client()
        for index_uid, primary_key in [
            (DOCS_INDEX, "id"),
            (COMMITS_INDEX, "id"),
            (FILES_INDEX, "id"),
            (CODE_INDEX, "id"),
        ]:
            try:
                client.create_index(index_uid, {"primaryKey": primary_key})
            except Exception:
                pass

        client.index(DOCS_INDEX).update_searchable_attributes(
            ["content", "file_path", "project_id"]
        )
        client.index(COMMITS_INDEX).update_searchable_attributes(
            ["message", "author_name", "sha"]
        )
        client.index(FILES_INDEX).update_searchable_attributes(
            ["path", "name", "language"]
        )
        client.index(CODE_INDEX).update_searchable_attributes(
            ["content", "path", "name"]
        )
        for idx in [DOCS_INDEX, COMMITS_INDEX, FILES_INDEX, CODE_INDEX]:
            client.index(idx).update_filterable_attributes(["project_id", "workspace_id"])
        _indexes_ready = True
    except Exception:
        pass


def index_document(doc: Document, workspace_id: str) -> None:
    try:
        _get_client().index(DOCS_INDEX).add_documents([{
            "id": doc.id,
            "project_id": doc.project_id,
            "workspace_id": workspace_id,
            "file_path": doc.file_path,
            "commit_sha": doc.commit_sha,
            "content": doc.content[:5000],
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        }])
    except Exception:
        pass


def index_commit(commit: Commit, workspace_id: str) -> None:
    try:
        _get_client().index(COMMITS_INDEX).add_documents([{
            "id": commit.id,
            "project_id": commit.project_id,
            "workspace_id": workspace_id,
            "sha": commit.sha,
            "message": commit.message,
            "author_name": commit.author_name,
            "author_email": commit.author_email,
            "committed_at": commit.committed_at.isoformat() if commit.committed_at else None,
            "is_documented": commit.is_documented,
        }])
    except Exception:
        pass


def index_files(project_id: str, workspace_id: str, files: list[dict]) -> None:
    try:
        docs = []
        for f in files:
            if f["type"] == "file":
                docs.append({
                    "id": f"{project_id}__{f['path'].replace('/', '__')}",
                    "project_id": project_id,
                    "workspace_id": workspace_id,
                    "path": f["path"],
                    "name": f["name"],
                    "language": f.get("language", "Text"),
                })
        if docs:
            _get_client().index(FILES_INDEX).add_documents(docs)
    except Exception:
        pass


def index_code_files(
    project_id: str,
    workspace_id: str,
    local_path: str,
    commit_sha: str,
    tree: list[dict],
) -> None:
    """Index actual file contents for code search. Called at project sync time."""
    try:
        from app.services.git_service import get_file_content
        docs   = []
        count  = 0
        for f in tree:
            if f["type"] != "file" or count >= CODE_MAX_FILES:
                break
            content = get_file_content(local_path, f["path"], commit_sha)
            if not content:
                continue
            docs.append({
                "id": f"{project_id}__{f['path'].replace('/', '__')}__code",
                "project_id": project_id,
                "workspace_id": workspace_id,
                "path": f["path"],
                "name": f["name"],
                "language": f.get("language", ""),
                "content": content[:CODE_MAX_CHARS],
            })
            count += 1
            if len(docs) >= 50:
                _get_client().index(CODE_INDEX).add_documents(docs)
                docs = []
        if docs:
            _get_client().index(CODE_INDEX).add_documents(docs)
    except Exception:
        pass


def index_project(project_id: str, workspace_id: str, db: Session) -> None:
    _ensure_indexes()
    docs = db.query(Document).filter(Document.project_id == project_id).all()
    for doc in docs:
        index_document(doc, workspace_id)
    commits = db.query(Commit).filter(Commit.project_id == project_id).all()
    for commit in commits:
        index_commit(commit, workspace_id)


def _db_search(query: str, workspace_ids: list[str], db: Session, limit: int) -> dict:
    """Reliable SQL-based search - always runs regardless of Meilisearch state."""
    like = f"%{query}%"

    # Project IDs accessible to the user
    project_subq = db.query(Project.id, Project.workspace_id, Project.name).filter(
        Project.workspace_id.in_(workspace_ids)
    ).subquery()

    # Projects by name / description
    projects_q = db.query(Project).filter(
        Project.workspace_id.in_(workspace_ids),
        or_(Project.name.ilike(like), Project.description.ilike(like)),
    ).limit(5).all()

    projects = [{
        "type": "project",
        "title": p.name,
        "excerpt": p.description or "",
        "project_id": p.id,
        "workspace_id": p.workspace_id,
    } for p in projects_q]

    # Commits by message or sha
    commits_q = db.query(Commit).filter(
        Commit.project_id.in_(
            db.query(Project.id).filter(Project.workspace_id.in_(workspace_ids))
        ),
        or_(Commit.message.ilike(like), Commit.sha.ilike(like)),
    ).order_by(Commit.committed_at.desc()).limit(limit).all()

    # Map project_id → workspace_id
    proj_ws: dict[str, str] = {
        p.id: p.workspace_id
        for p in db.query(Project).filter(Project.workspace_id.in_(workspace_ids)).all()
    }

    commits = [{
        "type": "commit",
        "title": c.message.splitlines()[0],
        "sha": c.sha,
        "project_id": c.project_id,
        "workspace_id": proj_ws.get(c.project_id, ""),
    } for c in commits_q]

    # Docs by content or file path
    docs_q = db.query(Document).filter(
        Document.project_id.in_(
            db.query(Project.id).filter(Project.workspace_id.in_(workspace_ids))
        ),
        or_(Document.content.ilike(like), Document.file_path.ilike(like)),
    ).limit(limit).all()

    docs = [{
        "type": "doc",
        "title": d.file_path,
        "excerpt": next(
            (line.strip() for line in (d.content or "").splitlines() if query.lower() in line.lower()),
            (d.content or "")[:100],
        ),
        "path": d.file_path,
        "project_id": d.project_id,
        "workspace_id": proj_ws.get(d.project_id, ""),
    } for d in docs_q]

    return {"projects": projects, "commits": commits, "docs": docs, "files": []}


def _meili_search(query: str, workspace_ids: list[str], result_type: str, limit: int) -> dict:
    """Meilisearch full-text search - supplements DB results, silent on failure."""
    results: dict = {"docs": [], "commits": [], "files": [], "code": []}

    if len(workspace_ids) == 1:
        filter_expr = f'workspace_id = "{workspace_ids[0]}"'
    else:
        ids          = ", ".join(f'"{w}"' for w in workspace_ids)
        filter_expr  = f"workspace_id IN [{ids}]"

    if result_type in ("all", "docs"):
        try:
            r = _get_client().index(DOCS_INDEX).search(query, {
                "filter": filter_expr,
                "limit": limit,
                "attributesToHighlight": ["content"],
                "highlightPreTag": "",
                "highlightPostTag": "",
            })
            for hit in r.get("hits", []):
                highlighted = hit.get("_formatted", {})
                results["docs"].append({
                    "type": "doc",
                    "title": hit.get("file_path", ""),
                    "excerpt": (highlighted.get("content") or hit.get("content") or "")[:120],
                    "path": hit.get("file_path"),
                    "project_id": hit.get("project_id"),
                    "workspace_id": hit.get("workspace_id"),
                })
        except Exception:
            pass

    if result_type in ("all", "commits"):
        try:
            r = _get_client().index(COMMITS_INDEX).search(query, {
                "filter": filter_expr,
                "limit": limit,
            })
            for hit in r.get("hits", []):
                results["commits"].append({
                    "type": "commit",
                    "title": (hit.get("message") or "").splitlines()[0],
                    "sha": hit.get("sha"),
                    "project_id": hit.get("project_id"),
                    "workspace_id": hit.get("workspace_id"),
                })
        except Exception:
            pass

    if result_type in ("all", "files"):
        try:
            r = _get_client().index(FILES_INDEX).search(query, {
                "filter": filter_expr,
                "limit": limit,
            })
            for hit in r.get("hits", []):
                results["files"].append({
                    "type": "file",
                    "title": hit.get("name", ""),
                    "path": hit.get("path"),
                    "project_id": hit.get("project_id"),
                    "workspace_id": hit.get("workspace_id"),
                })
        except Exception:
            pass

    if result_type in ("all", "code"):
        try:
            r = _get_client().index(CODE_INDEX).search(query, {
                "filter": filter_expr,
                "limit": limit,
                "attributesToHighlight": ["content"],
                "highlightPreTag": "",
                "highlightPostTag": "",
            })
            for hit in r.get("hits", []):
                formatted    = hit.get("_formatted", {})
                raw_content  = formatted.get("content") or hit.get("content") or ""
                # Find the matching line for the excerpt
                excerpt = next(
                    (line.strip() for line in raw_content.splitlines() if query.lower() in line.lower()),
                    raw_content[:120],
                )
                results["code"].append({
                    "type": "code",
                    "title": hit.get("name", hit.get("path", "")),
                    "path": hit.get("path"),
                    "language": hit.get("language", ""),
                    "excerpt": excerpt[:120],
                    "project_id": hit.get("project_id"),
                    "workspace_id": hit.get("workspace_id"),
                })
        except Exception:
            pass

    return results


def search(query: str, workspace_ids: list[str], result_type: str = "all", limit: int = 20, db: Optional[Session] = None) -> dict:
    results: dict = {"docs": [], "commits": [], "files": [], "projects": [], "code": [], "total": 0}
    try:
        _ensure_indexes()

        if not workspace_ids:
            return results

        # SQL search (always reliable)
        if db:
            db_res               = _db_search(query, workspace_ids, db, limit)
            results["projects"]  = db_res["projects"]
            results["commits"]   = db_res["commits"]
            results["docs"]      = db_res["docs"]

        # Meilisearch (adds full-text results, deduped by title+project)
        meili_res      = _meili_search(query, workspace_ids, result_type, limit)
        _seen_docs     = {(r["title"], r["project_id"]) for r in results["docs"]}
        _seen_commits  = {(r["sha"],) for r in results["commits"] if r.get("sha")}
        _seen_code     = {(r["path"], r["project_id"]) for r in results["code"] if r.get("path")}

        for d in meili_res["docs"]:
            key = (d["title"], d["project_id"])
            if key not in _seen_docs:
                results["docs"].append(d)
                _seen_docs.add(key)

        for c in meili_res["commits"]:
            key = (c.get("sha"),)
            if key not in _seen_commits:
                results["commits"].append(c)
                _seen_commits.add(key)

        for co in meili_res["code"]:
            key = (co.get("path"), co.get("project_id"))
            if key not in _seen_code:
                results["code"].append(co)
                _seen_code.add(key)

        results["files"]  = meili_res["files"]
        results["total"]  = sum(len(v) for k, v in results.items() if isinstance(v, list))
    except Exception:
        pass
    return results


def delete_project_index(project_id: str) -> None:
    for index_uid in [DOCS_INDEX, COMMITS_INDEX, FILES_INDEX, CODE_INDEX]:
        try:
            _get_client().index(index_uid).delete_documents_by_filter(
                f'project_id = "{project_id}"'
            )
        except Exception:
            pass
