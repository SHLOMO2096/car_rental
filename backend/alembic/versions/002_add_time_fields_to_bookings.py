"""add pickup_time and return_time to bookings

Revision ID: 002
Revises: 001
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('pickup_time', sa.String(5), nullable=True))
    op.add_column('bookings', sa.Column('return_time', sa.String(5), nullable=True))


def downgrade() -> None:
    op.drop_column('bookings', 'return_time')
    op.drop_column('bookings', 'pickup_time')

