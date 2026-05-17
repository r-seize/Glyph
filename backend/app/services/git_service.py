import os
from datetime import datetime, timezone
from typing import Any, Optional
from git import Repo, GitCommandError, InvalidGitRepositoryError
from app.utils.file_utils import (
    get_repo_path, ensure_dir, language_from_extension, is_binary_file
)


def _authed_url(repo_url: str, access_token: Optional[str]) -> str:
    if not access_token or not repo_url.startswith("https://"):
        return repo_url
    return repo_url.replace("https://", f"https://x-access-token:{access_token}@", 1)


def clone_repo(repo_url: str, project_id: str, access_token: Optional[str] = None) -> str:
    dest = get_repo_path(project_id)
    ensure_dir(os.path.dirname(dest))
    if os.path.exists(dest):
        return dest
    authed  = _authed_url(repo_url, access_token)
    repo    = Repo.clone_from(authed, dest)
    if authed != repo_url:
        try:
            repo.remotes.origin.set_url(repo_url)
        except Exception:
            pass
    return dest


def init_local_repo(project_id: str, default_branch: str = "main") -> str:
    dest = get_repo_path(project_id)
    ensure_dir(dest)
    if not os.path.exists(os.path.join(dest, ".git")):
        try:
            Repo.init(dest, initial_branch=default_branch)
        except TypeError:
            # Older GitPython versions don't support initial_branch
            repo = Repo.init(dest)
            repo.git.symbolic_ref("HEAD", f"refs/heads/{default_branch}")
    return dest


def pull_repo(local_path: str, branch: str = "main", access_token: Optional[str] = None, force_reset: bool = False) -> bool:
    def _execute(repo: Repo, origin: Any, b: str) -> None:
        if force_reset:
            origin.fetch(b)
            repo.git.reset("--hard", f"origin/{b}")
        else:
            origin.pull(b)

    try:
        repo    = Repo(local_path)
        origin  = repo.remotes.origin
        current = next(iter(origin.urls), None)
        authed  = _authed_url(current, access_token) if (access_token and current) else None
        if authed and authed != current:
            origin.set_url(authed)
            try:
                _execute(repo, origin, branch)
            finally:
                origin.set_url(current)
        else:
            _execute(repo, origin, branch)
        return True
    except GitCommandError:
        return False


def get_commits(local_path: str, branch: str = "main", limit: Optional[int] = None) -> list[dict]:
    try:
        repo     = Repo(local_path)
        results  = []
        kwargs   = {"max_count": limit} if limit else {}
        for commit in repo.iter_commits(branch, **kwargs):
            results.append({
                "sha": commit.hexsha,
                "message": commit.message.strip(),
                "author_name": commit.author.name,
                "author_email": commit.author.email,
                "committed_at": datetime.fromtimestamp(
                    commit.committed_date, tz=timezone.utc
                ),
            })
        return results
    except (GitCommandError, Exception):
        return []


def get_file_content(local_path: str, file_path: str, commit_sha: str) -> Optional[str]:
    try:
        repo    = Repo(local_path)
        commit  = repo.commit(commit_sha)
        blob    = commit.tree[file_path]
        if is_binary_file(file_path):
            return None
        return blob.data_stream.read().decode("utf-8", errors="replace")
    except (KeyError, GitCommandError, Exception):
        return None


def get_file_history(local_path: str, file_path: str, branch: Optional[str] = None) -> list[dict]:
    try:
        repo     = Repo(local_path)
        rev      = branch or repo.head.commit.hexsha
        results  = []
        for commit in repo.iter_commits(rev, paths=file_path):
            results.append({
                "sha": commit.hexsha,
                "message": commit.message.strip(),
                "author_name": commit.author.name,
                "author_email": commit.author.email,
                "committed_at": datetime.fromtimestamp(
                    commit.committed_date, tz=timezone.utc
                ),
            })
        return results
    except (GitCommandError, Exception):
        return []


def get_diff(local_path: str, sha_a: str, sha_b: str, file_path: Optional[str] = None) -> list[dict]:
    try:
        repo             = Repo(local_path)
        commit_a         = repo.commit(sha_a)
        commit_b         = repo.commit(sha_b)
        diffs            = commit_a.diff(commit_b, paths=file_path if file_path else None, create_patch=True)
        results          = []
        change_type_map  = {"A": "added", "D": "removed", "M": "modified", "R": "renamed"}
        for diff in diffs:
            change_type  = change_type_map.get(str(diff.change_type), "modified")
            raw          = diff.diff
            if isinstance(raw, bytes):
                patch: str = raw.decode("utf-8", errors="replace")
            elif isinstance(raw, (bytearray, memoryview)):
                patch = bytes(raw).decode("utf-8", errors="replace")
            elif isinstance(raw, str):
                patch = raw
            else:
                patch = ""
            results.append({
                "file_path": diff.b_path or diff.a_path,
                "old_path": diff.a_path if diff.renamed else None,
                "change_type": change_type,
                "patch": patch,
            })
        return results
    except (GitCommandError, Exception):
        return []


def get_commit_diff(local_path: str, sha: str) -> list[dict]:
    try:
        repo    = Repo(local_path)
        commit  = repo.commit(sha)
        if not commit.parents:
            # First commit - diff against empty tree
            diffs = commit.diff(None, create_patch=True)
        else:
            diffs = commit.parents[0].diff(commit, create_patch=True)
        results          = []
        change_type_map  = {"A": "added", "D": "removed", "M": "modified", "R": "renamed"}
        for diff in diffs:
            change_type  = change_type_map.get(str(diff.change_type), "modified")
            raw          = diff.diff
            if isinstance(raw, bytes):
                patch: str = raw.decode("utf-8", errors="replace")
            elif isinstance(raw, (bytearray, memoryview)):
                patch = bytes(raw).decode("utf-8", errors="replace")
            elif isinstance(raw, str):
                patch = raw
            else:
                patch = ""
            stats = _parse_patch_stats(patch)
            results.append({
                "file_path": diff.b_path or diff.a_path,
                "old_path": diff.a_path if diff.renamed else None,
                "change_type": change_type,
                "patch": patch,
                "additions": stats["additions"],
                "deletions": stats["deletions"],
            })
        return results
    except (GitCommandError, Exception):
        return []


