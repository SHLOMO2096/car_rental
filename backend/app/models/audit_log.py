import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.db.session import Base


class AuditSeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(50), nullable=False, index=True)
    before_json = Column(Text, nullable=True)
    after_json = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)
    severity = Column(String(20), nullable=False, default=AuditSeverity.info.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

