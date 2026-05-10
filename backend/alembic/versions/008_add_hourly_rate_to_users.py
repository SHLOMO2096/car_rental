"""add hourly rate to users

Revision ID: 008
Revises: 007
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("hourly_rate", sa.Float(), nullable=True))
    op.create_index("ix_users_hourly_rate", "users", ["hourly_rate"])


def downgrade():
    op.drop_index("ix_users_hourly_rate", table_name="users")
    op.drop_column("users", "hourly_rate")

