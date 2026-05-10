"""add attendance shifts and device sessions

Revision ID: 007
Revises: 006
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "attendance_shifts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shift_start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("shift_end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("work_date", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_attendance_shifts_user_id", "attendance_shifts", ["user_id"])
    op.create_index("ix_attendance_shifts_work_date", "attendance_shifts", ["work_date"])
    op.create_index("ix_attendance_shifts_shift_start_at", "attendance_shifts", ["shift_start_at"])
    op.create_index("ix_attendance_shifts_shift_end_at", "attendance_shifts", ["shift_end_at"])

    op.create_table(
        "attendance_device_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("shift_id", sa.Integer, sa.ForeignKey("attendance_shifts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", sa.String(length=64), nullable=False),
        sa.Column("device_label", sa.String(length=255), nullable=True),
        sa.Column("clock_in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("clock_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clock_in_ip", sa.String(length=64), nullable=True),
        sa.Column("clock_out_ip", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_attendance_device_sessions_shift_id", "attendance_device_sessions", ["shift_id"])
    op.create_index("ix_attendance_device_sessions_user_id", "attendance_device_sessions", ["user_id"])
    op.create_index("ix_attendance_device_sessions_device_id", "attendance_device_sessions", ["device_id"])
    op.create_index("ix_attendance_device_sessions_clock_in_at", "attendance_device_sessions", ["clock_in_at"])
    op.create_index("ix_attendance_device_sessions_clock_out_at", "attendance_device_sessions", ["clock_out_at"])

    # Note: We intentionally do not create a partial unique index here for SQLite compatibility.
    # App-level logic ensures: one open session per (user_id, device_id) and one open shift per user.


def downgrade():
    op.drop_index("ix_attendance_device_sessions_clock_out_at", table_name="attendance_device_sessions")
    op.drop_index("ix_attendance_device_sessions_clock_in_at", table_name="attendance_device_sessions")
    op.drop_index("ix_attendance_device_sessions_device_id", table_name="attendance_device_sessions")
    op.drop_index("ix_attendance_device_sessions_user_id", table_name="attendance_device_sessions")
    op.drop_index("ix_attendance_device_sessions_shift_id", table_name="attendance_device_sessions")
    op.drop_table("attendance_device_sessions")

    op.drop_index("ix_attendance_shifts_shift_end_at", table_name="attendance_shifts")
    op.drop_index("ix_attendance_shifts_shift_start_at", table_name="attendance_shifts")
    op.drop_index("ix_attendance_shifts_work_date", table_name="attendance_shifts")
    op.drop_index("ix_attendance_shifts_user_id", table_name="attendance_shifts")
    op.drop_table("attendance_shifts")

