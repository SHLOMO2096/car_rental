import csv

def clean_csv():
    input_file = 'frontend/CarsList (1).csv'
    output_file = 'backend/cars_to_import.csv'
    cols = ['מספר רכב', 'יצרן', 'דגם', 'צבע', 'שנה', 'תאריך טסט']
    
    try:
        with open(input_file, 'r', encoding='utf-8-sig') as f:
            # Skip the first title line
            f.readline()
            
            reader = csv.DictReader(f)
            rows = []
            for row in reader:
                # Keep only specific columns and strip whitespace
                clean_row = {k: row.get(k, '').strip() for k in cols}
                if clean_row['מספר רכב']:
                    rows.append(clean_row)
        
        with open(output_file, 'w', encoding='utf-8-sig', newline='') as out:
            writer = csv.DictWriter(out, fieldnames=cols)
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"Successfully cleaned {len(rows)} rows.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    clean_csv()
