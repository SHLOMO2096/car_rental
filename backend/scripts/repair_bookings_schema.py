from pathlib import Path
import sys

from sqlalchemy import inspect, text

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.db.session import engine


REQUIRED_BOOKINGS_COLUMNS = {
    "created_by": "ALTER TABLE bookings ADD COLUMN created_by INTEGER",
    "customer_id": "ALTER TABLE bookings ADD COLUMN customer_id INTEGER",
    "customer_email": "ALTER TABLE bookings ADD COLUMN customer_email VARCHAR(255)",
    "customer_phone": "ALTER TABLE bookings ADD COLUMN customer_phone VARCHAR(50)",
    "customer_id_num": "ALTER TABLE bookings ADD COLUMN customer_id_num VARCHAR(20)",
    "pickup_time": "ALTER TABLE bookings ADD COLUMN pickup_time VARCHAR(5)",
    "return_time": "ALTER TABLE bookings ADD COLUMN return_time VARCHAR(5)",
    "notes": "ALTER TABLE bookings ADD COLUMN notes TEXT",
    "email_sent": "ALTER TABLE bookings ADD COLUMN email_sent BOOLEAN DEFAULT FALSE",
}


def main() -> int:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    print(f"Dialect: {engine.dialect.name}")
    print(f"Tables: {', '.join(sorted(tables))}")

    if "bookings" not in tables:
        print("ERROR: bookings table does not exist")
        return 1

    booking_columns = {col["name"] for col in inspector.get_columns("bookings")}
    print(f"bookings columns: {', '.join(sorted(booking_columns))}")

    repairs = []
    with engine.begin() as conn:
        for column_name, ddl in REQUIRED_BOOKINGS_COLUMNS.items():
            if column_name not in booking_columns:
                print(f"Adding missing column: bookings.{column_name}")
                conn.execute(text(ddl))
                repairs.append(column_name)

        if "email_sent" in REQUIRED_BOOKINGS_COLUMNS:
            try:
                conn.execute(text("UPDATE bookings SET email_sent = FALSE WHERE email_sent IS NULL"))
            except Exception as exc:
                print(f"WARN: failed to backfill bookings.email_sent: {exc}")

        bookings_count = conn.execute(text("SELECT COUNT(*) FROM bookings")).scalar_one()
        cars_count = conn.execute(text("SELECT COUNT(*) FROM cars")).scalar_one() if "cars" in tables else 0
        active_cars_count = 0
        if "cars" in tables:
            active_cars_count = conn.execute(text("SELECT COUNT(*) FROM cars WHERE is_active = TRUE")).scalar_one()

    print(f"bookings count: {bookings_count}")
    print(f"cars count: {cars_count}")
    print(f"active cars count: {active_cars_count}")

    if repairs:
        print(f"Applied repairs: {', '.join(repairs)}")
    else:
        print("No schema repairs were needed")

    if active_cars_count == 0:
        print("WARN: there are zero active cars; booking dropdown will be empty until at least one car is active")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

