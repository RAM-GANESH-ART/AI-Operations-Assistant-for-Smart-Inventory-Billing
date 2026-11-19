"""
Unit Tests for Phase 6: Inventory Logic and Reorder Recommendation Engine
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project

Tests must all be EXECUTED to be considered passed. Do not add expected results
without running the full suite.
"""

import json
import math
import sys
import unittest
from pathlib import Path

SERVICES_DIR = Path(__file__).resolve().parent
if str(SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICES_DIR))

from reorder_engine import (
    LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY,
    ProductInventoryItem,
    ReorderRecommendation,
    ReorderRecommendationEngine,
    StockStatus,
    _is_valid_prediction,
)


class TestProductInventoryItem(unittest.TestCase):
    """Input validation on ProductInventoryItem (Task 6.1 & 6.1.1)."""

    def test_available_stock_formula(self):
        item = ProductInventoryItem(
            stock_code="A",
            product_name="X",
            current_stock=50,
            minimum_stock=10,
            safety_stock=5,
            reserved_stock=15,
        )
        self.assertEqual(item.available_stock, 35)  # 50 - 15

    def test_available_stock_zero_reserved(self):
        item = ProductInventoryItem(
            stock_code="B", product_name="Y",
            current_stock=20, minimum_stock=5, safety_stock=3
        )
        self.assertEqual(item.available_stock, 20)

    def test_reserved_exceeds_current_raises(self):
        with self.assertRaises(ValueError):
            ProductInventoryItem(
                stock_code="C", product_name="Z",
                current_stock=10, minimum_stock=5, safety_stock=2,
                reserved_stock=15,  # > current
            )

    def test_negative_current_stock_raises(self):
        with self.assertRaises(ValueError):
            ProductInventoryItem(
                stock_code="D", product_name="W",
                current_stock=-1, minimum_stock=5, safety_stock=2
            )

    def test_negative_safety_stock_raises(self):
        with self.assertRaises(ValueError):
            ProductInventoryItem(
                stock_code="E", product_name="V",
                current_stock=10, minimum_stock=5, safety_stock=-1
            )

    def test_zero_lead_time_raises(self):
        with self.assertRaises(ValueError):
            ProductInventoryItem(
                stock_code="F", product_name="U",
                current_stock=10, minimum_stock=5, safety_stock=2,
                lead_time_days=0,
            )

    def test_negative_lead_time_raises(self):
        with self.assertRaises(ValueError):
            ProductInventoryItem(
                stock_code="G", product_name="T",
                current_stock=10, minimum_stock=5, safety_stock=2,
                lead_time_days=-2,
            )

    def test_negative_unit_price_raises(self):
        with self.assertRaises(ValueError):
            ProductInventoryItem(
                stock_code="H", product_name="S",
                current_stock=10, minimum_stock=5, safety_stock=2,
                unit_price=-5.0,
            )

    def test_zero_max_capacity_raises(self):
        with self.assertRaises(ValueError):
            ProductInventoryItem(
                stock_code="I", product_name="R",
                current_stock=10, minimum_stock=5, safety_stock=2,
                max_capacity=0,
            )

    def test_boolean_rejected_in_current_stock(self):
        """Boolean True/False must not masquerade as an integer current_stock."""
        with self.assertRaises(TypeError):
            ProductInventoryItem(
                stock_code="J1", product_name="BoolTest",
                current_stock=True, minimum_stock=5, safety_stock=2  # type: ignore[arg-type]
            )

    def test_boolean_rejected_in_minimum_stock(self):
        """Boolean True/False must not masquerade as an integer minimum_stock."""
        with self.assertRaises(TypeError):
            ProductInventoryItem(
                stock_code="J2", product_name="BoolTest",
                current_stock=10, minimum_stock=False, safety_stock=2  # type: ignore[arg-type]
            )

    def test_boolean_rejected_in_safety_stock(self):
        """Boolean True/False must not masquerade as an integer safety_stock."""
        with self.assertRaises(TypeError):
            ProductInventoryItem(
                stock_code="J3", product_name="BoolTest",
                current_stock=10, minimum_stock=5, safety_stock=True  # type: ignore[arg-type]
            )

    def test_boolean_rejected_in_reserved_stock(self):
        """Boolean True/False must not masquerade as an integer reserved_stock."""
        with self.assertRaises(TypeError):
            ProductInventoryItem(
                stock_code="J4", product_name="BoolTest",
                current_stock=10, minimum_stock=5, safety_stock=2,
                reserved_stock=False  # type: ignore[arg-type]
            )

    def test_boolean_rejected_in_lead_time_days(self):
        """Boolean True/False must not masquerade as an integer lead_time_days."""
        with self.assertRaises(TypeError):
            ProductInventoryItem(
                stock_code="J5", product_name="BoolTest",
                current_stock=10, minimum_stock=5, safety_stock=2,
                lead_time_days=True  # type: ignore[arg-type]
            )

    def test_boolean_rejected_in_max_capacity(self):
        """Boolean True/False must not masquerade as an integer max_capacity."""
        with self.assertRaises(TypeError):
            ProductInventoryItem(
                stock_code="J6", product_name="BoolTest",
                current_stock=10, minimum_stock=5, safety_stock=2,
                max_capacity=True  # type: ignore[arg-type]
            )

    def test_boolean_rejected_in_unit_price(self):
        """Boolean True/False must not masquerade as a float unit_price."""
        with self.assertRaises(TypeError):
            ProductInventoryItem(
                stock_code="J7", product_name="BoolTest",
                current_stock=10, minimum_stock=5, safety_stock=2,
                unit_price=True  # type: ignore[arg-type]
            )


