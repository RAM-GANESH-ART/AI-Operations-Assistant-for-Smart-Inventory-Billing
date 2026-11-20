"""
Billing & Checkout Router
Point-of-sale checkout endpoints with transactional inventory integration.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from connection import get_connection
from billing_service import (
    BillingService,
    CartItem,
    InsufficientStockError,
    ProductNotFoundError,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class CheckoutItemRequest(BaseModel):
    stock_code: str = Field(..., description="Product SKU code")
    quantity: int = Field(..., gt=0, description="Number of units to purchase")


class CheckoutRequest(BaseModel):
    items: list[CheckoutItemRequest] = Field(..., min_length=1)
    customer_name: str = Field(default="Walk-in Customer")
    customer_phone: Optional[str] = None
    payment_method: str = Field(
        default="CASH",
        pattern="^(CASH|CARD|UPI|CREDIT)$",
        description="Payment method: CASH, CARD, UPI, or CREDIT",
    )


class InvoiceItemOut(BaseModel):
    stock_code: str
    product_name: str
    quantity: int
    unit_price: float
    line_total: float


class InvoiceReceiptOut(BaseModel):
    invoice_id: int
    invoice_no: str
    customer_name: str
    payment_method: str
    total_amount: float
    items: list[InvoiceItemOut]


class InvoiceListResponse(BaseModel):
    total: int
    invoices: list[dict]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/billing/checkout", response_model=InvoiceReceiptOut, status_code=201)
def process_checkout(request: CheckoutRequest):
    """
    Process a point-of-sale customer checkout.

    Atomically validates stock, creates the invoice, deducts inventory,
    and records stock movements. Rolls back completely on failure.
    Uses row-level locks (SELECT FOR UPDATE) to prevent overselling.
    """
    cart_items = [
        CartItem(stock_code=item.stock_code, quantity=item.quantity)
        for item in request.items
    ]

    try:
        receipt = BillingService.process_checkout(
            items=cart_items,
            customer_name=request.customer_name,
            customer_phone=request.customer_phone,
            payment_method=request.payment_method,
        )
    except InsufficientStockError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ProductNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return InvoiceReceiptOut(
        invoice_id=receipt.invoice_id,
        invoice_no=receipt.invoice_no,
        customer_name=receipt.customer_name,
        payment_method=receipt.payment_method,
        total_amount=float(receipt.total_amount),
        items=[
            InvoiceItemOut(
                stock_code=it.stock_code,
                product_name=it.product_name,
                quantity=it.quantity,
                unit_price=float(it.unit_price),
                line_total=float(it.line_total),
            )
            for it in receipt.items
        ],
    )


@router.get("/invoices/{invoice_no}")
def get_invoice(invoice_no: str):
    """Retrieve an invoice receipt by its invoice number."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT invoice_id, invoice_no, invoice_date::text,
                       customer_name, customer_phone, total_amount,
                       payment_method, status
                FROM invoices
                WHERE invoice_no = %s
            """, (invoice_no,))
            inv = cur.fetchone()

            if not inv:
                raise HTTPException(
                    status_code=404, detail=f"Invoice '{invoice_no}' not found."
                )

            cur.execute("""
                SELECT ii.stock_code, p.product_name, ii.quantity,
                       ii.unit_price, ii.line_total
                FROM invoice_items ii
                JOIN products p ON ii.stock_code = p.stock_code
                WHERE ii.invoice_id = %s
            """, (inv[0],))
            items = cur.fetchall()

    return {
        "invoice_id": inv[0],
        "invoice_no": inv[1],
        "invoice_date": inv[2],
        "customer_name": inv[3],
        "customer_phone": inv[4],
        "total_amount": float(inv[5]),
        "payment_method": inv[6],
        "status": inv[7],
        "items": [
            {
                "stock_code": it[0],
                "product_name": it[1],
                "quantity": it[2],
                "unit_price": float(it[3]),
                "line_total": float(it[4]),
            }
            for it in items
        ],
    }


@router.get("/invoices", response_model=InvoiceListResponse)
def list_invoices(
    limit: int = 20,
    status: Optional[str] = None,
):
    """List recent invoices with optional status filter."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            if status:
                cur.execute("""
                    SELECT invoice_id, invoice_no, invoice_date::text,
                           customer_name, total_amount, payment_method, status
                    FROM invoices
                    WHERE status = %s
                    ORDER BY invoice_date DESC
                    LIMIT %s
                """, (status.upper(), limit))
            else:
                cur.execute("""
                    SELECT invoice_id, invoice_no, invoice_date::text,
                           customer_name, total_amount, payment_method, status
                    FROM invoices
                    ORDER BY invoice_date DESC
                    LIMIT %s
                """, (limit,))
            rows = cur.fetchall()

    invoices = [
        {
            "invoice_id": r[0],
            "invoice_no": r[1],
            "invoice_date": r[2],
            "customer_name": r[3],
            "total_amount": float(r[4]),
            "payment_method": r[5],
            "status": r[6],
        }
        for r in rows
    ]

    return InvoiceListResponse(total=len(invoices), invoices=invoices)
