# ══════════════════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, UserOut, Token
from app.core.security import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin,
)

router = APIRouter()

@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username, User.is_active == True).first()
    if not user or not verify_password(form.password, user.hashed_pw):
        raise HTTPException(401, "אימייל או סיסמה שגויים")
    token = create_access_token(user.id, user.role)
    return {"access_token": token, "user": user}

@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/users", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db),
                _: User = Depends(require_admin)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "אימייל כבר קיים במערכת")
    u = User(email=data.email, full_name=data.full_name,
             hashed_pw=hash_password(data.password), role=data.role)
    db.add(u); db.commit(); db.refresh(u)
    return u

@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).all()

@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, data: UserUpdate,
                db: Session = Depends(get_db), _: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "משתמש לא נמצא")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    db.commit(); db.refresh(u)
    return u


# ══════════════════════════════════════════════════════════════════════════════
