"""add soft delete to bookings

Revision ID: 006
Revises: 005
Create Date: 2026-05-04
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "bookings",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "bookings",
        sa.Column(
            "deleted_by",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_bookings_deleted_at", "bookings", ["deleted_at"])


def downgrade():
    op.drop_index("ix_bookings_deleted_at", table_name="bookings")
    op.drop_column("bookings", "deleted_by")
    op.drop_column("bookings", "deleted_at")

