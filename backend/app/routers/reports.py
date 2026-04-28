# ══════════════════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.session import get_db
from app.crud.booking import crud_booking
from app.core.permissions import Permissions
from app.core.security import require_permission
from app.models.user import User

router = APIRouter()

@router.get("/summary")
def summary(
    model: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.REPORTS_VIEW)),
):
    return crud_booking.summary(db, model=model)

@router.get("/monthly")
def monthly_revenue(
    year: int = Query(default=datetime.now().year),
    model: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.REPORTS_VIEW)),
):
    return crud_booking.monthly_revenue(db, year, model=model)

@router.get("/top-cars")
def top_cars(
    limit: int = Query(default=5, le=20),
    model: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.REPORTS_VIEW)),
):
    return crud_booking.top_cars(db, limit, model=model)
