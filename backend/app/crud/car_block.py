from datetime import date

from sqlalchemy.orm import Session

from app.models.car_block import CarBlock


class CRUDCarBlock:
    """
    השבתות זמניות. כל שאילתה כאן מסננת מחיקות רכות — השבתה שבוטלה אינה
    חוסמת דבר, אבל השורה נשמרת לביקורת.
    """

    def _base(self, db: Session):
        return db.query(CarBlock).filter(CarBlock.deleted_at.is_(None))

    def get(self, db: Session, block_id: int) -> CarBlock | None:
        return self._base(db).filter(CarBlock.id == block_id).first()

    def list_range(self, db: Session, start: date, end: date,
                   car_id: int | None = None) -> list[CarBlock]:
        q = self._base(db).filter(CarBlock.start_date <= end, CarBlock.end_date >= start)
        if car_id is not None:
            q = q.filter(CarBlock.car_id == car_id)
        return q.order_by(CarBlock.start_date).all()

    def overlapping(self, db: Session, car_id: int, start: date, end: date,
                    exclude_id: int | None = None) -> list[CarBlock]:
        """
        השבתות שחופפות לטווח. ההשוואה כוללת את קצוות הטווח: יום השבתה הוא
        יום מלא, ולכן אין כאן את ההקלה של שעת איסוף/החזרה שקיימת בהזמנות.
        """
        q = self._base(db).filter(
            CarBlock.car_id == car_id,
            CarBlock.start_date <= end,
            CarBlock.end_date >= start,
        )
        if exclude_id is not None:
            q = q.filter(CarBlock.id != exclude_id)
        return q.all()

    def has_overlap(self, db: Session, car_id: int, start: date, end: date,
                    exclude_id: int | None = None) -> bool:
        return bool(self.overlapping(db, car_id, start, end, exclude_id=exclude_id))

    def blocked_car_ids(self, db: Session, start: date, end: date) -> set[int]:
        rows = (
            self._base(db)
            .with_entities(CarBlock.car_id)
            .filter(CarBlock.start_date <= end, CarBlock.end_date >= start)
            .all()
        )
        return {r[0] for r in rows}


crud_car_block = CRUDCarBlock()
