from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User
    from app.models.comment import Comment

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str]                 = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str]         = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path: Mapped[str]          = mapped_column(String(500), nullable=False, index=True)
    commit_sha: Mapped[str]         = mapped_column(String(40), nullable=False, index=True)
    content: Mapped[str]            = mapped_column(Text, nullable=False, default="")
    author_id: Mapped[str]          = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime]    = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime]    = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    project: Mapped["Project"]          = relationship(back_populates="documents")
    author: Mapped["User"]              = relationship(back_populates="documents")
    comments: Mapped[list["Comment"]]   = relationship(back_populates="document", cascade="all, delete-orphan")