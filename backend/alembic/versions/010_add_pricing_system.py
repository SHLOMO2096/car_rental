"""add pricing system — seasons, price_rules, israeli_holidays + booking pricing fields

Revision ID: 010
Revises: 009
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. seasons ────────────────────────────────────────────────────────────
    op.create_table(
        "seasons",
        sa.Column("id",          sa.Integer(),     primary_key=True),
        sa.Column("name",        sa.String(100),   nullable=False),
        sa.Column("start_month", sa.Integer(),     nullable=False),
        sa.Column("start_day",   sa.Integer(),     nullable=False),
        sa.Column("end_month",   sa.Integer(),     nullable=False),
        sa.Column("end_day",     sa.Integer(),     nullable=False),
        sa.Column("is_active",   sa.Boolean(),     nullable=False, server_default=sa.true()),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_seasons_id", "seasons", ["id"])

    # ── 2. price_rules ────────────────────────────────────────────────────────
    op.create_table(
        "price_rules",
        sa.Column("id",           sa.Integer(),     primary_key=True),
        sa.Column("name",         sa.String(100),   nullable=True),
        sa.Column("entity_type",  sa.String(20),    nullable=False),   # car/group/category/global
        sa.Column("entity_value", sa.String(100),   nullable=True),
        sa.Column("price_type",   sa.String(20),    nullable=False),   # daily/half_day/weekly/monthly
        sa.Column("price",        sa.Float(),        nullable=False),
        sa.Column("season_id",    sa.Integer(),     sa.ForeignKey("seasons.id", ondelete="SET NULL"), nullable=True),
        sa.Column("priority",     sa.Integer(),     nullable=False, server_default="0"),
        sa.Column("is_active",    sa.Boolean(),     nullable=False, server_default=sa.true()),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",   sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_price_rules_id",           "price_rules", ["id"])
    op.create_index("ix_price_rules_entity_type",  "price_rules", ["entity_type"])
    op.create_index("ix_price_rules_entity_value", "price_rules", ["entity_value"])
    op.create_index("ix_price_rules_season_id",    "price_rules", ["season_id"])
    op.create_index(
        "ix_price_rules_entity",
        "price_rules",
        ["entity_type", "entity_value", "price_type"],
    )
    op.create_unique_constraint(
        "uq_price_rule_entity_type_season",
        "price_rules",
        ["entity_type", "entity_value", "price_type", "season_id"],
    )

    # ── 3. israeli_holidays ───────────────────────────────────────────────────
    op.create_table(
        "israeli_holidays",
        sa.Column("id",                sa.Integer(),   primary_key=True),
        sa.Column("name",              sa.String(100), nullable=False),
        sa.Column("date",              sa.Date(),      nullable=False, unique=True),
        sa.Column("hebrew_year",       sa.Integer(),   nullable=True),
        sa.Column("is_auto_generated", sa.Boolean(),   nullable=False, server_default=sa.false()),
        sa.Column("created_by",        sa.Integer(),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",        sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_israeli_holidays_id",   "israeli_holidays", ["id"])
    op.create_index("ix_israeli_holidays_date", "israeli_holidays", ["date"])

    # ── 4. bookings — שדות מחיר חדשים ────────────────────────────────────────
    op.add_column("bookings", sa.Column("billable_days",         sa.Float(),   nullable=True))
    op.add_column("bookings", sa.Column("actual_days",           sa.Integer(), nullable=True))
    op.add_column("bookings", sa.Column("price_type_used",       sa.String(20), nullable=True))
    op.add_column("bookings", sa.Column("price_rule_id",         sa.Integer(),
                                        sa.ForeignKey("price_rules.id", ondelete="SET NULL"),
                                        nullable=True))
    op.add_column("bookings", sa.Column("price_breakdown_json",  sa.Text(),    nullable=True))
    op.add_column("bookings", sa.Column("price_override",        sa.Float(),   nullable=True))
    op.add_column("bookings", sa.Column("price_override_reason", sa.String(500), nullable=True))
    op.add_column("bookings", sa.Column("price_override_by",     sa.Integer(),
                                        sa.ForeignKey("users.id", ondelete="SET NULL"),
                                        nullable=True))
    op.add_column("bookings", sa.Column("price_override_at",     sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_bookings_price_rule_id", "bookings", ["price_rule_id"])
    op.create_foreign_key(
        "fk_bookings_price_rule_id",
        "bookings", "price_rules",
        ["price_rule_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_bookings_price_override_by",
        "bookings", "users",
        ["price_override_by"], ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    # ── bookings ──────────────────────────────────────────────────────────────
    op.drop_constraint("fk_bookings_price_override_by", "bookings", type_="foreignkey")
    op.drop_constraint("fk_bookings_price_rule_id",     "bookings", type_="foreignkey")
    op.drop_index("ix_bookings_price_rule_id", table_name="bookings")
    for col in [
        "price_override_at", "price_override_by", "price_override_reason",
        "price_override", "price_breakdown_json", "price_rule_id",
        "price_type_used", "actual_days", "billable_days",
    ]:
        op.drop_column("bookings", col)

    # ── israeli_holidays ──────────────────────────────────────────────────────
    op.drop_index("ix_israeli_holidays_date", table_name="israeli_holidays")
    op.drop_index("ix_israeli_holidays_id",   table_name="israeli_holidays")
    op.drop_table("israeli_holidays")

    # ── price_rules ───────────────────────────────────────────────────────────
    op.drop_constraint("uq_price_rule_entity_type_season", "price_rules", type_="unique")
    op.drop_index("ix_price_rules_entity",        table_name="price_rules")
    op.drop_index("ix_price_rules_season_id",     table_name="price_rules")
    op.drop_index("ix_price_rules_entity_value",  table_name="price_rules")
    op.drop_index("ix_price_rules_entity_type",   table_name="price_rules")
    op.drop_index("ix_price_rules_id",            table_name="price_rules")
    op.drop_table("price_rules")

    # ── seasons ───────────────────────────────────────────────────────────────
    op.drop_index("ix_seasons_id", table_name="seasons")
    op.drop_table("seasons")

