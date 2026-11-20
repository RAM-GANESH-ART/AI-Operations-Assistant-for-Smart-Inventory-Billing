"""
Billing and Inventory Integration Service
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project

Implements Phase 7 Section 4 requirements:
- Product checkout workflow
- Real-time available stock validation
- Row-level locking to prevent concurrent overselling (SELECT ... FOR UPDATE)
- Atomic transactional billing with rollback on failure (NFR-4)
- Automated stock deduction and immutable stock movement logging
"""

import sys
import uuid
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Optional, Tuple

SERVICES_DIR = Path(__file__).resolve().parent
DB_DIR = SERVICES_DIR.parent / "database"

if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from connection import get_connection


class InsufficientStockError(Exception):
    """Raised when requested quantity exceeds available stock."""
    pass


class ProductNotFoundError(Exception):
    """Raised when a product does not exist in the catalog."""
    pass


@dataclass
class CartItem:
    """An item in the customer's purchase request."""
    stock_code: str
    quantity: int


@dataclass
class InvoiceItemRecord:
    stock_code: str
    product_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


@dataclass
class InvoiceReceipt:
    invoice_id: int
    invoice_no: str
    customer_name: str
    payment_method: str
    total_amount: Decimal
    items: List[InvoiceItemRecord]


class BillingService:
    """
    Manages point-of-sale billing transactions integrated with real-time inventory.
    Guarantees ACID transaction safety and concurrency protection via row locks.
    """

    @staticmethod
    def process_checkout(
        items: List[CartItem],
        customer_name: str = "Walk-in Customer",
        customer_phone: Optional[str] = None,
        payment_method: str = "CASH",
        created_by_user_id: Optional[int] = None,
        invoice_no: Optional[str] = None,
    ) -> InvoiceReceipt:
        """
        Execute atomic checkout for a list of items:
        1. Validates inputs.
        2. Acquires row-level locks on requested products (SELECT ... FOR UPDATE).
        3. Validates available stock for all items (Available = Current - Reserved).
        4. Calculates bill totals.
        5. Saves invoice and invoice items.
        6. Reduces product stock (current_stock = current_stock - quantity).
        7. Logs immutable stock movements (movement_type = 'SALE').
        8. Commits transaction; or rolls back completely if any step fails.
        """
        if not items:
            raise ValueError("Cannot process checkout with an empty cart.")

        for item in items:
            if item.quantity <= 0:
                raise ValueError(
                    f"Quantity for {item.stock_code} must be > 0, got {item.quantity}."
                )

        generated_invoice_no = invoice_no or f"INV-{uuid.uuid4().hex[:10].upper()}"

        # Consolidate duplicate items in the cart if any
        aggregated_quantities: Dict[str, int] = {}
        for it in items:
            code = it.stock_code.strip()
            aggregated_quantities[code] = aggregated_quantities.get(code, 0) + it.quantity

        # Open transactional connection
        with get_connection() as conn:
            with conn.cursor() as cur:
                # -------------------------------------------------------------
                # 1. Acquire row-level locks in deterministic order (prevents deadlocks)
                # -------------------------------------------------------------
                sorted_codes = sorted(aggregated_quantities.keys())
                cur.execute("""
                    SELECT 
                        stock_code, product_name, unit_price, current_stock, reserved_stock
                    FROM products
                    WHERE stock_code = ANY(%s)
                    FOR UPDATE;
                """, (sorted_codes,))

                locked_products = {row[0]: row for row in cur.fetchall()}

                # Verify all products exist
                for code in sorted_codes:
                    if code not in locked_products:
                        raise ProductNotFoundError(f"Product '{code}' not found in catalog.")

                # -------------------------------------------------------------
                # 2. Check stock availability for all items before any writes
                # -------------------------------------------------------------
                item_records: List[InvoiceItemRecord] = []
                total_amount = Decimal("0.00")

                for code in sorted_codes:
                    _, name, unit_price, current_stock, reserved_stock = locked_products[code]
                    requested_qty = aggregated_quantities[code]
                    available_stock = current_stock - reserved_stock

                    # Prevent overselling
                    if requested_qty > available_stock:
                        raise InsufficientStockError(
                            f"Insufficient stock for product '{code}' ({name}). "
                            f"Requested: {requested_qty}, Available: {available_stock} "
                            f"(Current: {current_stock}, Reserved: {reserved_stock})."
                        )

                    price_dec = Decimal(str(unit_price))
                    line_total = price_dec * Decimal(str(requested_qty))
                    total_amount += line_total

                    item_records.append(
                        InvoiceItemRecord(
                            stock_code=code,
                            product_name=name,
                            quantity=requested_qty,
                            unit_price=price_dec,
                            line_total=line_total,
                        )
                    )

                # -------------------------------------------------------------
                # 3. Insert Invoice
                # -------------------------------------------------------------
                cur.execute("""
                    INSERT INTO invoices (
                        invoice_no, customer_name, customer_phone,
                        total_amount, payment_method, status, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING invoice_id;
                """, (
                    generated_invoice_no,
                    customer_name,
                    customer_phone,
                    float(total_amount),
                    payment_method,
                    "PAID",
                    created_by_user_id,
                ))
                invoice_id = cur.fetchone()[0]

                # -------------------------------------------------------------
                # 4. Insert Invoice Items, Deduct Stock, and Record Stock Movements
                # -------------------------------------------------------------
                for rec in item_records:
                    # Insert line item
                    cur.execute("""
                        INSERT INTO invoice_items (
                            invoice_id, stock_code, quantity, unit_price, line_total
                        ) VALUES (%s, %s, %s, %s, %s);
                    """, (
                        invoice_id,
                        rec.stock_code,
                        rec.quantity,
                        float(rec.unit_price),
                        float(rec.line_total),
                    ))

                    # Deduct physical stock
                    cur.execute("""
                        UPDATE products
                        SET 
                            current_stock = current_stock - %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE stock_code = %s
                        RETURNING current_stock;
                    """, (rec.quantity, rec.stock_code))
                    balance_after = cur.fetchone()[0]

                    # Record immutable audit log in stock_movements
                    cur.execute("""
                        INSERT INTO stock_movements (
                            stock_code, movement_type, quantity, balance_after, reference_id, notes
                        ) VALUES (%s, %s, %s, %s, %s, %s);
                    """, (
                        rec.stock_code,
                        "SALE",
                        -rec.quantity,
                        balance_after,
                        generated_invoice_no,
                        f"POS Sale to {customer_name}",
                    ))

        return InvoiceReceipt(
            invoice_id=invoice_id,
            invoice_no=generated_invoice_no,
            customer_name=customer_name,
            payment_method=payment_method,
            total_amount=total_amount,
            items=item_records,
        )
