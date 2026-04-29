"""
Clean AccountsList.csv and optionally import into customers table.

Usage examples:
    python scripts/import_customers_from_csv.py --source "C:/Users/shlomo/Downloads/AccountsList.csv" --clean-out "data/customers_clean.csv"
    python scripts/import_customers_from_csv.py --source "C:/Users/shlomo/Downloads/AccountsList.csv" --clean-out "data/customers_clean.csv" --import-db
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.services.customer_import import (
    import_customers_to_db,
    load_rows_from_path,
    parse_customer_rows_with_report,
    write_clean_csv,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean and import customers CSV")
    parser.add_argument("--source", required=True, help="Path to original CSV file")
    parser.add_argument("--clean-out", required=True, help="Path to cleaned CSV output")
    parser.add_argument("--import-db", action="store_true", help="Import cleaned rows into DB")
    parser.add_argument(
        "--database-url",
        default=None,
        help="Optional DB URL override for this run (useful outside docker)",
    )
    return parser.parse_args()


def clean_rows(source_path: Path) -> tuple[list[dict], list[dict], int]:
    if not source_path.exists():
        raise FileNotFoundError(
            f"Source file not found: {source_path}. "
            "When running inside Docker, use a path that exists inside /app "
            "or copy the file into backend/data first."
        )
    return parse_customer_rows_with_report(load_rows_from_path(source_path))


def import_into_db(rows: list[dict], *, issues: list[dict], skipped: int) -> dict:
    import app.models.user  # noqa: F401
    import app.models.car  # noqa: F401
    import app.models.booking  # noqa: F401
    import app.models.customer  # noqa: F401
    from app.db.session import SessionLocal, Base, engine

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        return import_customers_to_db(db, rows, issues=issues, skipped=skipped)
    finally:
        db.close()


def main() -> None:
    args = parse_args()
    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url

    source_path = Path(args.source)
    clean_out_path = Path(args.clean_out)

    cleaned, issues, skipped = clean_rows(source_path)
    write_clean_csv(clean_out_path, cleaned)
    print(f"Cleaned rows: {len(cleaned)}")
    print(f"Skipped rows: {skipped}")
    if issues:
        print(f"Issues: {len(issues)}")
    print(f"Wrote: {clean_out_path}")

    if args.import_db:
        result = import_into_db(cleaned, issues=issues, skipped=skipped)
        print(f"Imported/updated customers: {result['processed']}")
        print(f"New customers inserted: {result['inserted']}")


if __name__ == "__main__":
    main()

