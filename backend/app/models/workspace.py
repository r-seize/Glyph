from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.workspace import WorkspaceMember
    from app.models.project import Project
    from app.models.user import User

class Role(str, enum.Enum):
    owner       = "owner"
    admin       = "admin"
    developer   = "developer"
    viewer      = "viewer"


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str]                 = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str]               = mapped_column(String(100), nullable=False)
    slug: Mapped[str]               = mapped_column(String(100), unique=True, nullable=False, index=True)
    owner_id: Mapped[str]           = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime]    = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime]    = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    members: Mapped[list["WorkspaceMember"]]    = relationship(back_populates="workspace", cascade="all, delete-orphan")
    projects: Mapped[list["Project"]]           = relationship(back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id: Mapped[str]                 = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str]       = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str]            = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[Role]              = mapped_column(Enum(Role), default=Role.developer, nullable=False)
    joined_at: Mapped[datetime]     = mapped_column(DateTime, server_default=func.now())

    # Relationships
    workspace: Mapped["Workspace"]  = relationship(back_populates="members")
    user: Mapped["User"]            = relationship(back_populates="workspace_memberships")