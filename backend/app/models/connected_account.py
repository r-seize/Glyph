from __future__ import annotations

import enum
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, Enum, UniqueConstraint, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User


class Provider(str, enum.Enum):
    github  = "github"
    gitlab  = "gitlab"


class ConnectedAccount(Base):
    __tablename__ = "connected_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", "provider_account_id", name="uq_user_provider_account"),
    )

    id: Mapped[str]                   = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str]              = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[Provider]        = mapped_column(Enum(Provider), nullable=False)
    provider_account_id: Mapped[str]  = mapped_column(String(100), nullable=False)
    username: Mapped[str]             = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None]    = mapped_column(String(500), nullable=True)
    token_encrypted: Mapped[str]      = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime]      = mapped_column(DateTime, server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="connected_accounts")
