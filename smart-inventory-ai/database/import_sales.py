"""
Data Import and Validation Script for Phase 7
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project

Imports processed_daily_sales.csv into PostgreSQL table `daily_product_sales`,
populates the `products` catalog, and validates row counts and aggregates.
"""

import io
import sys
import time
from pathlib import Path
import pandas as pd
import psycopg2

DB_DIR = Path(__file__).resolve().parent
PROJECT_DIR = DB_DIR.parent
DATA_DIR = PROJECT_DIR / "data"

if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from connection import get_connection, DB_NAME, DB_HOST


def populate_products(csv_path: Path, excel_path: Path) -> int:
    """Populate products catalog with StockCode, Description and UnitPrice."""
    print("Extracting distinct products for the catalog...")
    df_sales = pd.read_csv(csv_path, usecols=["StockCode"], dtype={"StockCode": str})
    unique_codes = df_sales["StockCode"].str.strip().dropna().unique()
    print(f"Found {len(unique_codes)} distinct StockCodes in processed sales ledger.")

    # Build description and price dictionary from Online Retail.xlsx if available
    desc_map = {}
    price_map = {}
    if excel_path.exists():
        print("Enriching product details from Online Retail.xlsx...")
        df_raw = pd.read_excel(excel_path, usecols=["StockCode", "Description", "UnitPrice"])
        df_raw["StockCode"] = df_raw["StockCode"].astype(str).str.strip()
        df_raw = df_raw.dropna(subset=["StockCode"])
        for _, row in df_raw.drop_duplicates(subset=["StockCode"]).iterrows():
            code = str(row["StockCode"]).strip()
            desc = str(row["Description"]).strip() if pd.notna(row["Description"]) else ""
            price = float(row["UnitPrice"]) if (pd.notna(row["UnitPrice"]) and row["UnitPrice"] >= 0) else 0.0
            if desc and desc != "nan":
                desc_map[code] = desc[:250]
            if price >= 0:
                price_map[code] = round(price, 2)

    # Insert products in batches
    insert_sql = """
        INSERT INTO products (
            stock_code, product_name, unit_price, current_stock,
            minimum_stock, safety_stock, reserved_stock, lead_time_days, max_capacity
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (stock_code) DO UPDATE SET
            product_name = EXCLUDED.product_name,
            unit_price = EXCLUDED.unit_price;
    """
    records = []
    for code in unique_codes:
        name = desc_map.get(code, f"Product {code}")
        price = price_map.get(code, 2.50)
        # Default operational inventory levels
        records.append((
            code,
            name,
            price,
            50,   # default current_stock
            15,   # default minimum_stock
            10,   # default safety_stock
            0,    # default reserved_stock
            3,    # default lead_time_days
            500   # default max_capacity
        ))

    with get_connection() as conn:
        with conn.cursor() as cur:
            from psycopg2.extras import execute_batch
            execute_batch(cur, insert_sql, records, page_size=1000)

    print(f"Successfully populated {len(records)} products in `products` table.")
    return len(records)


def bulk_import_daily_sales(csv_path: Path, truncate_first: bool = True) -> tuple[int, float]:
    """
    Fast bulk-load of processed_daily_sales.csv using PostgreSQL COPY command.
    Returns (row_count, total_units_sold).
    """
    start_time = time.time()
    print(f"Reading {csv_path.name} for bulk COPY into PostgreSQL...")

    # Load and clean CSV into a standardized buffer
    df = pd.read_csv(csv_path, dtype={"StockCode": str, "Date": str, "UnitsSold": int})
    total_csv_rows = len(df)
    total_csv_units = int(df["UnitsSold"].sum())
    min_date = df["Date"].min()
    max_date = df["Date"].max()

    print(f"CSV Summary: {total_csv_rows:,} rows | {total_csv_units:,} total units | Dates: {min_date} to {max_date}")

    with get_connection() as conn:
        with conn.cursor() as cur:
            if truncate_first:
                print("Truncating existing daily_product_sales records...")
                cur.execute("TRUNCATE TABLE daily_product_sales RESTART IDENTITY CASCADE;")

            print("Executing fast COPY streaming into `daily_product_sales`...")
            # Prepare an in-memory CSV buffer formatted for COPY
            buf = io.StringIO()
            df[["StockCode", "Date", "UnitsSold"]].to_csv(buf, index=False, header=False, sep="\t")
            buf.seek(0)

            cur.copy_from(
                buf,
                "daily_product_sales",
                columns=("stock_code", "sale_date", "units_sold"),
                sep="\t"
            )

    elapsed = time.time() - start_time
    print(f"Bulk COPY complete in {elapsed:.2f} seconds ({total_csv_rows / elapsed:,.0f} rows/sec).")
    return total_csv_rows, total_csv_units


