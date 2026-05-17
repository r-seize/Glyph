from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Boolean, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.project import Project

class Commit(Base):
    __tablename__ = "commits"

    id: Mapped[str]                 = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str]         = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    sha: Mapped[str]                = mapped_column(String(40), nullable=False, index=True)
    message: Mapped[str]            = mapped_column(Text, nullable=False)
    author_name: Mapped[str]        = mapped_column(String(150), nullable=False)
    author_email: Mapped[str]       = mapped_column(String(255), nullable=False)
    committed_at: Mapped[datetime]  = mapped_column(DateTime, nullable=False)
    is_documented: Mapped[bool]     = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime]    = mapped_column(DateTime, server_default=func.now())

    # Relationships
    project: Mapped["Project"] = relationship(back_populates="commits")