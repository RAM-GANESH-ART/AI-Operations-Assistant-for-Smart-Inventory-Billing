"""
Database Connection and Configuration Module
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project
Target: PostgreSQL 16
"""

import os
from contextlib import contextmanager
from typing import Generator, Optional
import psycopg2
from psycopg2.extensions import connection as PgConnection, cursor as PgCursor
from psycopg2.extras import RealDictCursor


# Database Configuration Defaults
DB_NAME = os.getenv("SMART_INV_DB_NAME", "smart_inventory_db")
DB_USER = os.getenv("SMART_INV_DB_USER", "postgres")
DB_PASSWORD = os.getenv("SMART_INV_DB_PASSWORD", "postgres")
DB_HOST = os.getenv("SMART_INV_DB_HOST", "localhost")
DB_PORT = int(os.getenv("SMART_INV_DB_PORT", "5432"))


def get_db_url() -> str:
    """Return standard SQLAlchemy / psycopg2 database URL."""
    return f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


def create_connection(dbname: Optional[str] = None) -> PgConnection:
    """Create a new raw psycopg2 connection."""
    target_db = dbname or DB_NAME
    return psycopg2.connect(
        dbname=target_db,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
    )


@contextmanager
def get_connection(dbname: Optional[str] = None) -> Generator[PgConnection, None, None]:
    """Context manager for managing connection lifecycle with auto-commit/rollback."""
    conn = create_connection(dbname)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_cursor(
    dict_cursor: bool = False, dbname: Optional[str] = None
) -> Generator[PgCursor, None, None]:
    """Context manager for executing SQL queries inside a transaction."""
    cursor_factory = RealDictCursor if dict_cursor else None
    with get_connection(dbname) as conn:
        with conn.cursor(cursor_factory=cursor_factory) as cur:
            yield cur
