import enum
from sqlalchemy import Column, Integer, String, Float, Date, Text, ForeignKey, Enum, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class BookingStatus(str, enum.Enum):
    active    = "active"
    completed = "completed"
    cancelled = "cancelled"

class Booking(Base):
    __tablename__ = "bookings"

    id              = Column(Integer, primary_key=True, index=True)
    car_id          = Column(Integer, ForeignKey("cars.id", ondelete="RESTRICT"), nullable=False)
    customer_id     = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    customer_name   = Column(String(255), nullable=False)
    customer_email  = Column(String(255), index=True)     # לשליחת אימיילים
    customer_phone  = Column(String(50))
    customer_id_num = Column(String(20))
    start_date      = Column(Date, nullable=False, index=True)
    end_date        = Column(Date, nullable=False, index=True)
    pickup_time     = Column(String(5))   # "HH:MM"
    return_time     = Column(String(5))   # "HH:MM"
    total_price     = Column(Float)
    status          = Column(Enum(BookingStatus), default=BookingStatus.active, nullable=False, index=True)
    notes           = Column(Text)
    drive_link      = Column(String(2048), nullable=True)
    email_sent      = Column(Boolean, default=False)   # האם נשלח אימייל אישור
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())
    # ── Soft Delete ────────────────────────────────────────────────────────────
    deleted_at      = Column(DateTime(timezone=True), nullable=True)
    deleted_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    car          = relationship("Car", back_populates="bookings")
    customer     = relationship("Customer", back_populates="bookings")
    agent        = relationship("User", foreign_keys=[created_by])
    deleted_by_user = relationship("User", foreign_keys=[deleted_by])
