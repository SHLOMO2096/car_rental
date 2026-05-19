from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None = None
    actor_user_name: str | None = None
    action: str
    entity_type: str
    entity_id: str
    before_json: dict[str, Any] | None = None
    after_json: dict[str, Any] | None = None
    ip_address: str | None = None
    severity: str
    created_at: datetime

    model_config = {"from_attributes": True}

