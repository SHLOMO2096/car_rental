"""
Rename entity_type='group' → 'model' in price_rules table.
Required because PriceEntityType enum removed 'group' and added 'model'.

Revision ID: 015_rename_group_to_model
Revises: 014_drop_seasonal_price_rules
Create Date: 2026-05-31
"""

from alembic import op

revision = "015_rename_group_to_model"
down_revision = "014_drop_seasonal_price_rules"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        UPDATE price_rules
        SET entity_type = 'model'
        WHERE entity_type = 'group'
    """)


def downgrade():
    op.execute("""
        UPDATE price_rules
        SET entity_type = 'group'
        WHERE entity_type = 'model'
    """)
