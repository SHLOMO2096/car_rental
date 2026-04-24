"""
Seed script – creates admin user and sample cars if they don't exist.
Run inside Docker:
    docker compose exec backend python seed.py
"""
import sys
from app.db.session import Base, engine, SessionLocal
from app.models.user import User, UserRole
from app.models.car import Car, CarType
from app.models.booking import Booking  # noqa: F401 – needed to register the mapper
from app.core.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Admin user ─────────────────────────────────────────────────────────────────
if not db.query(User).filter(User.email == "admin@rental.co.il").first():
    db.add(User(
        email="admin@rental.co.il",
        full_name="מנהל ראשי",
        hashed_pw=hash_password("Admin1234!"),
        role=UserRole.admin,
        is_active=True,
    ))
    db.commit()
    print("✅ Admin user created  (admin@rental.co.il / Admin1234!)")
else:
    print("ℹ️  Admin user already exists")

# ── Sample cars ────────────────────────────────────────────────────────────────
SAMPLE_CARS = [
    dict(name="Toyota Corolla",  type=CarType.sedan,     year=2022, plate="123-456", color="לבן",   price_per_day=280.0),
    dict(name="Hyundai Tucson",  type=CarType.suv,       year=2023, plate="234-567", color="כחול",  price_per_day=380.0),
    dict(name="Kia Sportage",    type=CarType.crossover, year=2022, plate="345-678", color="אפור",  price_per_day=360.0),
    dict(name="Mazda 3",         type=CarType.hatchback, year=2021, plate="456-789", color="אדום",  price_per_day=250.0),
    dict(name="Tesla Model 3",   type=CarType.electric,  year=2023, plate="567-890", color="שחור",  price_per_day=500.0),
]

added = 0
for data in SAMPLE_CARS:
    if not db.query(Car).filter(Car.plate == data["plate"]).first():
        db.add(Car(**data))
        added += 1
db.commit()
print(f"✅ {added} sample car(s) added" if added else "ℹ️  Sample cars already exist")

db.close()
print("\nSeed complete. Login: admin@rental.co.il / Admin1234!")
sys.exit(0)

