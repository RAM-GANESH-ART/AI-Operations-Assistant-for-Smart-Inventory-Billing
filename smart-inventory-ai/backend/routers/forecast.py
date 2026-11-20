"""
Demand Forecasting Router
Serves 7-day demand predictions from the trained Random Forest model.
Falls back to Level 0 Global Training Mean (18.3150) for unknown products.
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from connection import get_connection

router = APIRouter()

# Level 0 fallback constant (from Notebook 02 training mean)
LEVEL_0_FALLBACK = 18.3150


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class ForecastResponse(BaseModel):
    stock_code: str
    product_name: str
    predicted_demand_7day: float
    model_version: str
    is_fallback: bool
    fallback_reason: Optional[str] = None
    average_daily_demand: float
    unit_price: float
    current_stock: int
    available_stock: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/forecast/{stock_code}", response_model=ForecastResponse)
def get_forecast(stock_code: str):
    """
    Get the 7-day demand forecast for a single product.

    Uses the loaded Random Forest model (RF-DEPTH-10) if available.
    Falls back to Level 0 Training Mean (18.3150) if model is unavailable
    or the product has insufficient history for feature generation.
    """
    # Import here to avoid circular import at module level
    from main import ml_model

    # Validate product exists
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT stock_code, product_name, unit_price, current_stock, reserved_stock
                FROM products
                WHERE stock_code = %s
            """, (stock_code,))
            product = cur.fetchone()

    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{stock_code}' not found.")

    p_code, p_name, p_price, p_stock, p_reserved = product
    available = p_stock - p_reserved

    # Attempt ML prediction
    predicted = None
    is_fallback = True
    fallback_reason = None
    model_version = "RF-DEPTH-10"

    if "model" in ml_model:
        try:
            features = _build_features(stock_code, ml_model["features"])
            if features is not None:
                import numpy as np
                feature_array = np.array([features])
                predicted = float(ml_model["model"].predict(feature_array)[0])
                predicted = max(0.0, predicted)  # demand cannot be negative
                is_fallback = False
            else:
                fallback_reason = "Insufficient sales history for feature generation."
        except Exception as e:
            fallback_reason = f"Model prediction error: {str(e)}"
    else:
        fallback_reason = "ML model not loaded. Using Level 0 Training Mean."

    if is_fallback:
        predicted = LEVEL_0_FALLBACK
        model_version = "Level-0-Fallback"

    avg_daily = round(predicted / 7.0, 4)

    return ForecastResponse(
        stock_code=p_code,
        product_name=p_name,
        predicted_demand_7day=round(predicted, 4),
        model_version=model_version,
        is_fallback=is_fallback,
        fallback_reason=fallback_reason,
        average_daily_demand=avg_daily,
        unit_price=float(p_price),
        current_stock=p_stock,
        available_stock=available,
    )


def _build_features(stock_code: str, feature_columns: list) -> Optional[list]:
    """
    Build the feature vector for a product from its recent sales history.
    Returns None if insufficient history exists.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Get the most recent 30 days of sales for this product
            cur.execute("""
                SELECT sale_date, units_sold
                FROM daily_product_sales
                WHERE stock_code = %s
                ORDER BY sale_date DESC
                LIMIT 30
            """, (stock_code,))
            rows = cur.fetchall()

    if len(rows) < 7:
        return None  # Not enough history for lag/rolling features

    # Sort chronologically
    rows.sort(key=lambda r: r[0])
    sales = [r[1] for r in rows]
    last_date = rows[-1][0]

    # Build features matching the model's expected columns
    import numpy as np

    lag_1 = sales[-1] if len(sales) >= 1 else 0
    lag_7 = sales[-7] if len(sales) >= 7 else 0
    lag_30 = sales[-30] if len(sales) >= 30 else sales[0]

    rolling_7 = float(np.mean(sales[-7:])) if len(sales) >= 7 else float(np.mean(sales))
    rolling_30 = float(np.mean(sales[-30:])) if len(sales) >= 30 else float(np.mean(sales))
    historical_mean = float(np.mean(sales))

    day_of_week = last_date.weekday()
    month = last_date.month
    year = last_date.year

    # Get average unit price
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT unit_price FROM products WHERE stock_code = %s",
                (stock_code,),
            )
            price_row = cur.fetchone()
    avg_unit_price = float(price_row[0]) if price_row else 0.0

    # Map features to the expected column order
    feature_map = {
        "Lag_1": lag_1,
        "Lag_7": lag_7,
        "Lag_30": lag_30,
        "RollingMean_7": rolling_7,
        "RollingMean_30": rolling_30,
        "HistoricalMean": historical_mean,
        "DayOfWeek": day_of_week,
        "Month": month,
        "Year": year,
        "AvgUnitPrice": avg_unit_price,
    }

    try:
        return [feature_map[col] for col in feature_columns]
    except KeyError:
        return None
