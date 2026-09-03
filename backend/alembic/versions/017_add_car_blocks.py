"""
Add car_blocks — temporary vehicle blocks (garage, accident) that make a car
unavailable for a date range without deactivating it altogether.

Revision ID: 017_add_car_blocks
Revises: 016_add_price_hour
Create Date: 2026-09-04
"""

from alembic import op
import sqlalchemy as sa

revision = "017_add_car_blocks"
down_revision = "016_add_price_hour"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "car_blocks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("car_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=20), nullable=False, server_default="garage"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["car_id"], ["cars.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_car_blocks_id", "car_blocks", ["id"])
    op.create_index("ix_car_blocks_car_id", "car_blocks", ["car_id"])
    op.create_index("ix_car_blocks_start_date", "car_blocks", ["start_date"])
    op.create_index("ix_car_blocks_end_date", "car_blocks", ["end_date"])
    op.create_index("ix_car_blocks_car_range", "car_blocks", ["car_id", "start_date", "end_date"])


def downgrade():
    op.drop_index("ix_car_blocks_car_range", table_name="car_blocks")
    op.drop_index("ix_car_blocks_end_date", table_name="car_blocks")
    op.drop_index("ix_car_blocks_start_date", table_name="car_blocks")
    op.drop_index("ix_car_blocks_car_id", table_name="car_blocks")
    op.drop_index("ix_car_blocks_id", table_name="car_blocks")
    op.drop_table("car_blocks")
