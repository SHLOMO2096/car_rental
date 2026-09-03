import enum

from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class CarBlockReason(str, enum.Enum):
    """סיבת ההשבתה — קובעת גם את הצבע ברשת הזמינות."""
    garage   = "garage"     # מוסך / טיפול
    accident = "accident"   # תאונה
    other    = "other"      # אחר


class CarBlock(Base):
    """
    השבתה זמנית של רכב — תקופה שבה הרכב אינו זמין להשכרה.

    בניגוד ל-`Car.is_active`, שמשבית רכב ללא הגבלת זמן, השבתה כאן היא
    לטווח תאריכים: הרכב נשאר בצי, מופיע ברשת הזמינות בצבע נפרד, ואי אפשר
    להזמין אותו בתוך הטווח בלבד.

    השבתה מבוטלת נמחקת מחיקה רכה, כמו הזמנות — כדי שהיסטוריית הביטול
    תישמר לביקורת.
    """
    __tablename__ = "car_blocks"

    id         = Column(Integer, primary_key=True, index=True)
    car_id     = Column(Integer, ForeignKey("cars.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date = Column(Date, nullable=False, index=True)
    end_date   = Column(Date, nullable=False, index=True)
    reason     = Column(String(20), nullable=False, default=CarBlockReason.garage.value)
    note       = Column(Text, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    car             = relationship("Car")
    created_by_user = relationship("User", foreign_keys=[created_by])
    updated_by_user = relationship("User", foreign_keys=[updated_by])
    deleted_by_user = relationship("User", foreign_keys=[deleted_by])

    __table_args__ = (
        Index("ix_car_blocks_car_range", "car_id", "start_date", "end_date"),
    )
