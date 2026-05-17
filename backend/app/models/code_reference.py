from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class CodeReference(Base):
    __tablename__ = "code_references"

    id: Mapped[str]                 = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str]         = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path: Mapped[str]          = mapped_column(String(500), nullable=False, index=True)
    commit_sha: Mapped[str]         = mapped_column(String(40), nullable=False, index=True)
    line_start: Mapped[int]         = mapped_column(Integer, nullable=False)
    line_end: Mapped[int]           = mapped_column(Integer, nullable=False)
    lines: Mapped[str | None]       = mapped_column(Text, nullable=True)
    label: Mapped[str | None]       = mapped_column(String(120), nullable=True)
    note: Mapped[str | None]        = mapped_column(Text, nullable=True)
    color: Mapped[str | None]       = mapped_column(String(20), nullable=True)
    author_id: Mapped[str | None]   = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime]    = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime]    = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    project: Mapped["Project"]      = relationship(back_populates="code_references")
    author: Mapped["User | None"]   = relationship()
