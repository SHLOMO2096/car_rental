"""add make and group to cars

Revision ID: 001
Revises: 
Create Date: 2026-04-27

"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cars', sa.Column('make',  sa.String(100), nullable=True))
    op.add_column('cars', sa.Column('group', sa.String(10),  nullable=True))


def downgrade() -> None:
    op.drop_column('cars', 'group')
    op.drop_column('cars', 'make')

