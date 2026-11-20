"""
Dashboard Summary Router
Provides store-level metrics and alerts for the management dashboard.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from connection import get_connection

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class DashboardSummary(BaseModel):
    total_products: int
    active_products: int
    out_of_stock_count: int
    critical_stock_count: int
    low_stock_count: int
    healthy_stock_count: int
    total_inventory_units: int
    total_inventory_value: float
    total_invoices: int
    total_revenue: float
    daily_sales_records: int
    model_loaded: bool


class TopAlert(BaseModel):
    stock_code: str
    product_name: str
    available_stock: int
    minimum_stock: int
    safety_stock: int
    alert_level: str


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    top_alerts: list[TopAlert]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/dashboard/summary", response_model=DashboardResponse)
def get_dashboard_summary():
    """
    Returns store-level metrics:
    - Total products, active products, stock health distribution
    - Total inventory units and valuation
    - Total invoices and revenue
    - Top low-stock / out-of-stock alerts
    """
    from main import ml_model

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Product counts
            cur.execute("SELECT COUNT(*) FROM products;")
            total_products = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM products WHERE is_active = TRUE;")
            active_products = cur.fetchone()[0]

            # Stock health distribution
            cur.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE (current_stock - reserved_stock) <= 0) AS out_of_stock,
                    COUNT(*) FILTER (WHERE (current_stock - reserved_stock) > 0
                                     AND (current_stock - reserved_stock) <= minimum_stock) AS critical,
                    COUNT(*) FILTER (WHERE (current_stock - reserved_stock) > minimum_stock
                                     AND (current_stock - reserved_stock) <= safety_stock + minimum_stock) AS low_stock,
                    COUNT(*) FILTER (WHERE (current_stock - reserved_stock) > safety_stock + minimum_stock) AS healthy
                FROM products
                WHERE is_active = TRUE;
            """)
            health = cur.fetchone()
            out_of_stock = health[0]
            critical = health[1]
            low_stock = health[2]
            healthy = health[3]

            # Inventory totals
            cur.execute("""
                SELECT
                    COALESCE(SUM(current_stock), 0) AS total_units,
                    COALESCE(SUM(current_stock * unit_price), 0) AS total_value
                FROM products WHERE is_active = TRUE;
            """)
            inv = cur.fetchone()
            total_units = inv[0]
            total_value = float(inv[1])

            # Invoice and revenue totals
            cur.execute("""
                SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
                FROM invoices WHERE status = 'PAID';
            """)
            billing = cur.fetchone()
            total_invoices = billing[0]
            total_revenue = float(billing[1])

            # Daily sales records count
            cur.execute("SELECT COUNT(*) FROM daily_product_sales;")
            daily_sales_records = cur.fetchone()[0]

            # Top alerts: products with lowest available stock
            cur.execute("""
                SELECT stock_code, product_name,
                       (current_stock - reserved_stock) AS available_stock,
                       minimum_stock, safety_stock
                FROM products
                WHERE is_active = TRUE
                  AND (current_stock - reserved_stock) <= minimum_stock
                ORDER BY (current_stock - reserved_stock) ASC
                LIMIT 10;
            """)
            alert_rows = cur.fetchall()

    top_alerts = []
    for a in alert_rows:
        avail = a[2]
        level = "OUT_OF_STOCK" if avail <= 0 else "CRITICAL"
        top_alerts.append(TopAlert(
            stock_code=a[0], product_name=a[1],
            available_stock=avail, minimum_stock=a[3],
            safety_stock=a[4], alert_level=level,
        ))

    summary = DashboardSummary(
        total_products=total_products,
        active_products=active_products,
        out_of_stock_count=out_of_stock,
        critical_stock_count=critical,
        low_stock_count=low_stock,
        healthy_stock_count=healthy,
        total_inventory_units=total_units,
        total_inventory_value=total_value,
        total_invoices=total_invoices,
        total_revenue=total_revenue,
        daily_sales_records=daily_sales_records,
        model_loaded="model" in ml_model,
    )

    return DashboardResponse(summary=summary, top_alerts=top_alerts)
