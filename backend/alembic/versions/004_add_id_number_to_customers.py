"""add id_number to customers

Revision ID: 004
Revises: 003
Create Date: 2026-04-29

"""
from alembic import op
import sqlalchemy as sa


revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("id_number", sa.String(length=50), nullable=True))
    op.create_index("ix_customers_id_number", "customers", ["id_number"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_customers_id_number", table_name="customers")
    op.drop_column("customers", "id_number")

