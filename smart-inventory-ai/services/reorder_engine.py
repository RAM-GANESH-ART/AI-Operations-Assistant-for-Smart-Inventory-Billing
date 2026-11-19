"""
Phase 6: Inventory Logic and Reorder Recommendation Engine
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project

Implements SRS requirements:
- FR-2.2: Seven-day demand prediction and reorder quantity calculation
- FR-2.3: Prediction presentation (demand, stock, safety stock, recommendation)
- FR-2.4: Level 0 baseline fallback when ML model is unavailable
- FR-2.5: Shop owner manual override support

Fallback prediction source:
  The Level 0 fallback constant (LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY = 18.3150) is the
  mean of Future7DayDemand computed from the training set in Notebook 02 (Cell 16 output:
  "Training mean: 18.3150"). It is the value every row receives as a Level 0 prediction.
  It is NOT the Level 0 Test MAE (39.10), which is an error metric, not a forecast.

Reorder quantity formula (from SRS):
  SuggestedOrderQty = max(0, PredictedDemand7Day + SafetyStock - AvailableStock)

This differs from the reorder point, which is used only for status classification:
  ReorderPoint      = AvgDailyDemand * LeadTimeDays + SafetyStock
  LeadTimeDemand    = AvgDailyDemand * LeadTimeDays

The seven-day replenishment quantity answers "how much should I order NOW to cover
the upcoming week and restore the safety buffer?" The reorder point answers "at what
available-stock level should I trigger a replenishment check?"
"""

import math
from dataclasses import dataclass
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Level 0 fallback constant
# ---------------------------------------------------------------------------
# Source: Notebook 02, Cell 16 executed output:
#   "Training mean: 18.3150"
# This is the mean of Future7DayDemand in the training set (2010-12-01 to 2011-09-19).
# It is applied as the fallback predicted demand when the ML model is unavailable.
# It is NOT the Level 0 Test MAE (39.10), which measures prediction error.
LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY: float = 18.3150


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class StockStatus(str, Enum):
    OUT_OF_STOCK = "OUT_OF_STOCK"
    CRITICAL = "CRITICAL"
    REORDER_REQUIRED = "REORDER_REQUIRED"
    HEALTHY = "HEALTHY"
    OVERSTOCKED = "OVERSTOCKED"


# ---------------------------------------------------------------------------
# Input validation helpers
# ---------------------------------------------------------------------------

def _require_non_negative_int(value: int, name: str) -> int:
    """Raise TypeError or ValueError if value is not a non-negative integer (rejects bool)."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{name} must be an integer, got {type(value).__name__}.")
    if value < 0:
        raise ValueError(f"{name} must be >= 0, got {value}.")
    return value


def _require_positive_int(value: int, name: str) -> int:
    """Raise TypeError or ValueError if value is not a positive integer (rejects bool)."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{name} must be an integer, got {type(value).__name__}.")
    if value <= 0:
        raise ValueError(f"{name} must be > 0, got {value}.")
    return value