def get_tree(local_path: str, commit_sha: Optional[str] = None) -> list[dict]:
    try:
        repo = Repo(local_path)
        if commit_sha:
            commit = repo.commit(commit_sha)
        else:
            commit = repo.head.commit
        results = []
        _walk_tree(commit.tree, "", results)
        return results
    except (GitCommandError, Exception):
        return []


def _walk_tree(tree, prefix: str, results: list) -> None:
    for item in tree:
        path = f"{prefix}{item.name}" if not prefix else f"{prefix}/{item.name}"
        if item.type == "tree":
            results.append({"path": path, "name": item.name, "type": "directory", "language": None})
            _walk_tree(item, path, results)
        else:
            results.append({
                "path": path,
                "name": item.name,
                "type": "file",
                "language": language_from_extension(item.name),
                "size": item.data_stream.read().__len__() if not is_binary_file(item.name) else 0,
            })


def get_head_sha(local_path: str, branch: str = "main") -> Optional[str]:
    try:
        repo = Repo(local_path)
        return repo.commit(branch).hexsha
    except Exception:
        try:
            return repo.head.commit.hexsha
        except Exception:
            return None


def get_branches(local_path: str) -> list[str]:
    try:
        repo = Repo(local_path)
        return [b.name for b in repo.branches]
    except Exception:
        return []


def get_remote_tracking_branches(local_path: str) -> list[str]:
    """Return branch names from the last fetch without making a new network call.
    Falls back to local branches if no remote exists."""
    try:
        repo = Repo(local_path)
        if not repo.remotes:
            return get_branches(local_path)
        origin = repo.remotes.origin
        remote = [
            ref.name.split("/", 1)[1]
            for ref in origin.refs
            if "/" in ref.name and not ref.name.endswith("/HEAD")
        ]
        return remote if remote else get_branches(local_path)
    except Exception:
        return get_branches(local_path)


def fetch_remote_branches(local_path: str, access_token: Optional[str] = None) -> list[str]:
    """Fetch from remote and return current remote branch names. Empty list if no remote."""
    try:
        repo = Repo(local_path)
        if not repo.remotes:
            return get_branches(local_path)
        origin       = repo.remotes.origin
        current_url  = next(iter(origin.urls), None)
        authed_url   = _authed_url(current_url, access_token) if current_url else None
        if authed_url and authed_url != current_url:
            origin.set_url(authed_url)
            try:
                origin.fetch(prune=True)
            finally:
                origin.set_url(current_url)
        else:
            origin.fetch(prune=True)
        # Remote tracking refs: "origin/main" → "main"
        return [
            ref.name.split("/", 1)[1]
            for ref in origin.refs
            if "/" in ref.name and not ref.name.endswith("/HEAD")
        ]
    except Exception:
        return get_branches(local_path)


def get_deleted_commits(local_path: str, branch: str) -> list[dict]:
    """
    Returns commits reachable from the local branch but absent from origin/branch.
    Call after fetch_remote_branches so tracking refs are up to date.
    These are commits that were removed from remote via force-push or rebase.
    """
    try:
        repo = Repo(local_path)
        remote_ref = f"origin/{branch}"
        try:
            repo.commit(remote_ref)
        except Exception:
            return []
        try:
            repo.commit(branch)
        except Exception:
            return []
        remote_shas = {c.hexsha for c in repo.iter_commits(remote_ref)}
        deleted = []
        for commit in repo.iter_commits(branch):
            if commit.hexsha not in remote_shas:
                deleted.append({
                    "sha": commit.hexsha,
                    "short_sha": commit.hexsha[:7],
                    "message": commit.message.strip().split("\n")[0],
                    "author_name": commit.author.name,
                })
        return deleted
    except Exception:
        return []


def get_contributors(local_path: str, branch: Optional[str] = None) -> list[dict]:
    """Return unique contributors sorted by commit count descending."""
    try:
        repo                           = Repo(local_path)
        rev                            = branch or "HEAD"
        contributors: dict[str, dict]  = {}
        for commit in repo.iter_commits(rev):
            email = commit.author.email
            if email not in contributors:
                contributors[email] = {
                    "name": commit.author.name,
                    "email": email,
                    "commits": 0,
                }
            contributors[email]["commits"] += 1
        return sorted(contributors.values(), key=lambda x: x["commits"], reverse=True)
    except Exception:
        return []


def get_language_stats(local_path: str, commit_sha: Optional[str] = None) -> dict[str, int]:
    tree                   = get_tree(local_path, commit_sha)
    stats: dict[str, int]  = {}
    for item in tree:
        if item["type"] == "file" and item["language"] and item["language"] != "Text":
            lang         = item["language"]
            stats[lang]  = stats.get(lang, 0) + 1
    return dict(sorted(stats.items(), key=lambda x: x[1], reverse=True))


def _parse_patch_stats(patch: str) -> dict:
    additions  = sum(1 for line in patch.splitlines() if line.startswith("+") and not line.startswith("+++"))
    deletions  = sum(1 for line in patch.splitlines() if line.startswith("-") and not line.startswith("---"))
    return {"additions": additions, "deletions": deletions}