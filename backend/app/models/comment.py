from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.user import User

class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str]                     = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str]            = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[str]              = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str]                = mapped_column(Text, nullable=False)
    line_number: Mapped[int | None]     = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime]        = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime]        = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    document: Mapped["Document"]    = relationship(back_populates="comments")
    author: Mapped["User"]          = relationship(back_populates="comments")