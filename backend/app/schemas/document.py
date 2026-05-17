from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.schemas.user import UserOut


class DocumentCreate(BaseModel):
    file_path: str
    commit_sha: str
    content: str


class DocumentUpdate(BaseModel):
    content: str


class DocumentOut(BaseModel):
    id: str
    project_id: str
    file_path: str
    commit_sha: str
    content: str
    author: Optional[UserOut] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentVersion(BaseModel):
    commit_sha: str
    author: Optional[UserOut] = None
    updated_at: datetime
    preview: str  # first 200 chars of content

    model_config = {"from_attributes": True}