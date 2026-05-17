from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.project import Visibility


class ProjectStats(BaseModel):
    total_files: int                    = 0
    documented_files: int               = 0
    total_commits: int                  = 0
    documented_commits: int             = 0
    active_contributors: int            = 0
    documentation_coverage: float       = 0.0


class ProjectCreate(BaseModel):
    name: str
    repo_url: Optional[str]             = None
    description: Optional[str]          = None
    default_branch: str                 = "main"


class ProjectUpdate(BaseModel):
    name: Optional[str]                 = None
    description: Optional[str]          = None
    default_branch: Optional[str]       = None
    visibility: Optional[Visibility]    = None


class ProjectOut(BaseModel):
    id: str
    workspace_id: str
    name: str
    slug: str
    description: Optional[str]          = None
    repo_url: Optional[str]             = None
    default_branch: str
    visibility: Visibility
    last_synced_at: Optional[datetime]  = None
    created_at: datetime
    stats: ProjectStats                 = ProjectStats()

    model_config                        = {"from_attributes": True}