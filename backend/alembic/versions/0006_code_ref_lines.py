"""add lines column to code_references

Revision ID: 0006_code_ref_lines
Revises: 0005_workspace_invites
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_code_ref_lines"
down_revision = "0005_workspace_invites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("code_references", sa.Column("lines", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("code_references", "lines")