def validate_import(csv_path: Path) -> dict:
    """Compare database counts and aggregates directly against processed_daily_sales.csv."""
    print("\n--- Validating Database Aggregates Against CSV ---")
    df = pd.read_csv(csv_path, dtype={"StockCode": str, "Date": str, "UnitsSold": int})
    csv_rows = len(df)
    csv_units = int(df["UnitsSold"].sum())
    csv_products = df["StockCode"].str.strip().nunique()
    csv_min_date = str(df["Date"].min())
    csv_max_date = str(df["Date"].max())

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    COUNT(*) AS row_count,
                    COALESCE(SUM(units_sold), 0) AS total_units,
                    COUNT(DISTINCT stock_code) AS distinct_products,
                    MIN(sale_date)::TEXT AS min_date,
                    MAX(sale_date)::TEXT AS max_date
                FROM daily_product_sales;
            """)
            db_rows, db_units, db_products, db_min_date, db_max_date = cur.fetchone()

    report = {
        "csv_rows": csv_rows,
        "db_rows": db_rows,
        "rows_match": (csv_rows == db_rows),
        "csv_units": csv_units,
        "db_units": int(db_units),
        "units_match": (csv_units == int(db_units)),
        "csv_products": csv_products,
        "db_products": db_products,
        "products_match": (csv_products == db_products),
        "csv_dates": f"{csv_min_date} to {csv_max_date}",
        "db_dates": f"{db_min_date} to {db_max_date}",
        "dates_match": (csv_min_date == db_min_date and csv_max_date == db_max_date),
    }

    print(f"Row count:      CSV = {report['csv_rows']:,} | DB = {report['db_rows']:,} -> {'MATCH' if report['rows_match'] else 'MISMATCH'}")
    print(f"Total Units:    CSV = {report['csv_units']:,} | DB = {report['db_units']:,} -> {'MATCH' if report['units_match'] else 'MISMATCH'}")
    print(f"Unique SKUs:    CSV = {report['csv_products']:,} | DB = {report['db_products']:,} -> {'MATCH' if report['products_match'] else 'MISMATCH'}")
    print(f"Date Range:     CSV = {report['csv_dates']} | DB = {report['db_dates']} -> {'MATCH' if report['dates_match'] else 'MISMATCH'}")

    assert report["rows_match"], f"Row count mismatch: CSV {csv_rows} vs DB {db_rows}"
    assert report["units_match"], f"Units mismatch: CSV {csv_units} vs DB {db_units}"
    assert report["products_match"], f"Products count mismatch: CSV {csv_products} vs DB {db_products}"
    assert report["dates_match"], f"Date range mismatch: CSV {report['csv_dates']} vs DB {report['db_dates']}"

    print("ALL VALIDATION CHECKS PASSED: 100% data integrity verified.")
    return report


def run_import() -> None:
    csv_file = DATA_DIR / "processed_daily_sales.csv"
    excel_file = DATA_DIR / "Online Retail.xlsx"

    if not csv_file.exists():
        raise FileNotFoundError(f"Processed daily sales file not found: {csv_file}")

    print(f"Connecting to database '{DB_NAME}' on {DB_HOST}...")
    populate_products(csv_file, excel_file)
    bulk_import_daily_sales(csv_file, truncate_first=True)
    validate_import(csv_file)


if __name__ == "__main__":
    run_import()
