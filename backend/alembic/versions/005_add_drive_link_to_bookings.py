"""add drive_link to bookings

Revision ID: 005
Revises: 004
Create Date: 2026-05-01 10:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("drive_link", sa.String(length=2048), nullable=True))


def downgrade() -> None:
    op.drop_column("bookings", "drive_link")
