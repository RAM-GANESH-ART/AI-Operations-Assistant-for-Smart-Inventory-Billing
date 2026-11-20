"""
Database Initialization Script
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project

Creates `smart_inventory_db` database and runs `schema.sql`.
"""

import sys
from pathlib import Path
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

DB_DIR = Path(__file__).resolve().parent
PROJECT_DIR = DB_DIR.parent
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from connection import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER, get_connection


def create_database_if_not_exists() -> None:
    """Connect to default 'postgres' database and create target database if needed."""
    print(f"Connecting to PostgreSQL server at {DB_HOST}:{DB_PORT} as {DB_USER}...")
    conn = psycopg2.connect(
        dbname="postgres",
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (DB_NAME,))
    exists = cur.fetchone()
    if not exists:
        print(f"Creating database '{DB_NAME}'...")
        cur.execute(f'CREATE DATABASE "{DB_NAME}";')
        print(f"Database '{DB_NAME}' created successfully.")
    else:
        print(f"Database '{DB_NAME}' already exists.")

    cur.close()
    conn.close()


def apply_schema(schema_file: Optional[Path] = None) -> None:
    """Read schema.sql and apply to smart_inventory_db."""
    schema_path = schema_file or (DB_DIR / "schema.sql")
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found at: {schema_path}")

    print(f"Applying schema from {schema_path.name} to '{DB_NAME}'...")
    sql_script = schema_path.read_text(encoding="utf-8")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql_script)

    print("Schema applied successfully. All tables, constraints, and indexes created.")


def initialize() -> None:
    """Full initialization pipeline."""
    create_database_if_not_exists()
    apply_schema()
    print("Database initialization complete.")


if __name__ == "__main__":
    from typing import Optional
    initialize()
