from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
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

def require_admin(current_user=Depends(get_current_user)):
    from app.models.user import UserRole
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="נדרשת הרשאת מנהל")
    return current_user

def require_agent_or_admin(current_user=Depends(get_current_user)):
    return current_user  # כל משתמש מאומת
