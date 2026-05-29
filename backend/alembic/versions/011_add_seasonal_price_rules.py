"""
Revision ID: 011_add_seasonal_price_rules
Revises: 010_add_pricing_system
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa
import enum

# revision identifiers, used by Alembic.
revision = '011_add_seasonal_price_rules'
down_revision = '010_add_pricing_system'
branch_labels = None
depends_on = None

class SeasonalPriceRuleType(str, enum.Enum):
    discount_percent = "discount_percent"
    discount_fixed = "discount_fixed"
    surcharge_percent = "surcharge_percent"
    surcharge_fixed = "surcharge_fixed"

class PriceEntityType(str, enum.Enum):
    car = "car"
    group = "group"
    category = "category"
    global_ = "global"

def upgrade():
    op.execute("DROP TYPE IF EXISTS priceentitytype CASCADE")
    op.execute("DROP TYPE IF EXISTS seasonalpriceruletype CASCADE")
    op.execute("DROP TYPE IF EXISTS priceentitytype CASCADE")
    op.execute("DROP TYPE IF EXISTS seasonalpriceruletype CASCADE")
    op.create_table(
        'seasonal_price_rules',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('season_id', sa.Integer, sa.ForeignKey('seasons.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('entity_type', sa.Enum(PriceEntityType), nullable=False, index=True),
        sa.Column('entity_value', sa.String(100), nullable=True, index=True),
        sa.Column('rule_type', sa.Enum(SeasonalPriceRuleType), nullable=False),
        sa.Column('value', sa.Float, nullable=False),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

def downgrade():
    op.drop_table('seasonal_price_rules')
