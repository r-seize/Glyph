from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CommitOut(BaseModel):
    id: str
    sha: str
    message: str
    author_name: str
    author_email: str
    committed_at: datetime
    is_documented: bool

    model_config = {"from_attributes": True}


class CommitDetail(CommitOut):
    files_changed: list[str]  = []
    stats: dict               = {}  # additions, deletions, total


class DiffLine(BaseModel):
    type: str  # "added", "removed", "context"
    content: str
    old_line: Optional[int]  = None
    new_line: Optional[int]  = None


class FileDiff(BaseModel):
    file_path: str
    old_path: Optional[str] = None
    change_type: str  # "added", "removed", "modified", "renamed"
    additions: int
    deletions: int
    hunks: list[dict] = []