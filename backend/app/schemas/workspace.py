from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional
from app.models.workspace import Role
from app.schemas.user import UserOut


class WorkspaceCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Workspace name must be at least 2 characters")
        if len(v) > 100:
            raise ValueError("Workspace name must be at most 100 characters")
        return v


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None


class WorkspaceMemberOut(BaseModel):
    id: str
    user: UserOut
    role: Role
    joined_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceOut(BaseModel):
    id: str
    name: str
    slug: str
    owner_id: str
    member_count: int   = 0
    project_count: int  = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceDetail(WorkspaceOut):
    members: list[WorkspaceMemberOut] = []


class InviteUser(BaseModel):
    email: EmailStr
    role: Role = Role.developer


class UpdateMemberRole(BaseModel):
    role: Role