from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.car_block import CarBlockReason


class CarBlockBase(BaseModel):
    car_id: int
    start_date: date
    end_date: date
    reason: CarBlockReason = CarBlockReason.garage
    note: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _check_range(self):
        if self.end_date < self.start_date:
            raise ValueError("תאריך הסיום מוקדם מתאריך ההתחלה")
        return self


class CarBlockCreate(CarBlockBase):
    pass


class CarBlockUpdate(BaseModel):
    """עדכון חלקי — משמש להארכה, לקיצור ולשינוי הסיבה."""
    start_date: date | None = None
    end_date: date | None = None
    reason: CarBlockReason | None = None
    note: str | None = Field(default=None, max_length=1000)


class CarBlockOut(CarBlockBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
    created_by_name: str | None = None
    car_name: str | None = None
    car_plate: str | None = None
