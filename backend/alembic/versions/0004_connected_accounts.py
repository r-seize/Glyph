"""add connected_accounts table

Revision ID: 0004_connected_accounts
Revises: 0003_github_token
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_connected_accounts"
down_revision = "0003_github_token"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "connected_accounts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.Enum("github", "gitlab", name="provider"), nullable=False),
        sa.Column("provider_account_id", sa.String(100), nullable=False),
        sa.Column("username", sa.String(255), nullable=False),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("token_encrypted", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "provider", "provider_account_id", name="uq_user_provider_account"),
    )
    op.create_index("ix_connected_accounts_user_id", "connected_accounts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_connected_accounts_user_id", "connected_accounts")
    op.drop_table("connected_accounts")
