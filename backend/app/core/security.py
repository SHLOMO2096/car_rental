from datetime import datetime, timedelta, timezone
from typing import Callable
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.permissions import ROLE_PERMISSIONS
from app.db.session import get_db

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_access_token(subject: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(subject), "role": role, "exp": expire},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )


def create_suggestion_apply_token(actor_user_id: int, payload: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.SUGGESTION_APPLY_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {
            "sub": str(actor_user_id),
            "type": "suggestion_apply",
            "data": payload,
            "exp": expire,
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def decode_suggestion_apply_token(token: str, actor_user_id: int) -> dict:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="קישור ההצעה לא תקין או פג תוקף",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "suggestion_apply":
            raise exc
        if int(payload.get("sub")) != actor_user_id:
            raise exc
        data = payload.get("data")
        if not isinstance(data, dict):
            raise exc
        return data
    except (JWTError, ValueError, TypeError, KeyError):
        raise exc

# ── Dependency: current user ───────────────────────────────────────────────────
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from app.models.user import User
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="אסימון לא תקין או פג תוקף",
                        headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise exc
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise exc
    return user

def _get_user_permissions(current_user) -> set[str]:
    return ROLE_PERMISSIONS.get(current_user.role, set())

def require_permission(permission_key: str) -> Callable:
    def dependency(current_user=Depends(get_current_user)):
        if permission_key not in _get_user_permissions(current_user):
            raise HTTPException(status_code=403, detail="אין הרשאה לפעולה זו")
        return current_user

    return dependency

def require_booking_scope_or_admin(booking_id: int,
                                   db: Session = Depends(get_db),
                                   current_user=Depends(get_current_user)):
    from app.models.booking import Booking
    from app.models.user import UserRole

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="הזמנה לא נמצאה")

    if current_user.role != UserRole.admin and booking.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="אין הרשאה לגשת להזמנה זו")

    return booking

def require_admin(current_user=Depends(get_current_user)):
    from app.models.user import UserRole
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="נדרשת הרשאת מנהל")
    return current_user

def require_agent_or_admin(current_user=Depends(get_current_user)):
    return current_user  # כל משתמש מאומת
