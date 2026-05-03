import enum
from sqlalchemy import Column, Integer, String, Float, Boolean, Enum, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class CarType(str, enum.Enum):
    sedan     = "sedan"
    crossover = "crossover"
    suv       = "suv"
    hatchback = "hatchback"
    mini      = "mini"
    hybrid    = "hybrid"
    electric  = "electric"
    luxury    = "luxury"
    van       = "van"

class Car(Base):
    __tablename__ = "cars"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(255), nullable=False)
    make          = Column(String(100))                   # יצרן (e.g. Toyota, Kia)
    type          = Column(Enum(CarType), nullable=False)
    group         = Column(String(10))                    # קבוצת רכב (A, B, C, D, E, G …)
    year          = Column(Integer, nullable=False)
    plate         = Column(String(20), unique=True, nullable=False, index=True)
    category      = Column(String(100), index=True)       # למשל: מיני, משפחתי
    is_hybrid     = Column(Boolean, default=False)        # האם היברידי
    color         = Column(String(50))
    price_per_day = Column(Float, nullable=True)          # יכול להיות ריק כדי להשתמש במחיר קטגוריה
    description   = Column(Text)
    image_url     = Column(String(500))
    is_active     = Column(Boolean, default=True, nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    bookings = relationship("Booking", back_populates="car", lazy="dynamic")
