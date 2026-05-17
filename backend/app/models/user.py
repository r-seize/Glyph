from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.workspace import WorkspaceMember
    from app.models.comment import Comment
    from app.models.document import Document
    from app.models.connected_account import ConnectedAccount

class User(Base):
    __tablename__ = "users"

    id: Mapped[str]                             = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str]                          = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str]                       = mapped_column(String(50), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str | None]         = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None]              = mapped_column(String(500), nullable=True)
    github_id: Mapped[str | None]               = mapped_column(String(50), unique=True, nullable=True)
    github_token_encrypted: Mapped[str | None]  = mapped_column(Text, nullable=True)
    is_active: Mapped[bool]                     = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime]                = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime]                = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    workspace_memberships: Mapped[list["WorkspaceMember"]]  = relationship(back_populates="user", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]]                     = relationship(back_populates="author")
    comments: Mapped[list["Comment"]]                       = relationship(back_populates="author", cascade="all, delete-orphan")
    connected_accounts: Mapped[list["ConnectedAccount"]]    = relationship(back_populates="user", cascade="all, delete-orphan")