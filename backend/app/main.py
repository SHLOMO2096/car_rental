from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import engine, Base
import app.models.user    # noqa
import app.models.car     # noqa
import app.models.booking # noqa
import app.models.customer # noqa
import app.models.audit_log # noqa
from app.routers import auth, cars, bookings, reports, suggestions, customers

# יצירת טבלאות (בפרודקשן — השתמש ב-Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,   # Swagger רק ב-dev
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(cars.router,        prefix="/api/cars",        tags=["Cars"])
app.include_router(bookings.router,    prefix="/api/bookings",    tags=["Bookings"])
app.include_router(customers.router,   prefix="/api/customers",   tags=["Customers"])
app.include_router(reports.router,     prefix="/api/reports",     tags=["Reports"])
app.include_router(suggestions.router, prefix="/api/suggestions", tags=["Suggestions"])

@app.get("/health")
def health():
    return {"status": "ok", "version": settings.APP_VERSION}
