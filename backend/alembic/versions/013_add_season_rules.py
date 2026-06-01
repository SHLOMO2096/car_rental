"""
Add season_rules table — links a season to specific price_rules with
per-price-type applicability flags.

Revision ID: 013_add_season_rules
Revises: 012_restructure_pricing_fields
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa

revision = "013_add_season_rules"
down_revision = "012_restructure_pricing_fields"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "season_rules",
        sa.Column("id",                   sa.Integer(),  primary_key=True),
        sa.Column("season_id",            sa.Integer(),
                  sa.ForeignKey("seasons.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        # null = חל על כל כללי המחיר
        sa.Column("price_rule_id",        sa.Integer(),
                  sa.ForeignKey("price_rules.id", ondelete="CASCADE"),
                  nullable=True, index=True),
        sa.Column("applies_to_half_day",  sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("applies_to_day",       sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("applies_to_week",      sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("applies_to_month",     sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at",           sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_season_rules_id", "season_rules", ["id"])


def downgrade():
    op.drop_index("ix_season_rules_id", table_name="season_rules")
    op.drop_table("season_rules")
