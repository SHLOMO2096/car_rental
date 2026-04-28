"""
Seed script – creates admin user and real fleet cars.
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

# ── Real fleet cars (source: CarsList.csv) ─────────────────────────────────────
# Price conversion notes:
#   daily   → used as-is
#   weekly  → divided by 7
#   monthly → divided by 30
#   half-day→ multiplied by 2
#
# is_active rules:
#   מושבת (disabled) → False   |   פעיל=לא → False   |   otherwise → True

REAL_CARS = [
    # ── Group A – mini/subcompact ──────────────────────────────────────────────
    dict(plate="1523834",   make="מיצובישי", name="מיצובישי אטראז",  type=CarType.sedan,     group="A", year=2015, color="שחור",      price_per_day=round(2393.00/30, 2), is_active=True,  description="אטראז קבוצה A – חוזה חודשי"),
    dict(plate="16420301",  make="מיצובישי", name="מיצובישי אטראז",  type=CarType.sedan,     group="A", year=2017, color="לבן",       price_per_day=139.83, is_active=True),
    dict(plate="2988034",   make="מיצובישי", name="מיצובישי אטראז",  type=CarType.sedan,     group="A", year=2015, color="אפור",      price_per_day=139.83, is_active=True),
    dict(plate="9920133",   make="מיצובישי", name="מיצובישי אטראז",  type=CarType.sedan,     group="A", year=2015, color="לבן",       price_per_day=round(2711.86/30, 2), is_active=True,  description="אטראז קבוצה A – חוזה חודשי"),

    dict(plate="18184701",  make="ניסן",      name="ניסן מיקרה",       type=CarType.hatchback, group="A", year=2017, color="כסף",      price_per_day=139.83, is_active=False, description="מושבת"),
    dict(plate="18253401",  make="ניסן",      name="ניסן מיקרה",       type=CarType.hatchback, group="A", year=2017, color="כסף",      price_per_day=round(805.08/7, 2),   is_active=True,  description="חוזה שבועי"),
    dict(plate="18638401",  make="ניסן",      name="ניסן מיקרה",       type=CarType.hatchback, group="A", year=2017, color="לבן",       price_per_day=139.83, is_active=True),
    dict(plate="18648901",  make="ניסן",      name="ניסן מיקרה",       type=CarType.hatchback, group="A", year=2017, color="כסף",      price_per_day=139.83, is_active=True),
    dict(plate="19334101",  make="ניסן",      name="ניסן מיקרה",       type=CarType.hatchback, group="A", year=2017, color="כסף",      price_per_day=139.83, is_active=True),
    dict(plate="2568833",   make="ניסן",      name="ניסן מיקרה",       type=CarType.hatchback, group="A", year=2015, color="כסף",      price_per_day=round(2393.00/30, 2), is_active=False, description="מושבת – חוזה חודשי"),
    dict(plate="58536901",  make="ניסן",      name="ניסן מיקרה",       type=CarType.hatchback, group="A", year=2018, color="אפור כהה", price_per_day=round(2711.86/30, 2), is_active=True,  description="חוזה חודשי – מכון רישוי מודיעין"),

    # ── Group B ────────────────────────────────────────────────────────────────
    dict(plate="14324201",  make="קיה",       name="קיה ריו",          type=CarType.hatchback, group="B", year=2018, color="לבן",       price_per_day=156.78, is_active=True),
    dict(plate="26377901",  make="פיאט",      name="פיאט טיפו",        type=CarType.hatchback, group="B", year=2017, color=None,         price_per_day=156.78, is_active=True),
    dict(plate="35891401",  make="פיאט",      name="פיאט טיפו",        type=CarType.hatchback, group="B", year=2017, color="אפור",      price_per_day=139.83, is_active=True),
    dict(plate="35892901",  make="פיאט",      name="פיאט טיפו",        type=CarType.hatchback, group="B", year=2017, color="לבן",       price_per_day=round(97.46*2, 2),    is_active=True,  description="חוזה חצי-יום"),
    dict(plate="35895701",  make="פיאט",      name="פיאט טיפו",        type=CarType.hatchback, group="B", year=2017, color="ברונזה",    price_per_day=156.78, is_active=True),
    dict(plate="35895901",  make="פיאט",      name="פיאט טיפו",        type=CarType.hatchback, group="B", year=2017, color="ברונזה",    price_per_day=156.78, is_active=True,  description="פנוי"),
    dict(plate="35890101",  make="פיאט",      name="פיאט טיפו",        type=CarType.hatchback, group="D", year=2017, color="כסף",      price_per_day=round(2393.16/30, 2), is_active=False, description="מושבת – לא פעיל"),

    # ── Group C – compact ──────────────────────────────────────────────────────
    dict(plate="41017001",  make="קיה",       name="קיה פורטה",        type=CarType.sedan,     group="C", year=2018, color="לבן",       price_per_day=173.73, is_active=True),
    dict(plate="5483833",   make="קיה",       name="קיה פורטה",        type=CarType.sedan,     group="C", year=2015, color="שחור",      price_per_day=173.73, is_active=True),
    dict(plate="5741485",   make="קיה",       name="קיה פורטה",        type=CarType.sedan,     group="C", year=2017, color="אפור כהה",  price_per_day=173.73, is_active=True),
    dict(plate="9131938",   make="קיה",       name="קיה פורטה",        type=CarType.sedan,     group="C", year=2016, color="שחור",      price_per_day=173.73, is_active=True),
    dict(plate="8168138",   make="קיה",       name="קיה סיד",          type=CarType.hatchback, group="C", year=2016, color="לבן",       price_per_day=173.73, is_active=True),

    # ── Group D – crossover/compact SUV ────────────────────────────────────────
    dict(plate="41017904",  make="קיה",       name="קיה סטוניק",       type=CarType.crossover, group="D", year=2025, color="לבן",       price_per_day=194.92, is_active=True),
    dict(plate="41018104",  make="קיה",       name="קיה נירו",         type=CarType.hybrid,    group="D", year=2025, color="אפור",      price_per_day=245.76, is_active=True),

    # ── Group E – mid sedan ────────────────────────────────────────────────────
    dict(plate="22080602",  make="טויוטה",    name="טויוטה קורולה",    type=CarType.sedan,     group="E", year=2020, color="לבן",       price_per_day=207.63, is_active=True),
    dict(plate="22172202",  make="טויוטה",    name="טויוטה קורולה",    type=CarType.sedan,     group="E", year=2020, color="לבן",       price_per_day=207.63, is_active=True),
    dict(plate="22569102",  make="טויוטה",    name="טויוטה קורולה",    type=CarType.sedan,     group="E", year=2020, color="לבן",       price_per_day=207.63, is_active=True),
    dict(plate="32770902",  make="טויוטה",    name="טויוטה קורולה",    type=CarType.sedan,     group="E", year=2020, color="לבן",       price_per_day=207.63, is_active=True),

    # ── Group G – 7-seater ─────────────────────────────────────────────────────
    dict(plate="16538002",  make="טויוטה",    name="טויוטה פריוס פלוס", type=CarType.hybrid,   group="G", year=2020, color="לבן",       price_per_day=338.98, is_active=True,  description="7 מקומות"),
]

added = 0
for data in REAL_CARS:
    if not db.query(Car).filter(Car.plate == data["plate"]).first():
        db.add(Car(**data))
        added += 1
db.commit()
print(f"✅ {added} car(s) added" if added else "ℹ️  Fleet cars already exist")

db.close()
print(f"\nSeed complete. Fleet: {len(REAL_CARS)} cars total.")
print("Login: admin@rental.co.il / Admin1234!")
sys.exit(0)

