"""add updated_by to bookings

Revision ID: 009
Revises: 008
Create Date: 2026-05-18
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("bookings", sa.Column("updated_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_bookings_updated_by_users",
        "bookings",
        "users",
        ["updated_by"],
        ["id"],
        ondelete="SET NULL",
    )



def downgrade():
    op.drop_constraint("fk_bookings_updated_by_users", "bookings", type_="foreignkey")
    op.drop_column("bookings", "updated_by")

