"""
Database Unit & Integration Test Suite
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project

Tests all 12 Phase 7 requirements:
1. Database connection
2. Expected core tables exist (7 core tables)
3. Primary and foreign key constraints
4. Duplicate product prevention
5. Negative stock prevention
6. Negative price prevention
7. Invoice creation
8. Invoice item insertion
9. Stock deduction after billing
10. Stock movement recording
11. Transaction rollback when billing fails
12. Prevention of overselling (including concurrent simultaneous attempts)
"""

import concurrent.futures
import sys
import unittest
from decimal import Decimal
from pathlib import Path
import psycopg2
from psycopg2 import errors

DB_DIR = Path(__file__).resolve().parent
PROJECT_DIR = DB_DIR.parent
SERVICES_DIR = PROJECT_DIR / "services"

if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))
if str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))

from connection import get_connection, DB_NAME
from billing_service import BillingService, CartItem, InsufficientStockError


class TestPhase7DatabaseSuite(unittest.TestCase):
    """Full 12-point Phase 7 verification test suite."""

    CORE_TABLES = [
        "users",
        "products",
        "stock_movements",
        "daily_product_sales",
        "demand_forecasts",
        "invoices",
        "invoice_items",
    ]

    def setUp(self):
        # Clean up any test-specific SKUs or invoices
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM invoice_items WHERE stock_code LIKE 'TEST_%';
                    DELETE FROM stock_movements WHERE stock_code LIKE 'TEST_%';
                    DELETE FROM daily_product_sales WHERE stock_code LIKE 'TEST_%';
                    DELETE FROM demand_forecasts WHERE stock_code LIKE 'TEST_%';
                    DELETE FROM invoices WHERE invoice_no LIKE 'TEST_INV_%';
                    DELETE FROM products WHERE stock_code LIKE 'TEST_%';
                """)

    def tearDown(self):
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM invoice_items WHERE stock_code LIKE 'TEST_%';
                    DELETE FROM stock_movements WHERE stock_code LIKE 'TEST_%';
                    DELETE FROM daily_product_sales WHERE stock_code LIKE 'TEST_%';
                    DELETE FROM demand_forecasts WHERE stock_code LIKE 'TEST_%';
                    DELETE FROM invoices WHERE invoice_no LIKE 'TEST_INV_%';
                    DELETE FROM products WHERE stock_code LIKE 'TEST_%';
                """)

    # -------------------------------------------------------------------------
    # 1. Database Connection
    # -------------------------------------------------------------------------
    def test_01_database_connection(self):
        """1. Verify successful connection to PostgreSQL 16 server."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
                self.assertIn("PostgreSQL", version)
                cur.execute("SELECT current_database();")
                active_db = cur.fetchone()[0]
                self.assertEqual(active_db, DB_NAME)

    # -------------------------------------------------------------------------
    # 2. Expected Core Tables Exist (7 Core Tables)
    # -------------------------------------------------------------------------
    def test_02_expected_core_tables_exist(self):
        """2. Verify all seven core database tables exist in public schema."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public';
                """)
                existing = {row[0] for row in cur.fetchall()}

        for table in self.CORE_TABLES:
            self.assertIn(
                table,
                existing,
                f"Required core table '{table}' is missing from database '{DB_NAME}'."
            )

    # -------------------------------------------------------------------------
    # 3. Primary and Foreign Key Constraints
    # -------------------------------------------------------------------------
    def test_03_primary_and_foreign_key_constraints(self):
        """3. Verify primary key uniqueness and foreign key integrity constraints."""
        # Non-existent invoice_id in invoice_items raises ForeignKeyViolation
        with self.assertRaises(errors.ForeignKeyViolation):
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO invoice_items (invoice_id, stock_code, quantity, unit_price, line_total)
                        VALUES (99999999, 'TEST_FAKE_SKU', 1, 10.00, 10.00);
                    """)

        # Non-existent stock_code in daily_product_sales raises ForeignKeyViolation
        with self.assertRaises(errors.ForeignKeyViolation):
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO daily_product_sales (stock_code, sale_date, units_sold)
                        VALUES ('NON_EXISTENT_SKU_99999', '2026-11-20', 10);
                    """)

    # -------------------------------------------------------------------------
    # 4. Duplicate Product Prevention
    # -------------------------------------------------------------------------
    def test_04_duplicate_product_prevention(self):
        """4. Verify duplicate product codes are rejected by primary key."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO products (stock_code, product_name, current_stock, unit_price)
                    VALUES ('TEST_DUP_SKU', 'Original Product', 100, 15.00);
                """)

        with self.assertRaises(errors.UniqueViolation):
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO products (stock_code, product_name, current_stock, unit_price)
                        VALUES ('TEST_DUP_SKU', 'Duplicate Product Code', 50, 12.00);
                    """)

    # -------------------------------------------------------------------------
    # 5. Negative Stock Prevention
    # -------------------------------------------------------------------------
    def test_05_negative_stock_prevention(self):
        """5. Verify CHECK (current_stock >= 0) prevents negative inventory."""
        with self.assertRaises(errors.CheckViolation):
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO products (stock_code, product_name, current_stock)
                        VALUES ('TEST_NEG_STOCK', 'Negative Stock Product', -10);
                    """)

    # -------------------------------------------------------------------------
    # 6. Negative Price Prevention
    # -------------------------------------------------------------------------
    def test_06_negative_price_prevention(self):
        """6. Verify CHECK (unit_price >= 0) prevents negative product pricing."""
        with self.assertRaises(errors.CheckViolation):
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO products (stock_code, product_name, unit_price)
                        VALUES ('TEST_NEG_PRICE', 'Negative Price Product', -4.50);
                    """)

    # -------------------------------------------------------------------------
    # 7. Invoice Creation
    # -------------------------------------------------------------------------
    def test_07_invoice_creation(self):
        """7. Verify customer billing invoice is created with valid header fields."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO invoices (invoice_no, customer_name, total_amount, payment_method, status)
                    VALUES ('TEST_INV_HEADER', 'Suresh Kumar', 150.00, 'UPI', 'PAID')
                    RETURNING invoice_id, invoice_no, total_amount, status;
                """)
                row = cur.fetchone()
                self.assertIsNotNone(row)
                self.assertEqual(row[1], 'TEST_INV_HEADER')
                self.assertEqual(float(row[2]), 150.00)
                self.assertEqual(row[3], 'PAID')

    # -------------------------------------------------------------------------
    # 8. Invoice Item Insertion
    # -------------------------------------------------------------------------
    def test_08_invoice_item_insertion(self):
        """8. Verify line items are correctly attached to an invoice with price and totals."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO products (stock_code, product_name, current_stock, unit_price)
                    VALUES ('TEST_ITEM_SKU', 'Test Biscuit Pack', 100, 20.00);
                    
                    INSERT INTO invoices (invoice_no, customer_name, total_amount)
                    VALUES ('TEST_INV_ITEMS', 'Rani Patel', 60.00)
                    RETURNING invoice_id;
                """)
                inv_id = cur.fetchone()[0]

                cur.execute("""
                    INSERT INTO invoice_items (invoice_id, stock_code, quantity, unit_price, line_total)
                    VALUES (%s, 'TEST_ITEM_SKU', 3, 20.00, 60.00)
                    RETURNING invoice_item_id, quantity, line_total;
                """, (inv_id,))
                item_row = cur.fetchone()
                self.assertEqual(item_row[1], 3)
                self.assertEqual(float(item_row[2]), 60.00)

    # -------------------------------------------------------------------------
    # 9. Stock Deduction After Billing
    # -------------------------------------------------------------------------
    def test_09_stock_deduction_after_billing(self):
        """9. Verify product stock is reduced accurately upon completed checkout."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO products (stock_code, product_name, current_stock, unit_price)
                    VALUES ('TEST_DEDUCT_SKU', 'Deduction Item', 50, 10.00);
                """)

        # Process billing of 15 units
        receipt = BillingService.process_checkout(
            items=[CartItem(stock_code="TEST_DEDUCT_SKU", quantity=15)],
            customer_name="Test Customer 9",
            invoice_no="TEST_INV_DEDUCT_09",
        )
        self.assertEqual(receipt.total_amount, Decimal("150.00"))

        # Verify stock decreased from 50 to 35
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_stock FROM products WHERE stock_code = 'TEST_DEDUCT_SKU';")
                remaining_stock = cur.fetchone()[0]
                self.assertEqual(remaining_stock, 35)

    # -------------------------------------------------------------------------
    # 10. Stock Movement Recording
    # -------------------------------------------------------------------------
    def test_10_stock_movement_recording(self):
        """10. Verify immutable stock movement audit ledger is updated after billing."""
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO products (stock_code, product_name, current_stock, unit_price)
                    VALUES ('TEST_MVMT_SKU', 'Audit Movement Item', 40, 5.00);
                """)

        BillingService.process_checkout(
            items=[CartItem(stock_code="TEST_MVMT_SKU", quantity=8)],
            invoice_no="TEST_INV_MVMT_10",
        )

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT stock_code, movement_type, quantity, balance_after, reference_id
                    FROM stock_movements
                    WHERE reference_id = 'TEST_INV_MVMT_10';
                """)
                mvmt = cur.fetchone()
                self.assertIsNotNone(mvmt, "Stock movement record must exist.")
                self.assertEqual(mvmt[0], 'TEST_MVMT_SKU')
                self.assertEqual(mvmt[1], 'SALE')
                self.assertEqual(mvmt[2], -8)          # Deductions are negative quantities
                self.assertEqual(mvmt[3], 32)          # 40 - 8 = 32
                self.assertEqual(mvmt[4], 'TEST_INV_MVMT_10')

    # -------------------------------------------------------------------------
    # 11. Transaction Rollback When Billing Fails (NFR-4)
    # -------------------------------------------------------------------------
    def test_11_transaction_rollback_when_billing_fails(self):
        """
        11. Verify atomic rollback: if an item fails, stock of other items
        must NOT be deducted and no incomplete invoice or movements are saved.
        """
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO products (stock_code, product_name, current_stock, unit_price)
                    VALUES 
                        ('TEST_ROLLBACK_A', 'Rollback Valid Item', 30, 10.00),
                        ('TEST_ROLLBACK_B', 'Rollback Low Stock Item', 2, 25.00);
                """)

        # Attempt checkout where Item A is fine (needs 5, has 30),
        # but Item B fails (needs 10, has only 2)
        cart = [
            CartItem(stock_code="TEST_ROLLBACK_A", quantity=5),
            CartItem(stock_code="TEST_ROLLBACK_B", quantity=10),
        ]

        with self.assertRaises(InsufficientStockError):
            BillingService.process_checkout(
                items=cart,
                invoice_no="TEST_INV_FAIL_11"
            )

        # Verify atomic integrity in database:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Item A stock MUST be untouched (still 30)
                cur.execute("SELECT current_stock FROM products WHERE stock_code = 'TEST_ROLLBACK_A';")
                self.assertEqual(cur.fetchone()[0], 30)

                # 2. Item B stock MUST be untouched (still 2)
                cur.execute("SELECT current_stock FROM products WHERE stock_code = 'TEST_ROLLBACK_B';")
                self.assertEqual(cur.fetchone()[0], 2)

                # 3. Invoice MUST NOT exist
                cur.execute("SELECT COUNT(*) FROM invoices WHERE invoice_no = 'TEST_INV_FAIL_11';")
                self.assertEqual(cur.fetchone()[0], 0)

                # 4. Stock movement MUST NOT exist
                cur.execute("SELECT COUNT(*) FROM stock_movements WHERE reference_id = 'TEST_INV_FAIL_11';")
                self.assertEqual(cur.fetchone()[0], 0)

    # -------------------------------------------------------------------------
    # 12. Prevention of Overselling
    # -------------------------------------------------------------------------
    def test_12_prevention_of_overselling(self):
        """
        12. Verify that concurrent simultaneous checkout attempts cannot
        oversell inventory beyond available physical stock.
        """
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Create item with exactly 10 units in stock
                cur.execute("""
                    INSERT INTO products (stock_code, product_name, current_stock, reserved_stock, unit_price)
                    VALUES ('TEST_OVERSELL_SKU', 'Limited Stock Special Item', 10, 0, 50.00);
                """)

        # Scenario A: Sequential attempt exceeding remaining stock is blocked
        receipt1 = BillingService.process_checkout(
            items=[CartItem(stock_code="TEST_OVERSELL_SKU", quantity=7)],
            invoice_no="TEST_INV_OVER_A1",
        )
        self.assertEqual(receipt1.items[0].quantity, 7)

        # Available is now 3. Trying to buy 4 must be rejected
        with self.assertRaises(InsufficientStockError):
            BillingService.process_checkout(
                items=[CartItem(stock_code="TEST_OVERSELL_SKU", quantity=4)],
                invoice_no="TEST_INV_OVER_A2",
            )

        # Scenario B: Concurrent simultaneous attempt (Race condition test)
        # Reset stock to 10
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE products SET current_stock = 10 WHERE stock_code = 'TEST_OVERSELL_SKU';")

        # Two simultaneous checkout requests each requesting 8 units (total 16 requested for 10 available)
        def buy_8_units(inv_no: str):
            try:
                BillingService.process_checkout(
                    items=[CartItem(stock_code="TEST_OVERSELL_SKU", quantity=8)],
                    invoice_no=inv_no,
                )
                return "SUCCESS"
            except InsufficientStockError:
                return "INSUFFICIENT_STOCK"
            except Exception as e:
                return f"ERROR: {e}"

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future1 = executor.submit(buy_8_units, "TEST_INV_CONCURRENT_1")
            future2 = executor.submit(buy_8_units, "TEST_INV_CONCURRENT_2")
            results = [future1.result(), future2.result()]

        # Exactly ONE must succeed and exactly ONE must fail with INSUFFICIENT_STOCK
        self.assertEqual(results.count("SUCCESS"), 1, f"Expected 1 success, got {results}")
        self.assertEqual(results.count("INSUFFICIENT_STOCK"), 1, f"Expected 1 blocked, got {results}")

        # Final stock in database must be exactly 2 (10 - 8 = 2), NEVER negative!
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_stock FROM products WHERE stock_code = 'TEST_OVERSELL_SKU';")
                final_stock = cur.fetchone()[0]
                self.assertEqual(final_stock, 2, f"Stock oversold! Expected 2, got {final_stock}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
