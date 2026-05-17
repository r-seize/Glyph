"""add code_references table

Revision ID: 0002_code_references
Revises: 0001_initial
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_code_references"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "code_references",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("commit_sha", sa.String(40), nullable=False),
        sa.Column("line_start", sa.Integer(), nullable=False),
        sa.Column("line_end", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(120), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("author_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_code_references_project_id", "code_references", ["project_id"])
    op.create_index("ix_code_references_file_path", "code_references", ["file_path"])
    op.create_index("ix_code_references_commit_sha", "code_references", ["commit_sha"])


def downgrade() -> None:
    op.drop_table("code_references")
