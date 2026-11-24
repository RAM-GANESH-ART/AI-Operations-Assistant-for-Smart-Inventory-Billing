"""
Products & Inventory Router
Endpoints for browsing the product catalog and viewing live inventory levels.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from connection import get_connection

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class ProductOut(BaseModel):
    stock_code: str
    product_name: str
    unit_price: float
    current_stock: int
    reserved_stock: int
    available_stock: int
    safety_stock: int
    minimum_stock: int
    lead_time_days: int
    is_active: bool
    category: Optional[str] = None


class ProductListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    products: list[ProductOut]


class ProductDetailOut(ProductOut):
    max_capacity: Optional[int] = None
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/products", response_model=ProductListResponse)
def list_products(
    search: Optional[str] = Query(None, description="Search by stock_code or product_name"),
    category: Optional[str] = Query(None, description="Filter by category (e.g. Dairy, Grocery)"),
    low_stock: bool = Query(False, description="Filter only low-stock items"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
):
    """List products with optional search, category filter, low-stock filter, and pagination."""
    offset = (page - 1) * page_size

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Build WHERE clauses
            conditions = ["is_active = TRUE"]
            params: list = []

            if category and category.lower() != 'all':
                conditions.append("category ILIKE %s")
                params.append(category)

            if search:
                conditions.append(
                    "(stock_code ILIKE %s OR product_name ILIKE %s)"
                )
                params.extend([f"%{search}%", f"%{search}%"])

            if low_stock:
                conditions.append(
                    "(current_stock - reserved_stock) <= minimum_stock"
                )

            where_clause = " AND ".join(conditions)

            # Count total matching rows
            cur.execute(f"SELECT COUNT(*) FROM products WHERE {where_clause}", params)
            total = cur.fetchone()[0]

            # Fetch paginated results
            cur.execute(f"""
                SELECT stock_code, product_name, unit_price, current_stock,
                       reserved_stock, (current_stock - reserved_stock) AS available_stock,
                       safety_stock, minimum_stock, lead_time_days, is_active,
                       category
                FROM products
                WHERE {where_clause}
                ORDER BY CASE WHEN category IS NOT NULL THEN 0 ELSE 1 END, stock_code
                LIMIT %s OFFSET %s
            """, params + [page_size, offset])

            rows = cur.fetchall()

    products = [
        ProductOut(
            stock_code=r[0], product_name=r[1], unit_price=float(r[2]),
            current_stock=r[3], reserved_stock=r[4], available_stock=r[5],
            safety_stock=r[6], minimum_stock=r[7], lead_time_days=r[8],
            is_active=r[9], category=r[10],
        )
        for r in rows
    ]

    return ProductListResponse(
        total=total, page=page, page_size=page_size, products=products
    )


@router.get("/products/{stock_code}", response_model=ProductDetailOut)
def get_product(stock_code: str):
    """Get detailed product information and real-time inventory for a single SKU."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT stock_code, product_name, unit_price, current_stock,
                       reserved_stock, (current_stock - reserved_stock) AS available_stock,
                       safety_stock, minimum_stock, lead_time_days, is_active,
                       max_capacity, created_at::text, updated_at::text
                FROM products
                WHERE stock_code = %s
            """, (stock_code,))
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Product '{stock_code}' not found.")

    return ProductDetailOut(
        stock_code=row[0], product_name=row[1], unit_price=float(row[2]),
        current_stock=row[3], reserved_stock=row[4], available_stock=row[5],
        safety_stock=row[6], minimum_stock=row[7], lead_time_days=row[8],
        is_active=row[9], max_capacity=row[10],
        created_at=row[11], updated_at=row[12],
    )
