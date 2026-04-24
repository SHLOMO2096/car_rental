# ══════════════════════════════════════════════════════════════════════════════
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from app.db.session import get_db
from app.crud.booking import crud_booking
from app.core.security import get_current_user

router = APIRouter()

@router.get("/summary")
def summary(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return crud_booking.summary(db)

@router.get("/monthly")
def monthly_revenue(
    year: int = Query(default=datetime.now().year),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return crud_booking.monthly_revenue(db, year)

@router.get("/top-cars")
def top_cars(
    limit: int = Query(default=5, le=20),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return crud_booking.top_cars(db, limit)
