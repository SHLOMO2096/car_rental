"""
Restructure pricing fields:
  - seasons: add valid_from, valid_until, is_recurring, season_type,
             adjustment_type, adjustment_direction, adjustment_value
  - price_rules: add price_half_day, price_day, price_week, price_month,
                 exclude_sabbath_holidays

Revision ID: 012_restructure_pricing_fields
Revises: 011_add_seasonal_price_rules
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa

revision = "012_restructure_pricing_fields"
down_revision = "011_add_seasonal_price_rules"
branch_labels = None
depends_on = None


def upgrade():
    # ── seasons: שדות חדשים ───────────────────────────────────────────────────
    op.add_column("seasons", sa.Column("valid_from",           sa.Date(),    nullable=True))
    op.add_column("seasons", sa.Column("valid_until",          sa.Date(),    nullable=True))
    op.add_column("seasons", sa.Column("is_recurring",         sa.Boolean(), nullable=False,
                                       server_default=sa.false()))
    op.add_column("seasons", sa.Column("season_type",          sa.String(10), nullable=True))
    op.add_column("seasons", sa.Column("adjustment_type",      sa.String(10), nullable=True))
    op.add_column("seasons", sa.Column("adjustment_direction", sa.String(10), nullable=True))
    op.add_column("seasons", sa.Column("adjustment_value",     sa.Float(),   nullable=True))

    # ── price_rules: שדות חדשים ──────────────────────────────────────────────
    op.add_column("price_rules", sa.Column("price_half_day",          sa.Float(), nullable=True))
    op.add_column("price_rules", sa.Column("price_day",               sa.Float(), nullable=True))
    op.add_column("price_rules", sa.Column("price_week",              sa.Float(), nullable=True))
    op.add_column("price_rules", sa.Column("price_month",             sa.Float(), nullable=True))
    op.add_column("price_rules", sa.Column("exclude_sabbath_holidays", sa.Boolean(),
                                           nullable=False, server_default=sa.true()))

    # ── העתק נתונים קיימים לשדות החדשים ─────────────────────────────────────
    # כלל קיים עם price_type=daily  → price_day
    op.execute(
        "UPDATE price_rules SET price_day  = price WHERE price_type = 'daily'"
    )
    # כלל קיים עם price_type=half_day → price_half_day
    op.execute(
        "UPDATE price_rules SET price_half_day = price WHERE price_type = 'half_day'"
    )
    # כלל קיים עם price_type=weekly → price_week
    op.execute(
        "UPDATE price_rules SET price_week = price WHERE price_type = 'weekly'"
    )
    # כלל קיים עם price_type=monthly → price_month
    op.execute(
        "UPDATE price_rules SET price_month = price WHERE price_type = 'monthly'"
    )

    # ── seasons: העתק month/day לתאריכי DATE (שנה 2000 כ-placeholder לrecurring) ──
    # השנה 2000 היא placeholder — is_recurring=true יתעלם מהשנה בחישוב
    op.execute("""
        UPDATE seasons
        SET valid_from   = MAKE_DATE(2000, start_month, start_day),
            valid_until  = MAKE_DATE(
                               CASE WHEN (end_month, end_day) < (start_month, start_day)
                                    THEN 2001
                                    ELSE 2000
                               END,
                               end_month, end_day
                           ),
            is_recurring = true,
            season_type  = 'peak'
        WHERE start_month IS NOT NULL
    """)


def downgrade():
    # ── price_rules ──────────────────────────────────────────────────────────
    op.drop_column("price_rules", "exclude_sabbath_holidays")
    op.drop_column("price_rules", "price_month")
    op.drop_column("price_rules", "price_week")
    op.drop_column("price_rules", "price_day")
    op.drop_column("price_rules", "price_half_day")

    # ── seasons ───────────────────────────────────────────────────────────────
    op.drop_column("seasons", "adjustment_value")
    op.drop_column("seasons", "adjustment_direction")
    op.drop_column("seasons", "adjustment_type")
    op.drop_column("seasons", "season_type")
    op.drop_column("seasons", "is_recurring")
    op.drop_column("seasons", "valid_until")
    op.drop_column("seasons", "valid_from")
