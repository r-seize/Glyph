from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.workspace import Role
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.workspace import Workspace
    from app.models.user import User


class WorkspaceInvite(Base):
    __tablename__ = "workspace_invites"

    id: Mapped[str]                   = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id: Mapped[str]         = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str]                = mapped_column(String(64), unique=True, nullable=False, index=True)
    role: Mapped[Role]                = mapped_column(Enum(Role), default=Role.developer, nullable=False)
    created_by: Mapped[str]           = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    email: Mapped[str | None]         = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime]      = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None]  = mapped_column(DateTime, nullable=True)
    used_by: Mapped[str | None]       = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime]      = mapped_column(DateTime, server_default=func.now())

    workspace: Mapped["Workspace"]  = relationship("Workspace")
    creator: Mapped["User"]         = relationship("User", foreign_keys=[created_by])