def _require_non_negative_float(value: float, name: str) -> float:
    """Raise TypeError or ValueError if value is not a finite non-negative float (rejects bool)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{name} must be numeric, got {type(value).__name__}.")
    if math.isnan(value) or math.isinf(value):
        raise ValueError(f"{name} must be a finite number, got {value}.")
    if value < 0:
        raise ValueError(f"{name} must be >= 0, got {value}.")
    return float(value)


def _is_valid_prediction(value: Optional[float]) -> bool:
    """Return True when value is a finite, non-negative number usable as a demand forecast."""
    if value is None or isinstance(value, bool):
        return False
    if not isinstance(value, (int, float)):
        return False
    return math.isfinite(value) and value >= 0


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ProductInventoryItem:
    """
    Represents the current inventory state of a single SKU.

    Parameters
    ----------
    stock_code : str
        Unique product identifier (matches the StockCode in the ML pipeline).
    product_name : str
        Human-readable product name.
    current_stock : int >= 0
        Total units physically in the store/warehouse (before reserved deduction).
    minimum_stock : int >= 0
        Operational minimum threshold below which stock is classified as CRITICAL.
    safety_stock : int >= 0
        Buffer units held to absorb demand variability during the supplier lead time.
    reserved_stock : int >= 0
        Units already committed to open/pending orders; must not exceed current_stock.
    unit_price : float >= 0
        Unit selling price (optional; used for display / audit only).
    lead_time_days : int >= 1 or None
        Supplier delivery lead time in days. When None (unspecified), the recommendation
        engine applies its configured default_lead_time_days.
    max_capacity : int > 0 or None
        Storage capacity; triggers OVERSTOCKED when available_stock exceeds this.
    """
    stock_code: str
    product_name: str
    current_stock: int
    minimum_stock: int
    safety_stock: int
    reserved_stock: int = 0
    unit_price: float = 0.0
    lead_time_days: Optional[int] = None
    max_capacity: Optional[int] = None

    def __post_init__(self) -> None:
        _require_non_negative_int(self.current_stock, "current_stock")
        _require_non_negative_int(self.minimum_stock, "minimum_stock")
        _require_non_negative_int(self.safety_stock, "safety_stock")
        _require_non_negative_int(self.reserved_stock, "reserved_stock")
        if self.lead_time_days is not None:
            _require_positive_int(self.lead_time_days, "lead_time_days")
        _require_non_negative_float(self.unit_price, "unit_price")
        if self.reserved_stock > self.current_stock:
            raise ValueError(
                f"reserved_stock ({self.reserved_stock}) cannot exceed "
                f"current_stock ({self.current_stock})."
            )
        if self.max_capacity is not None:
            _require_positive_int(self.max_capacity, "max_capacity")

    @property
    def available_stock(self) -> int:
        """
        Task 6.1.1: AvailableStock = CurrentStock - ReservedStock.

        The result is always >= 0; it cannot be negative because __post_init__
        already enforces reserved_stock <= current_stock.
        """
        return self.current_stock - self.reserved_stock


@dataclass
class ReorderRecommendation:
    """
    Encapsulates the full reorder recommendation for a single SKU.

    Key formulas
    ------------
    lead_time_demand      = avg_daily_demand * lead_time_days
    reorder_point         = lead_time_demand + safety_stock
    recommended_reorder_qty = ceil(max(0, predicted_7day_demand + safety_stock - available_stock))

    final_order_quantity  = owner_override_qty (if set) else recommended_reorder_qty
    """
    stock_code: str
    product_name: str
    current_stock: int
    reserved_stock: int
    available_stock: int
    minimum_stock: int
    safety_stock: int
    lead_time_days: int
    predicted_7day_demand: float
    average_daily_demand: float
    lead_time_demand: float
    reorder_point: float
    recommended_reorder_qty: int
    stock_status: StockStatus
    explanation: str
    is_fallback: bool = False
    fallback_reason: Optional[str] = None
    owner_override_qty: Optional[int] = None

    def __post_init__(self) -> None:
        if self.owner_override_qty is not None:
            if isinstance(self.owner_override_qty, bool) or not isinstance(self.owner_override_qty, int):
                raise TypeError("owner_override_qty must be an integer.")
            if self.owner_override_qty < 0:
                raise ValueError(
                    f"owner_override_qty must be >= 0, got {self.owner_override_qty}."
                )

    @property
    def final_order_quantity(self) -> int:
        """
        FR-2.5: Allows shop owner to override recommended quantity.
        Defaults to recommended_reorder_qty when no override is set.
        """
        if self.owner_override_qty is not None:
            return self.owner_override_qty
        return self.recommended_reorder_qty


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class ReorderRecommendationEngine:
    """
    Computes reorder points, stock statuses and suggested purchase quantities.

    Parameters
    ----------
    default_lead_time_days : int >= 1
        Fallback lead-time used when ProductInventoryItem.lead_time_days is not
        explicitly set by the caller (i.e. is None).
    overstocked_demand_multiple : float > 1
        When no max_capacity is configured, stock is classified as OVERSTOCKED
        if available_stock > predicted_demand * overstocked_demand_multiple + safety_stock.
        Default is 3.0 (three times projected weekly demand).
    """

    def __init__(
        self,
        default_lead_time_days: int = 3,
        overstocked_demand_multiple: float = 3.0,
    ) -> None:
        _require_positive_int(default_lead_time_days, "default_lead_time_days")
        if (
            isinstance(overstocked_demand_multiple, bool)
            or not isinstance(overstocked_demand_multiple, (int, float))
            or not math.isfinite(overstocked_demand_multiple)
            or overstocked_demand_multiple <= 1.0
        ):
            raise ValueError("overstocked_demand_multiple must be a finite number > 1.")
        self.default_lead_time_days = default_lead_time_days
        self.overstocked_demand_multiple = float(overstocked_demand_multiple)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def evaluate(
        self,
        item: ProductInventoryItem,
        predicted_7day_demand: Optional[float] = None,
        owner_override: Optional[int] = None,
    ) -> ReorderRecommendation:
        """
        Compute a ReorderRecommendation for one SKU.

        Parameters
        ----------
        item : ProductInventoryItem
            Current inventory state.
        predicted_7day_demand : float or None
            ML model forecast for the upcoming seven days.  When None, NaN, ±inf,
            or negative the engine applies the Level 0 fallback (FR-2.4).
        owner_override : int >= 0 or None
            Manual quantity entered by the shop owner (FR-2.5).

        Returns
        -------
        ReorderRecommendation
        """
        # Validate owner_override early to give a clear error before computing anything.
        if owner_override is not None:
            if isinstance(owner_override, bool) or not isinstance(owner_override, int):
                raise TypeError("owner_override must be an integer.")
            if owner_override < 0:
                raise ValueError(f"owner_override must be >= 0, got {owner_override}.")

        # FR-2.4: Select prediction or apply fallback
        is_fallback, fallback_reason, predicted_demand = self._resolve_demand(
            predicted_7day_demand
        )

        # Resolve effective lead time:
        # Use item's configured lead_time_days if provided; otherwise fall back to engine default.
        effective_lead_time = (
            item.lead_time_days
            if item.lead_time_days is not None
            else self.default_lead_time_days
        )

        # Compute derived metrics
        avg_daily_demand = predicted_demand / 7.0
        lead_time_demand = avg_daily_demand * effective_lead_time
        reorder_point = lead_time_demand + item.safety_stock

        # SRS reorder formula: max(0, Demand7Day + SafetyStock - AvailableStock)
        raw_qty = predicted_demand + item.safety_stock - item.available_stock
        recommended_reorder_qty = int(math.ceil(max(0.0, raw_qty)))

        # Stock status classification
        status = self._classify_status(
            item=item,
            predicted_demand=predicted_demand,
            reorder_point=reorder_point,
        )

        explanation = self._generate_explanation(
            item=item,
            predicted_demand=predicted_demand,
            reorder_point=reorder_point,
            recommended_qty=recommended_reorder_qty,
            status=status,
            is_fallback=is_fallback,
        )

        return ReorderRecommendation(
            stock_code=item.stock_code,
            product_name=item.product_name,
            current_stock=item.current_stock,
            reserved_stock=item.reserved_stock,
            available_stock=item.available_stock,
            minimum_stock=item.minimum_stock,
            safety_stock=item.safety_stock,
            lead_time_days=effective_lead_time,
            predicted_7day_demand=round(predicted_demand, 4),
            average_daily_demand=round(avg_daily_demand, 4),
            lead_time_demand=round(lead_time_demand, 4),
            reorder_point=round(reorder_point, 4),
            recommended_reorder_qty=recommended_reorder_qty,
            stock_status=status,
            explanation=explanation,
            is_fallback=is_fallback,
            fallback_reason=fallback_reason,
            owner_override_qty=owner_override,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _resolve_demand(
        self, predicted_7day_demand: Optional[float]
    ) -> tuple[bool, Optional[str], float]:
        """
        Return (is_fallback, fallback_reason, resolved_demand).
        Applies FR-2.4 when the prediction is None, NaN, ±inf, negative, or boolean.
        """
        if _is_valid_prediction(predicted_7day_demand):
            return False, None, float(predicted_7day_demand)  # type: ignore[arg-type]

        # Determine specific fallback reason
        if predicted_7day_demand is None:
            reason = (
                "No model prediction supplied (new or unseen product). "
                "Applied Level 0 Global Training Mean as fallback."
            )
        elif isinstance(predicted_7day_demand, bool):
            reason = (
                "Boolean value supplied as prediction. "
                "Applied Level 0 Global Training Mean as fallback."
            )
        elif isinstance(predicted_7day_demand, float) and math.isnan(predicted_7day_demand):
            reason = (
                "Model returned NaN. "
                "Applied Level 0 Global Training Mean as fallback."
            )
        elif isinstance(predicted_7day_demand, float) and math.isinf(predicted_7day_demand):
            reason = (
                "Model returned infinity. "
                "Applied Level 0 Global Training Mean as fallback."
            )
        elif isinstance(predicted_7day_demand, (int, float)) and predicted_7day_demand < 0:
            reason = (
                f"Model returned a negative demand ({predicted_7day_demand}). "
                "Demand cannot be negative. Applied Level 0 Global Training Mean as fallback."
            )
        else:
            reason = "Invalid prediction type. Applied Level 0 Global Training Mean as fallback."

        return True, reason, LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY

    def _classify_status(
        self,
        item: ProductInventoryItem,
        predicted_demand: float,
        reorder_point: float,
    ) -> StockStatus:
        """Classify stock status using non-overlapping thresholds."""
        if item.available_stock <= 0:
            return StockStatus.OUT_OF_STOCK

        if item.available_stock <= item.minimum_stock:
            return StockStatus.CRITICAL

        if item.available_stock <= reorder_point:
            return StockStatus.REORDER_REQUIRED

        if item.max_capacity is not None and item.available_stock > item.max_capacity:
            return StockStatus.OVERSTOCKED

        overstocked_threshold = predicted_demand * self.overstocked_demand_multiple + item.safety_stock
        if predicted_demand > 0 and item.available_stock > overstocked_threshold:
            return StockStatus.OVERSTOCKED

        return StockStatus.HEALTHY

    def _generate_explanation(
        self,
        item: ProductInventoryItem,
        predicted_demand: float,
        reorder_point: float,
        recommended_qty: int,
        status: StockStatus,
        is_fallback: bool,
    ) -> str:
        prefix = "[ESTIMATE – FALLBACK TO LEVEL 0 TRAINING MEAN] " if is_fallback else ""
        avail = item.available_stock

        messages = {
            StockStatus.OUT_OF_STOCK: (
                f"{prefix}Product is COMPLETELY OUT OF STOCK (0 units available). "
                f"Projected 7-day demand: {predicted_demand:.1f} units. "
                f"Safety stock: {item.safety_stock} units. "
                f"Urgent reorder of {recommended_qty} units recommended immediately."
            ),
            StockStatus.CRITICAL: (
                f"{prefix}Available stock ({avail}) is at or below the minimum threshold "
                f"({item.minimum_stock}). High stockout risk. "
                f"Reorder {recommended_qty} units to cover projected 7-day demand "
                f"({predicted_demand:.1f}) and restore safety stock ({item.safety_stock})."
            ),
            StockStatus.REORDER_REQUIRED: (
                f"{prefix}Available stock ({avail}) has fallen to or below the reorder point "
                f"({reorder_point:.1f}). Ordering {recommended_qty} units will cover projected "
                f"7-day demand ({predicted_demand:.1f}) and restore safety stock ({item.safety_stock})."
            ),
            StockStatus.OVERSTOCKED: (
                f"{prefix}Available stock ({avail}) significantly exceeds projected 7-day demand "
                f"({predicted_demand:.1f}). No reorder required; overstocking ties up working capital."
            ),
            StockStatus.HEALTHY: (
                f"{prefix}Inventory is healthy ({avail} units available; reorder point: "
                f"{reorder_point:.1f}). Stock comfortably covers projected 7-day demand "
                f"({predicted_demand:.1f}). No immediate action required."
            ),
        }
        return messages[status]
