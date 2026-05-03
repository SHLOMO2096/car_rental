import os
import sys
import json
from sqlalchemy import text
from app.db.session import SessionLocal, engine

def update_schema_and_seed():
    print("Checking database connection...")
    try:
        with engine.connect() as conn:
            print("Connected successfully.")
            
            # 1. Update Schema
            print("Updating schema (adding columns if missing)...")
            conn.execute(text("ALTER TABLE cars ADD COLUMN IF NOT EXISTS category VARCHAR(100);"))
            conn.execute(text("ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_hybrid BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE cars ADD COLUMN IF NOT EXISTS test_date VARCHAR(50);"))
            conn.execute(text("ALTER TABLE cars ALTER COLUMN price_per_day DROP NOT NULL;"))
            
            # 2. Seed Categories if hierarchy is empty
            print("Checking category hierarchy...")
            result = conn.execute(text("SELECT value FROM system_settings WHERE key = 'category_hierarchy';")).fetchone()
            
            if not result or not result[0] or result[0] == '[]':
                print("Seeding initial categories...")
                initial_cats = [
                    {"name": "מיני", "base_price": "150", "hybrid_price": "170"},
                    {"name": "סופרמיני", "base_price": "180", "hybrid_price": "200"},
                    {"name": "קומפקט", "base_price": "220", "hybrid_price": "240"},
                    {"name": "משפחתי", "base_price": "250", "hybrid_price": "280"},
                    {"name": "SUV", "base_price": "350", "hybrid_price": "380"},
                    {"name": "7 מקומות", "base_price": "450", "hybrid_price": "500"},
                ]
                val_json = json.dumps(initial_cats)
                
                if not result:
                    conn.execute(text("INSERT INTO system_settings (key, value) VALUES ('category_hierarchy', :val);"), {"val": val_json})
                else:
                    conn.execute(text("UPDATE system_settings SET value = :val WHERE key = 'category_hierarchy';"), {"val": val_json})
                
                print("Categories seeded successfully!")
            else:
                print("Category hierarchy already exists, skipping seed.")
            
            conn.commit()
            print("Done!")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    sys.path.append(os.getcwd())
    update_schema_and_seed()
