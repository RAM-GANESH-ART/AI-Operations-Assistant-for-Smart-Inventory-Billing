"""
Reorder Recommendations Router
Returns inventory reorder recommendations powered by the reorder engine.
"""

from typing import Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel

from connection import get_connection
from reorder_engine import (
    ProductInventoryItem,
    ReorderRecommendationEngine,
    StockStatus,
)

router = APIRouter()

# Shared engine instance
_engine = ReorderRecommendationEngine(default_lead_time_days=3)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class ReorderItemOut(BaseModel):
    stock_code: str
    product_name: str
    current_stock: int
    reserved_stock: int
    available_stock: int
    safety_stock: int
    lead_time_days: int
    predicted_7day_demand: float
    reorder_point: float
    recommended_reorder_qty: int
    final_order_quantity: int
    stock_status: str
    explanation: str
    is_fallback: bool
    fallback_reason: Optional[str] = None


class ReorderListResponse(BaseModel):
    total: int
    items: list[ReorderItemOut]
    summary: dict


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/reorder-recommendations", response_model=ReorderListResponse)
def get_reorder_recommendations(
    status_filter: Optional[str] = Query(
        None,
        description="Filter by stock status: OUT_OF_STOCK, CRITICAL, REORDER_REQUIRED, HEALTHY, OVERSTOCKED",
    ),
    limit: int = Query(100, ge=1, le=500, description="Max items to return"),
):
    """
    Compute reorder recommendations for active products.
    Uses the loaded ML model for predictions when available, otherwise Level 0 fallback.
    """
    from main import ml_model

    # Fetch active products with stock data
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT stock_code, product_name, current_stock, minimum_stock,
                       safety_stock, reserved_stock, unit_price, lead_time_days,
                       max_capacity
                FROM products
                WHERE is_active = TRUE
                ORDER BY (current_stock - reserved_stock) ASC
                LIMIT %s
            """, (limit,))
            rows = cur.fetchall()

    recommendations = []
    status_counts = {s.value: 0 for s in StockStatus}

    for row in rows:
        item = ProductInventoryItem(
            stock_code=row[0],
            product_name=row[1],
            current_stock=row[2],
            minimum_stock=row[3],
            safety_stock=row[4],
            reserved_stock=row[5],
            unit_price=float(row[6]),
            lead_time_days=row[7],
            max_capacity=row[8],
        )

        # Get prediction from ML model if available
        predicted = None
        if "model" in ml_model:
            try:
                from routers.forecast import _build_features
                features = _build_features(item.stock_code, ml_model["features"])
                if features is not None:
                    import numpy as np
                    predicted = float(ml_model["model"].predict(np.array([features]))[0])
                    predicted = max(0.0, predicted)
            except Exception:
                predicted = None

        rec = _engine.evaluate(item, predicted_7day_demand=predicted)
        status_counts[rec.stock_status.value] += 1

        # Apply status filter
        if status_filter and rec.stock_status.value != status_filter.upper():
            continue

        recommendations.append(
            ReorderItemOut(
                stock_code=rec.stock_code,
                product_name=rec.product_name,
                current_stock=rec.current_stock,
                reserved_stock=rec.reserved_stock,
                available_stock=rec.available_stock,
                safety_stock=rec.safety_stock,
                lead_time_days=rec.lead_time_days,
                predicted_7day_demand=rec.predicted_7day_demand,
                reorder_point=rec.reorder_point,
                recommended_reorder_qty=rec.recommended_reorder_qty,
                final_order_quantity=rec.final_order_quantity,
                stock_status=rec.stock_status.value,
                explanation=rec.explanation,
                is_fallback=rec.is_fallback,
                fallback_reason=rec.fallback_reason,
            )
        )

    return ReorderListResponse(
        total=len(recommendations),
        items=recommendations,
        summary=status_counts,
    )
