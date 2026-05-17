import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum

from app.models.commit import Commit
from app.models.workspace import Workspace
from app.models.document import Document
from app.models.code_reference import CodeReference


class Visibility(str, enum.Enum):
    private     = "private"
    public      = "public"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str]                             = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str]                   = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str]                           = mapped_column(String(100), nullable=False)
    slug: Mapped[str]                           = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None]             = mapped_column(Text, nullable=True)
    repo_url: Mapped[str | None]                = mapped_column(String(500), nullable=True)
    default_branch: Mapped[str]                 = mapped_column(String(100), default="main", nullable=False)
    local_path: Mapped[str | None]              = mapped_column(String(500), nullable=True)
    visibility: Mapped[Visibility]              = mapped_column(Enum(Visibility), default=Visibility.private, nullable=False)
    webhook_secret: Mapped[str | None]          = mapped_column(String(100), nullable=True)
    last_synced_at: Mapped[datetime | None]     = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime]                = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime]                = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    workspace: Mapped["Workspace"]                  = relationship(back_populates="projects")
    commits: Mapped[list["Commit"]]                 = relationship(back_populates="project", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]]             = relationship(back_populates="project", cascade="all, delete-orphan")
    code_references: Mapped[list["CodeReference"]]  = relationship(back_populates="project", cascade="all, delete-orphan")