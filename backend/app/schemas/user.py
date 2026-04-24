# ══════════════════════════════════════════════════════════════════════════════
from pydantic import BaseModel, EmailStr
from datetime import datetime
from app.models.user import UserRole

class UserCreate(BaseModel):
    email:     EmailStr
    full_name: str
    password:  str
    role:      UserRole = UserRole.agent

class UserUpdate(BaseModel):
    full_name: str | None = None
    role:      UserRole | None = None
    is_active: bool | None = None

class UserOut(BaseModel):
    id:         int
    email:      EmailStr
    full_name:  str
    role:       UserRole
    is_active:  bool
    created_at: datetime
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut

# ══════════════════════════════════════════════════════════════════════════════
