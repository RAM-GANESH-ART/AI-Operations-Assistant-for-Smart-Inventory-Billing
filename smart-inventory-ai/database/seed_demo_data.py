"""
Demo Seed Data Script for Phase 7
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project

Inserts clearly labeled demo seed records for users, suppliers,
purchase orders, initial billing transactions, and stock movements.
"""

import sys
from pathlib import Path
import psycopg2

DB_DIR = Path(__file__).resolve().parent
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from connection import get_connection


def seed_users() -> None:
    """Seed system users with role-based access control."""
    print("Seeding demo users...")
    # Passwords hashed with dummy salt for demonstration/viva
    users = [
        ("owner", "pbkdf2:sha256:600000$owner$demo_hash_owner123", "Shop Owner", "OWNER"),
        ("manager", "pbkdf2:sha256:600000$manager$demo_hash_mgr123", "Store Manager", "MANAGER"),
        ("cashier", "pbkdf2:sha256:600000$cashier$demo_hash_csh123", "Counter Cashier", "CASHIER"),
    ]
    sql = """
        INSERT INTO users (username, password_hash, full_name, role)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (username) DO NOTHING;
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(sql, users)
    print("Demo users seeded: owner, manager, cashier.")


def seed_suppliers() -> None:
    """Seed supplier contacts and default lead times."""
    print("Seeding demo suppliers...")
    suppliers = [
        ("Apex Retail Wholesalers", "Ramesh Sharma", "ramesh@apexretail.in", "+91 98765 43210", 3),
        ("Northern FMCG Distributors", "Pooja Gupta", "orders@northernfmcg.com", "+91 98111 22334", 5),
        ("Kirana Prime Logistics", "Vikram Patel", "supply@kiranaprime.in", "+91 97222 33445", 2),
    ]
    sql = """
        INSERT INTO suppliers (supplier_name, contact_name, email, phone, lead_time_days)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING;
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.executemany(sql, suppliers)
    print("Demo suppliers seeded.")


def seed_sample_invoices() -> None:
    """Seed initial sample invoices and line items."""
    print("Seeding demo billing records...")
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Pick two valid products
            cur.execute("SELECT stock_code, unit_price FROM products LIMIT 2;")
            sample_prods = cur.fetchall()
            if not sample_prods:
                print("No products found to attach to demo invoices.")
                return

            p1, price1 = sample_prods[0]
            p2, price2 = sample_prods[1] if len(sample_prods) > 1 else (sample_prods[0], sample_prods[0][1])

            # Insert sample invoice
            cur.execute("""
                INSERT INTO invoices (invoice_no, customer_name, total_amount, payment_method, status)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (invoice_no) DO NOTHING
                RETURNING invoice_id;
            """, ("INV-DEMO-001", "Demo Customer Walk-in", float(price1 * 2 + price2 * 3), "CASH", "PAID"))
            row = cur.fetchone()
            if row:
                inv_id = row[0]
                cur.execute("""
                    INSERT INTO invoice_items (invoice_id, stock_code, quantity, unit_price, line_total)
                    VALUES 
                        (%s, %s, 2, %s, %s),
                        (%s, %s, 3, %s, %s);
                """, (inv_id, p1, price1, price1 * 2, inv_id, p2, price2, price2 * 3))
                print(f"Created demo invoice INV-DEMO-001 with 2 line items.")


def seed_demo_data() -> None:
    seed_users()
    seed_suppliers()
    seed_sample_invoices()
    print("All demo seed data inserted successfully.")


if __name__ == "__main__":
    seed_demo_data()
