"""add workspace_invites table

Revision ID: 0005_workspace_invites
Revises: 0004_connected_accounts
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_workspace_invites"
down_revision = "0004_connected_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_invites",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("workspace_id", sa.String(36), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("token", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column("role", sa.Enum("owner", "admin", "developer", "viewer", name="role"), nullable=False, server_default="developer"),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("used_at", sa.DateTime, nullable=True),
        sa.Column("used_by", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("workspace_invites")
