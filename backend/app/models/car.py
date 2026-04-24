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
    type          = Column(Enum(CarType), nullable=False)
    year          = Column(Integer, nullable=False)
    plate         = Column(String(20), unique=True, nullable=False, index=True)
    color         = Column(String(50))
    price_per_day = Column(Float, nullable=False)
    description   = Column(Text)
    image_url     = Column(String(500))
    is_active     = Column(Boolean, default=True, nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    bookings = relationship("Booking", back_populates="car", lazy="dynamic")
