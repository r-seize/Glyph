"""add github_token_encrypted to users

Revision ID: 0003_github_token
Revises: 0002_code_references
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_github_token"
down_revision = "0002_code_references"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("github_token_encrypted", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "github_token_encrypted")
