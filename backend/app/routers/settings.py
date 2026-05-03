from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.settings import SystemSetting
from app.models.user import User
from app.core.permissions import Permissions
from app.core.security import require_permission

router = APIRouter()

@router.get("/{key}")
def get_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.BOOKINGS_VIEW)),
):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        # Default for quick_filters if not exists
        if key == "quick_filters":
            return {
                "key": "quick_filters",
                "value": [
                    {"label": "AB", "max_price": 175},
                    {"label": "CD", "max_price": 230},
                    {"label": "היברידי", "type": "hybrid"}
                ]
            }
        raise HTTPException(404, "Setting not found")
    return setting

@router.put("/{key}")
def update_setting(
    key: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.USERS_MANAGE)), # Require admin-like permission
):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        setting = SystemSetting(key=key, value=data.get("value"))
        db.add(setting)
    else:
        setting.value = data.get("value")
    
    db.commit()
    db.refresh(setting)
    return setting
