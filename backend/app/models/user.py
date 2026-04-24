import enum
from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime
from sqlalchemy.sql import func
from app.db.session import Base

class UserRole(str, enum.Enum):
    admin = "admin"
    agent = "agent"

class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    email      = Column(String(255), unique=True, index=True, nullable=False)
    full_name  = Column(String(255), nullable=False)
    hashed_pw  = Column(String(255), nullable=False)
    role       = Column(Enum(UserRole), default=UserRole.agent, nullable=False)
    is_active  = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