class TestIsValidPrediction(unittest.TestCase):
    """Unit tests for the _is_valid_prediction helper."""

    def test_none_is_invalid(self):
        self.assertFalse(_is_valid_prediction(None))

    def test_nan_is_invalid(self):
        self.assertFalse(_is_valid_prediction(float("nan")))

    def test_positive_inf_is_invalid(self):
        self.assertFalse(_is_valid_prediction(float("inf")))

    def test_negative_inf_is_invalid(self):
        self.assertFalse(_is_valid_prediction(float("-inf")))

    def test_negative_demand_is_invalid(self):
        self.assertFalse(_is_valid_prediction(-1.0))

    def test_zero_demand_is_valid(self):
        self.assertTrue(_is_valid_prediction(0.0))

    def test_positive_demand_is_valid(self):
        self.assertTrue(_is_valid_prediction(52.0))

    def test_string_is_invalid(self):
        self.assertFalse(_is_valid_prediction("52"))  # type: ignore[arg-type]

    def test_boolean_is_invalid(self):
        self.assertFalse(_is_valid_prediction(True))
        self.assertFalse(_is_valid_prediction(False))


class TestReorderRecommendationEngine(unittest.TestCase):
    """Core reorder logic tests (Tasks 6.2 – 6.9)."""

    def setUp(self):
        self.engine = ReorderRecommendationEngine(default_lead_time_days=3)

    # -----------------------------------------------------------------
    # Core SRS Calculations & Statuses
    # -----------------------------------------------------------------

    def test_srs_viva_q4_exact_calculation(self):
        """
        SRS Q4 walkthrough (from SRS Meeting Q&A document):
        current_stock=35, predicted_demand=52, safety_stock=10
        SuggestedOrderQty = max(0, 52 + 10 - 35) = 27 units.
        """
        item = ProductInventoryItem(
            stock_code="22423",
            product_name="REGENCY CAKESTAND 3 TIER",
            current_stock=35,
            minimum_stock=15,
            safety_stock=10,
            reserved_stock=0,
            lead_time_days=3,
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=52.0)
        self.assertEqual(rec.recommended_reorder_qty, 27)
        self.assertEqual(rec.final_order_quantity, 27)
        self.assertFalse(rec.is_fallback)

    def test_out_of_stock_triggers_urgent_replenishment(self):
        item = ProductInventoryItem(
            stock_code="85123A",
            product_name="WHITE HANGING HEART T-LIGHT HOLDER",
            current_stock=0,
            minimum_stock=20,
            safety_stock=15,
            reserved_stock=0,
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=70.0)
        self.assertEqual(rec.stock_status, StockStatus.OUT_OF_STOCK)
        self.assertEqual(rec.recommended_reorder_qty, 85)  # 70 + 15 - 0

    def test_critical_low_stock(self):
        item = ProductInventoryItem(
            stock_code="47566",
            product_name="PARTY BUNTING",
            current_stock=5,
            minimum_stock=10,
            safety_stock=12,
            reserved_stock=0,
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=35.0)
        self.assertEqual(rec.stock_status, StockStatus.CRITICAL)
        self.assertEqual(rec.recommended_reorder_qty, 42)  # 35 + 12 - 5

    def test_healthy_stock_no_reorder_needed(self):
        # available=50, demand=40, safety=10, lead=3
        # reorder_point = (40/7)*3 + 10 ≈ 27.14  → 50 > 27.14  (not REORDER_REQUIRED)
        # overstocked_threshold = 40*3 + 10 = 130 → 50 ≤ 130    (not OVERSTOCKED)
        # Therefore: HEALTHY
        item = ProductInventoryItem(
            stock_code="84879",
            product_name="ASSORTED COLOUR BIRD ORNAMENT",
            current_stock=50,
            minimum_stock=10,
            safety_stock=10,
            reserved_stock=0,
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=40.0)
        self.assertEqual(rec.stock_status, StockStatus.HEALTHY)
        self.assertEqual(rec.recommended_reorder_qty, 0)

    def test_overstocked_via_demand_multiple(self):
        """Available stock > 3 × demand + safety → OVERSTOCKED."""
        item = ProductInventoryItem(
            stock_code="20725",
            product_name="LUNCH BAG RED RETROSPOT",
            current_stock=500,
            minimum_stock=10,
            safety_stock=10,
            reserved_stock=0,
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=25.0)
        self.assertEqual(rec.stock_status, StockStatus.OVERSTOCKED)
        self.assertEqual(rec.recommended_reorder_qty, 0)

    def test_reserved_stock_deduction(self):
        """Available stock = current - reserved; formula uses available."""
        item = ProductInventoryItem(
            stock_code="POST",
            product_name="POSTAGE",
            current_stock=50,
            minimum_stock=10,
            safety_stock=10,
            reserved_stock=25,
        )
        self.assertEqual(item.available_stock, 25)
        rec = self.engine.evaluate(item, predicted_7day_demand=30.0)
        self.assertEqual(rec.recommended_reorder_qty, 15)  # 30 + 10 - 25

    def test_level0_fallback_on_none_prediction(self):
        """FR-2.4: None prediction → Level 0 Global Training Mean used as demand."""
        item = ProductInventoryItem(
            stock_code="UNKNOWN_SKU",
            product_name="NEW UNSEEN PRODUCT",
            current_stock=10,
            minimum_stock=5,
            safety_stock=5,
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=None)
        self.assertTrue(rec.is_fallback)
        self.assertIsNotNone(rec.fallback_reason)
        # Demand used is 18.3150, NOT 38.9465 (the MAE)
        self.assertAlmostEqual(
            rec.predicted_7day_demand,
            LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY,
            places=3,
        )
        # SuggestedQty = ceil(max(0, 18.3150 + 5 - 10)) = ceil(13.315) = 14
        self.assertEqual(rec.recommended_reorder_qty, 14)

    def test_owner_override_replaces_recommendation(self):
        """FR-2.5: Shop owner override changes final_order_quantity."""
        item = ProductInventoryItem(
            stock_code="22423",
            product_name="REGENCY CAKESTAND 3 TIER",
            current_stock=35,
            minimum_stock=15,
            safety_stock=10,
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=52.0, owner_override=40)
        self.assertEqual(rec.recommended_reorder_qty, 27)
        self.assertEqual(rec.owner_override_qty, 40)
        self.assertEqual(rec.final_order_quantity, 40)

    # -----------------------------------------------------------------
    # Fallback Edge Cases (NaN, ±inf, negative, bool)
    # -----------------------------------------------------------------

    def test_fallback_on_nan(self):
        """NaN prediction triggers fallback."""
        item = ProductInventoryItem(
            stock_code="X1", product_name="A", current_stock=10, minimum_stock=3, safety_stock=2
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=float("nan"))
        self.assertTrue(rec.is_fallback)
        self.assertAlmostEqual(rec.predicted_7day_demand, LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY, places=3)

    def test_fallback_on_positive_infinity(self):
        """Positive infinity triggers fallback."""
        item = ProductInventoryItem(
            stock_code="X2", product_name="B", current_stock=10, minimum_stock=3, safety_stock=2
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=float("inf"))
        self.assertTrue(rec.is_fallback)

    def test_fallback_on_negative_infinity(self):
        """Negative infinity triggers fallback."""
        item = ProductInventoryItem(
            stock_code="X3", product_name="C", current_stock=10, minimum_stock=3, safety_stock=2
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=float("-inf"))
        self.assertTrue(rec.is_fallback)

    def test_fallback_on_negative_demand(self):
        """Negative demand triggers fallback."""
        item = ProductInventoryItem(
            stock_code="X4", product_name="D", current_stock=10, minimum_stock=3, safety_stock=2
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=-5.0)
        self.assertTrue(rec.is_fallback)

    def test_fallback_on_boolean_prediction(self):
        """Boolean prediction triggers Level 0 fallback."""
        item = ProductInventoryItem(
            stock_code="X4B", product_name="DBool", current_stock=10, minimum_stock=3, safety_stock=2
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=True)  # type: ignore[arg-type]
        self.assertTrue(rec.is_fallback)
        self.assertAlmostEqual(rec.predicted_7day_demand, LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY, places=3)

    def test_zero_demand_no_fallback(self):
        """Zero demand is a valid prediction (new product with no history)."""
        item = ProductInventoryItem(
            stock_code="X5", product_name="E", current_stock=10, minimum_stock=3, safety_stock=2
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=0.0)
        self.assertFalse(rec.is_fallback)
        self.assertEqual(rec.predicted_7day_demand, 0.0)
        # SuggestedQty = max(0, 0 + 2 - 10) = 0
        self.assertEqual(rec.recommended_reorder_qty, 0)

    def test_exactly_at_reorder_point_triggers_reorder(self):
        """When available stock == reorder point exactly, status is REORDER_REQUIRED."""
        item = ProductInventoryItem(
            stock_code="Y1", product_name="F", current_stock=17, minimum_stock=5, safety_stock=5,
            lead_time_days=3
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=30.0)
        self.assertIn(rec.stock_status, [StockStatus.REORDER_REQUIRED, StockStatus.CRITICAL])

    def test_max_capacity_overstocked(self):
        """When available_stock > max_capacity → OVERSTOCKED."""
        item = ProductInventoryItem(
            stock_code="Y2", product_name="G", current_stock=200, minimum_stock=5, safety_stock=5,
            max_capacity=100
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=20.0)
        self.assertEqual(rec.stock_status, StockStatus.OVERSTOCKED)

    def test_negative_owner_override_raises(self):
        """Negative owner_override raises ValueError before computing anything."""
        item = ProductInventoryItem(
            stock_code="Y3", product_name="H", current_stock=50, minimum_stock=10, safety_stock=5
        )
        with self.assertRaises(ValueError):
            self.engine.evaluate(item, predicted_7day_demand=30.0, owner_override=-1)

    def test_boolean_owner_override_raises(self):
        """Boolean owner_override raises TypeError before computing anything."""
        item = ProductInventoryItem(
            stock_code="Y3B", product_name="HBool", current_stock=50, minimum_stock=10, safety_stock=5
        )
        with self.assertRaises(TypeError):
            self.engine.evaluate(item, predicted_7day_demand=30.0, owner_override=True)  # type: ignore[arg-type]

    def test_zero_owner_override_allowed(self):
        """Owner may override with 0 (deliberately hold off ordering)."""
        item = ProductInventoryItem(
            stock_code="Y4", product_name="I", current_stock=10, minimum_stock=5, safety_stock=5
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=30.0, owner_override=0)
        self.assertEqual(rec.final_order_quantity, 0)

    def test_fractional_demand_ceiling_applied(self):
        """When formula gives a fractional qty, ceiling rounds up to whole units."""
        # SuggestedQty = max(0, 10.3 + 5 - 10) = 5.3 → ceil = 6
        item = ProductInventoryItem(
            stock_code="Y5", product_name="J", current_stock=10, minimum_stock=3, safety_stock=5
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=10.3)
        self.assertEqual(rec.recommended_reorder_qty, 6)

    def test_recommendation_fields_are_finite(self):
        """All numeric output fields must be finite (no NaN / inf leakage)."""
        item = ProductInventoryItem(
            stock_code="Z2", product_name="L", current_stock=15, minimum_stock=5, safety_stock=4
        )
        rec = self.engine.evaluate(item, predicted_7day_demand=20.0)
        for field_name in [
            "predicted_7day_demand",
            "average_daily_demand",
            "lead_time_demand",
            "reorder_point",
        ]:
            value = getattr(rec, field_name)
            self.assertTrue(
                math.isfinite(value),
                msg=f"Field {field_name} is not finite: {value}",
            )

    # -----------------------------------------------------------------
    # Four Lead Time Scenarios (Requirement 1 & 2)
    # -----------------------------------------------------------------

    def test_lead_time_scenario_1_engine7_item_unspecified(self):
        """Scenario 1: Engine default = 7, product lead time unspecified (None) → use 7."""
        engine7 = ReorderRecommendationEngine(default_lead_time_days=7)
        item = ProductInventoryItem(
            stock_code="LT1", product_name="Item 1",
            current_stock=20, minimum_stock=5, safety_stock=5,
            lead_time_days=None,
        )
        rec = engine7.evaluate(item, predicted_7day_demand=14.0)
        self.assertEqual(rec.lead_time_days, 7)
        # avg_daily = 14/7 = 2.0; lead_time_demand = 2.0 * 7 = 14.0
        self.assertAlmostEqual(rec.lead_time_demand, 14.0, places=3)
        self.assertAlmostEqual(rec.reorder_point, 19.0, places=3)  # 14.0 + 5

    def test_lead_time_scenario_2_engine7_item_specified_5(self):
        """Scenario 2: Engine default = 7, product lead time = 5 → use 5."""
        engine7 = ReorderRecommendationEngine(default_lead_time_days=7)
        item = ProductInventoryItem(
            stock_code="LT2", product_name="Item 2",
            current_stock=20, minimum_stock=5, safety_stock=5,
            lead_time_days=5,
        )
        rec = engine7.evaluate(item, predicted_7day_demand=14.0)
        self.assertEqual(rec.lead_time_days, 5)
        # avg_daily = 14/7 = 2.0; lead_time_demand = 2.0 * 5 = 10.0
        self.assertAlmostEqual(rec.lead_time_demand, 10.0, places=3)
        self.assertAlmostEqual(rec.reorder_point, 15.0, places=3)  # 10.0 + 5

    def test_lead_time_scenario_3_engine3_item_unspecified(self):
        """Scenario 3: Engine default = 3, product lead time unspecified (None) → use 3."""
        engine3 = ReorderRecommendationEngine(default_lead_time_days=3)
        item = ProductInventoryItem(
            stock_code="LT3", product_name="Item 3",
            current_stock=20, minimum_stock=5, safety_stock=5,
            lead_time_days=None,
        )
        rec = engine3.evaluate(item, predicted_7day_demand=14.0)
        self.assertEqual(rec.lead_time_days, 3)
        # avg_daily = 14/7 = 2.0; lead_time_demand = 2.0 * 3 = 6.0
        self.assertAlmostEqual(rec.lead_time_demand, 6.0, places=3)
        self.assertAlmostEqual(rec.reorder_point, 11.0, places=3)  # 6.0 + 5

    def test_lead_time_scenario_4_engine3_item_specified_10(self):
        """Scenario 4: Engine default = 3, product lead time = 10 → use 10."""
        engine3 = ReorderRecommendationEngine(default_lead_time_days=3)
        item = ProductInventoryItem(
            stock_code="LT4", product_name="Item 4",
            current_stock=20, minimum_stock=5, safety_stock=5,
            lead_time_days=10,
        )
        rec = engine3.evaluate(item, predicted_7day_demand=14.0)
        self.assertEqual(rec.lead_time_days, 10)
        # avg_daily = 14/7 = 2.0; lead_time_demand = 2.0 * 10 = 20.0
        self.assertAlmostEqual(rec.lead_time_demand, 20.0, places=3)
        self.assertAlmostEqual(rec.reorder_point, 25.0, places=3)  # 20.0 + 5

    # -----------------------------------------------------------------
    # Additional Engine Validation (Booleans in engine init)
    # -----------------------------------------------------------------

    def test_boolean_rejected_in_engine_default_lead_time(self):
        """Engine rejects boolean default_lead_time_days."""
        with self.assertRaises(TypeError):
            ReorderRecommendationEngine(default_lead_time_days=True)  # type: ignore[arg-type]

    def test_boolean_rejected_in_engine_overstocked_multiple(self):
        """Engine rejects boolean overstocked_demand_multiple."""
        with self.assertRaises(ValueError):
            ReorderRecommendationEngine(overstocked_demand_multiple=True)  # type: ignore[arg-type]

    # -----------------------------------------------------------------
    # Owner Override vs Max Capacity Business Rule (Requirement 5)
    # -----------------------------------------------------------------

    def test_owner_override_exceeding_max_capacity_handled_per_business_rule(self):
        """
        Requirement 5: Test confirming owner override exceeding max_capacity.

        Agreed Business Rule & FR-2.5:
        - The shop owner has manual discretion to override the recommended quantity
          (e.g., in anticipation of a festival rush or bulk purchase deal).
        - The engine calculates recommended_reorder_qty according to the SRS formula:
            raw_qty = predicted_demand + safety_stock - available_stock
          without silent alterations or clamping.
        - The owner override is preserved in owner_override_qty.
        - final_order_quantity returns the owner_override_qty.
        """
        item = ProductInventoryItem(
            stock_code="FESTIVAL_01",
            product_name="SPECIAL FESTIVAL PACK",
            current_stock=20,
            minimum_stock=10,
            safety_stock=10,
            max_capacity=100,
        )
        # predicted_demand = 40.0; available_stock = 20; safety_stock = 10
        # SRS Formula: max(0, 40 + 10 - 20) = 30
        # Owner overrides with 150 (exceeds max_capacity=100)
        rec = self.engine.evaluate(item, predicted_7day_demand=40.0, owner_override=150)

        # 1. SRS formula recommendation is preserved and not clamped
        self.assertEqual(rec.recommended_reorder_qty, 30)
        # 2. Owner override is recorded faithfully
        self.assertEqual(rec.owner_override_qty, 150)
        # 3. Final order quantity honours the owner's manual discretion (FR-2.5)
        self.assertEqual(rec.final_order_quantity, 150)

    # -----------------------------------------------------------------
    # Fallback Verification Tests (Requirement 6)
    # -----------------------------------------------------------------

    def test_fallback_value_is_training_mean_not_mae(self):
        """
        Regression guard: the fallback constant must be the training mean (18.3150),
        not the Level 0 Test MAE (≈38.95 or 39.10). These two values are distinct.
        """
        self.assertAlmostEqual(LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY, 18.3150, places=3)
        self.assertNotAlmostEqual(LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY, 38.9465, places=0)
        self.assertNotAlmostEqual(LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY, 39.1022, places=0)

    def test_fallback_value_verified_from_notebook02_output(self):
        """
        Requirement 6: Verify Level 0 training mean directly from executed Notebook 02.
        Reads 02_baseline.ipynb and confirms Cell 16 executed output contains 18.3150.
        """
        nb_path = SERVICES_DIR.parent / "notebooks" / "02_baseline.ipynb"
        self.assertTrue(nb_path.exists(), f"Notebook not found at {nb_path}")

        with open(nb_path, "r", encoding="utf-8") as f:
            nb = json.load(f)

        found_mean = None
        for cell in nb.get("cells", []):
            for out in cell.get("outputs", []):
                for line in out.get("text", []):
                    if "Training mean:" in line:
                        for token in line.split():
                            try:
                                val = float(token)
                                if abs(val - 18.3150) < 0.001:
                                    found_mean = val
                            except ValueError:
                                pass

        self.assertIsNotNone(
            found_mean,
            "Could not find executed output 'Training mean: 18.3150' in Notebook 02"
        )
        self.assertAlmostEqual(LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY, found_mean, places=4)


if __name__ == "__main__":
    unittest.main(verbosity=2)
