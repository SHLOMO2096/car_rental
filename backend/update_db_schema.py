import os
import sys
from sqlalchemy import text
from app.db.session import SessionLocal, engine

def update_schema():
    print("Checking database connection...")
    try:
        with engine.connect() as conn:
            print("Connected successfully.")
            
            print("Adding 'category' column to 'cars' table...")
            conn.execute(text("ALTER TABLE cars ADD COLUMN IF NOT EXISTS category VARCHAR(100);"))
            
            print("Adding 'is_hybrid' column to 'cars' table...")
            conn.execute(text("ALTER TABLE cars ADD COLUMN IF NOT EXISTS is_hybrid BOOLEAN DEFAULT FALSE;"))
            
            print("Making 'price_per_day' nullable...")
            conn.execute(text("ALTER TABLE cars ALTER COLUMN price_per_day DROP NOT NULL;"))
            
            conn.commit()
            print("Schema updated successfully!")
            
    except Exception as e:
        print(f"Error updating schema: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Ensure we are in the correct directory to import app
    sys.path.append(os.getcwd())
    update_schema()
