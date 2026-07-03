"""
Add price_hour column to price_rules table (extra-hour pricing, 5th tier
alongside price_half_day / price_day / price_week / price_month).

Revision ID: 016_add_price_hour
Revises: 015_rename_group_to_model
Create Date: 2026-07-03
"""

from alembic import op
import sqlalchemy as sa

revision = "016_add_price_hour"
down_revision = "015_rename_group_to_model"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("price_rules", sa.Column("price_hour", sa.Float(), nullable=True))
    op.add_column(
        "season_rules",
        sa.Column("applies_to_hour", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade():
    op.drop_column("season_rules", "applies_to_hour")
    op.drop_column("price_rules", "price_hour")
