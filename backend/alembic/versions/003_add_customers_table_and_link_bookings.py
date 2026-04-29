"""add customers table and link bookings.customer_id

Revision ID: 003
Revises: 002
Create Date: 2026-04-29

"""
from alembic import op
import sqlalchemy as sa


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("normalized_name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_customers_id", "customers", ["id"], unique=False)
    op.create_index("ix_customers_name", "customers", ["name"], unique=False)
    op.create_index("ix_customers_normalized_name", "customers", ["normalized_name"], unique=False)
    op.create_index("ix_customers_phone", "customers", ["phone"], unique=False)
    op.create_index("ix_customers_email", "customers", ["email"], unique=False)

    op.add_column("bookings", sa.Column("customer_id", sa.Integer(), nullable=True))
    op.create_index("ix_bookings_customer_id", "bookings", ["customer_id"], unique=False)
    op.create_foreign_key(
        "fk_bookings_customer_id_customers",
        "bookings",
        "customers",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_bookings_customer_id_customers", "bookings", type_="foreignkey")
    op.drop_index("ix_bookings_customer_id", table_name="bookings")
    op.drop_column("bookings", "customer_id")

    op.drop_index("ix_customers_email", table_name="customers")
    op.drop_index("ix_customers_phone", table_name="customers")
    op.drop_index("ix_customers_normalized_name", table_name="customers")
    op.drop_index("ix_customers_name", table_name="customers")
    op.drop_index("ix_customers_id", table_name="customers")
    op.drop_table("customers")

