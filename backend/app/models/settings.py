from sqlalchemy import Column, String, JSON
from app.db.session import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key   = Column(String(100), primary_key=True, index=True)
    value = Column(JSON, nullable=False)
