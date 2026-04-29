from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.booking import BookingOut


class CustomerCreate(BaseModel):
    name: str
    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    id_number: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    id_number: str | None = None


class CustomerOut(BaseModel):
    id: int
    name: str
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    id_number: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerHistorySummaryOut(BaseModel):
    total_bookings: int
    active_bookings: int
    total_revenue: float
    last_booking_date: date | None = None


class CustomerHistoryOut(BaseModel):
    customer: CustomerOut
    summary: CustomerHistorySummaryOut
    bookings: list[BookingOut]


class CustomerImportResultOut(BaseModel):
    processed: int
    inserted: int
    updated: int
    skipped: int = 0
    issues: list[dict] = Field(default_factory=list)


class CustomerEmailRequest(BaseModel):
    subject: str
    body: str


class CustomerBulkEmailRequest(BaseModel):
    subject: str
    body: str
    audience: str = "all"  # "all" | "active" | "with_bookings"


class CustomerBulkEmailResult(BaseModel):
    queued: int
    skipped: int


