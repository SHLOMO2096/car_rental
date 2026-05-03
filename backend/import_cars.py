import os
import sys
import csv
from sqlalchemy import text
from app.db.session import SessionLocal, engine
from app.models.car import Car

# מפת סיווג חכמה
CATEGORIES_MAP = {
    "מיקרה": "מיני",
    "פיקנטו": "מיני",
    "I10": "מיני",
    "ספארק": "מיני",
    "יאריס": "סופרמיני",
    "I20": "סופרמיני",
    "אטראז": "סופרמיני",
    "ריו": "סופרמיני",
    "מאזדה 2": "סופרמיני",
    "קורולה": "משפחתי",
    "אלנטרה": "משפחתי",
    "אוקטביה": "משפחתי",
    "טיפו": "משפחתי",
    "ספורטאז": "SUV",
    "טוסון": "SUV",
    "אאוטלנדר": "7 מקומות",
    "פריוס פלוס": "7 מקומות",
}

def get_category(make, model):
    full_name = f"{make} {model}".lower()
    for key, cat in CATEGORIES_MAP.items():
        if key.lower() in full_name:
            return cat
    return "" # נשאר ללא קטגוריה אם לא זוהה

def is_hybrid_car(make, model, year):
    full_name = f"{make} {model}".lower()
    hybrids = ["פריוס", "איוניק", "נירו", "hybrid"]
    if any(h in full_name for h in hybrids):
        return True
    if "קורולה" in full_name and int(year) >= 2019:
        return True
    return False

def run_import(csv_path):
    print(f"Starting import from {csv_path}...")
    db = SessionLocal()
    
    try:
        with open(csv_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            count_added = 0
            count_updated = 0
            
            for row in reader:
                plate = row.get("מספר רכב", "").strip()
                if not plate: continue
                
                make = row.get("יצרן", "").strip()
                model = row.get("דגם", "").strip()
                color = row.get("צבע", "").strip()
                year = row.get("שנה", "2020").strip()
                test_date = row.get("תאריך טסט", "").strip()
                
                category = get_category(make, model)
                is_hybrid = is_hybrid_car(make, model, year)
                
                # Check if car exists
                car = db.query(Car).filter(Car.plate == plate).first()
                
                if car:
                    car.category = category or car.category
                    car.is_hybrid = is_hybrid
                    car.test_date = test_date
                    car.color = color
                    car.make = make
                    car.name = f"{make} {model}"
                    count_updated += 1
                else:
                    car = Car(
                        plate=plate,
                        name=f"{make} {model}",
                        make=make,
                        year=int(year) if year.isdigit() else 2020,
                        color=color,
                        category=category,
                        is_hybrid=is_hybrid,
                        test_date=test_date,
                        price_per_day=None, # Use category price
                        is_active=True
                    )
                    db.add(car)
                    count_added += 1
            
            db.commit()
            print(f"Import complete! Added: {count_added}, Updated: {count_updated}")
            
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_cars.py <csv_file_path>")
    else:
        run_import(sys.argv[1])
