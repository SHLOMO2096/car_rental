"""
Migrate data from seasonal_price_rules → season_rules, then:
  - DROP TABLE seasonal_price_rules
  - DROP columns: price_rules.price_type, price_rules.price
  - DROP columns: seasons.start_month, start_day, end_month, end_day

Revision ID: 014_migrate_and_drop_seasonal_price_rules
Revises: 013_add_season_rules
Create Date: 2026-05-31
"""

from alembic import op
import sqlalchemy as sa

revision = "014_migrate_and_drop_seasonal_price_rules"
down_revision = "013_add_season_rules"
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. המר seasonal_price_rules → season_rules ───────────────────────────
    # כל כלל עונתי קיים הופך ל-season_rule ללא price_rule_id ספציפי
    # (חל על כל כללי המחיר באותה עונה).
    # ה-adjustment_type/direction/value כבר הועתקו ל-seasons ב-012,
    # אז כאן רק יוצרים את הקישור season→all rules.
    op.execute("""
        INSERT INTO season_rules (season_id, price_rule_id,
                                  applies_to_half_day, applies_to_day,
                                  applies_to_week, applies_to_month)
        SELECT DISTINCT spr.season_id,
               NULL,      -- חל על כל כללי המחיר
               true, true, true, true
        FROM   seasonal_price_rules spr
        WHERE  spr.is_active = true
          AND  NOT EXISTS (
              SELECT 1 FROM season_rules sr
              WHERE  sr.season_id     = spr.season_id
                AND  sr.price_rule_id IS NULL
          )
    """)

    # ── 2. DROP seasonal_price_rules ─────────────────────────────────────────
    op.drop_table("seasonal_price_rules")

    # ── 3. DROP שדות ישנים מ-price_rules ────────────────────────────────────
    # הסר UniqueConstraint שמפנה ל-price_type לפני drop
    try:
        op.drop_constraint("uq_price_rule_entity_type_season", "price_rules", type_="unique")
    except Exception:
        pass  # ייתכן שנמחק כבר

    op.drop_column("price_rules", "price_type")
    op.drop_column("price_rules", "price")

    # ── 4. DROP שדות ישנים מ-seasons ─────────────────────────────────────────
    op.drop_column("seasons", "start_month")
    op.drop_column("seasons", "start_day")
    op.drop_column("seasons", "end_month")
    op.drop_column("seasons", "end_day")


def downgrade():
    # ── 4. שחזר שדות seasons ─────────────────────────────────────────────────
    op.add_column("seasons", sa.Column("start_month", sa.Integer(), nullable=True))
    op.add_column("seasons", sa.Column("start_day",   sa.Integer(), nullable=True))
    op.add_column("seasons", sa.Column("end_month",   sa.Integer(), nullable=True))
    op.add_column("seasons", sa.Column("end_day",     sa.Integer(), nullable=True))

    # שחזר מ-valid_from / valid_until (best-effort)
    op.execute("""
        UPDATE seasons
        SET start_month = EXTRACT(MONTH FROM valid_from)::INT,
            start_day   = EXTRACT(DAY   FROM valid_from)::INT,
            end_month   = EXTRACT(MONTH FROM valid_until)::INT,
            end_day     = EXTRACT(DAY   FROM valid_until)::INT
        WHERE valid_from IS NOT NULL
    """)

    # ── 3. שחזר שדות price_rules ──────────────────────────────────────────────
    op.add_column("price_rules", sa.Column("price_type", sa.String(20), nullable=True))
    op.add_column("price_rules", sa.Column("price",      sa.Float(),    nullable=True))

    # שחזר מהשדות החדשים (best-effort — לוקח את הערך הראשון שאינו null)
    op.execute("""
        UPDATE price_rules
        SET price_type = CASE
                WHEN price_day      IS NOT NULL THEN 'daily'
                WHEN price_half_day IS NOT NULL THEN 'half_day'
                WHEN price_week     IS NOT NULL THEN 'weekly'
                WHEN price_month    IS NOT NULL THEN 'monthly'
                ELSE 'daily'
            END,
            price = COALESCE(price_day, price_half_day, price_week, price_month, 0)
    """)

    # ── 2. שחזר seasonal_price_rules ─────────────────────────────────────────
    op.create_table(
        "seasonal_price_rules",
        sa.Column("id",           sa.Integer(), primary_key=True),
        sa.Column("season_id",    sa.Integer(),
                  sa.ForeignKey("seasons.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("entity_type",  sa.String(20), nullable=False, index=True),
        sa.Column("entity_value", sa.String(100), nullable=True, index=True),
        sa.Column("rule_type",    sa.String(30),  nullable=False),
        sa.Column("value",        sa.Float(),     nullable=False),
        sa.Column("is_active",    sa.Boolean(),   nullable=False, server_default=sa.true()),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",   sa.DateTime(timezone=True), nullable=True),
    )

    # ── 1. נקה season_rules שנוצרו ב-upgrade ──────────────────────────────────
    op.execute("DELETE FROM season_rules WHERE price_rule_id IS NULL")
