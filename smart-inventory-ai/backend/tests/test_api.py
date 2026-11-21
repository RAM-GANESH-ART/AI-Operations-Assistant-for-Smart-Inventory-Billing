"""
FastAPI Backend Integration & Endpoint Test Suite
AI Operations Assistant for Smart Inventory & Billing

Automated tests covering all REST API endpoints:
- Health check
- Product catalog & detail
- 7-day demand forecasting
- Reorder recommendations & filtering
- Dashboard summary & KPIs
- Transactional billing checkout (success, oversell prevention, invalid product)
- Invoice listing & retrieval
"""

import sys
import unittest
import uuid
from pathlib import Path

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
TESTS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = TESTS_DIR.parent
APP_ROOT = BACKEND_DIR.parent
DB_DIR = APP_ROOT / "database"
SERVICES_DIR = APP_ROOT / "services"

for p in [str(BACKEND_DIR), str(DB_DIR), str(SERVICES_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi.testclient import TestClient
from main import app


class TestBackendAPI(unittest.TestCase):
    """Integration tests for all FastAPI endpoints using TestClient."""

    @classmethod
    def setUpClass(cls):
        """Initialize TestClient with lifespan context manager to load ML model."""
        cls.client_context = TestClient(app)
        cls.client = cls.client_context.__enter__()

    @classmethod
    def tearDownClass(cls):
        """Release TestClient and lifespan resources."""
        cls.client_context.__exit__(None, None, None)

    # -----------------------------------------------------------------------
    # 1. Health & Root
    # -----------------------------------------------------------------------
    def test_01_health_check(self):
        """Root endpoint should return 200 with running status and model flag."""
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "running")
        self.assertIn("model_loaded", data)
        self.assertTrue(data["model_loaded"])

    # -----------------------------------------------------------------------
    # 2. Product Catalog
    # -----------------------------------------------------------------------
    def test_02_list_products_paginated(self):
        """Products endpoint should return paginated catalog with total count."""
        response = self.client.get("/api/products?page=1&page_size=10")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total", data)
        self.assertIn("products", data)
        self.assertGreater(data["total"], 0)
        self.assertEqual(len(data["products"]), 10)

    def test_03_search_products(self):
        """Product search should filter matching products."""
        response = self.client.get("/api/products?search=WHITE&page_size=5")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(data["total"], 0)
        for item in data["products"]:
            self.assertTrue(
                "WHITE" in item["product_name"].upper() or "WHITE" in item["stock_code"].upper()
            )

    def test_04_get_product_detail(self):
        """Single product retrieval by valid stock_code."""
        response = self.client.get("/api/products/10002")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["stock_code"], "10002")
        self.assertIn("current_stock", data)
        self.assertIn("available_stock", data)

    def test_05_get_product_not_found(self):
        """Nonexistent stock_code should return 404."""
        response = self.client.get("/api/products/NONEXISTENT_SKU_99999")
        self.assertEqual(response.status_code, 404)

    # -----------------------------------------------------------------------
    # 3. Demand Forecast Endpoint
    # -----------------------------------------------------------------------
    def test_06_forecast_endpoint_valid_product(self):
        """Forecast endpoint should return 7-day prediction for a valid SKU."""
        response = self.client.get("/api/forecast/10002")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["stock_code"], "10002")
        self.assertIn("predicted_demand_7day", data)
        self.assertGreater(data["predicted_demand_7day"], 0.0)
        self.assertIn("model_version", data)

    def test_07_forecast_endpoint_not_found(self):
        """Forecast for invalid product should return 404."""
        response = self.client.get("/api/forecast/INVALID_SKU_XYZ")
        self.assertEqual(response.status_code, 404)

    # -----------------------------------------------------------------------
    # 4. Reorder Recommendations
    # -----------------------------------------------------------------------
    def test_08_reorder_recommendations(self):
        """Reorder recommendations endpoint returns items and summary."""
        response = self.client.get("/api/reorder-recommendations?limit=20")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("items", data)
        self.assertIn("summary", data)
        self.assertEqual(len(data["items"]), 20)
        self.assertIn("HEALTHY", data["summary"])

    def test_09_reorder_status_filter(self):
        """Status filter should only return items with specified stock status."""
        response = self.client.get("/api/reorder-recommendations?status_filter=HEALTHY&limit=10")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for item in data["items"]:
            self.assertEqual(item["stock_status"], "HEALTHY")

    # -----------------------------------------------------------------------
    # 5. Dashboard Summary
    # -----------------------------------------------------------------------
    def test_10_dashboard_summary(self):
        """Dashboard summary returns aggregate KPIs and alerts."""
        response = self.client.get("/api/dashboard/summary")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        summary = data["summary"]
        self.assertGreater(summary["total_products"], 0)
        self.assertGreater(summary["total_inventory_units"], 0)
        self.assertGreater(summary["total_inventory_value"], 0.0)
        self.assertIn("top_alerts", data)

    # -----------------------------------------------------------------------
    # 6. Billing & POS Checkout
    # -----------------------------------------------------------------------
    def test_11_billing_checkout_nonexistent_product(self):
        """Checkout with nonexistent product should return 404."""
        payload = {
            "customer_name": "Test Customer",
            "payment_method": "CASH",
            "items": [{"stock_code": "NONEXISTENT_SKU_000", "quantity": 1}],
        }
        response = self.client.post("/api/billing/checkout", json=payload)
        self.assertEqual(response.status_code, 404)

    def test_12_billing_checkout_oversell_protection(self):
        """Checkout requesting more stock than available should return 409 Conflict."""
        payload = {
            "customer_name": "Test Customer",
            "payment_method": "CASH",
            "items": [{"stock_code": "10002", "quantity": 999999}],
        }
        response = self.client.post("/api/billing/checkout", json=payload)
        self.assertEqual(response.status_code, 409)

    def test_13_billing_checkout_success_and_invoice_fetch(self):
        """Valid checkout should succeed (201), return receipt, and be retrievable."""
        payload = {
            "customer_name": "API Automated Test",
            "customer_phone": "9876543210",
            "payment_method": "UPI",
            "items": [{"stock_code": "10002", "quantity": 1}],
        }
        response = self.client.post("/api/billing/checkout", json=payload)
        self.assertEqual(response.status_code, 201)
        receipt = response.json()
        self.assertIn("invoice_no", receipt)
        self.assertEqual(receipt["customer_name"], "API Automated Test")
        self.assertEqual(receipt["payment_method"], "UPI")
        self.assertEqual(len(receipt["items"]), 1)

        # Retrieve the newly created invoice via GET /api/invoices/{invoice_no}
        inv_no = receipt["invoice_no"]
        inv_response = self.client.get(f"/api/invoices/{inv_no}")
        self.assertEqual(inv_response.status_code, 200)
        inv_data = inv_response.json()
        self.assertEqual(inv_data["invoice_no"], inv_no)
        self.assertEqual(inv_data["customer_name"], "API Automated Test")

    def test_14_list_invoices(self):
        """Invoice list endpoint should return recent invoices."""
        response = self.client.get("/api/invoices?limit=10")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total", data)
        self.assertIn("invoices", data)
        self.assertGreaterEqual(data["total"], 1)

    # -----------------------------------------------------------------------
    # 7. Idempotency & Retry Safety
    # -----------------------------------------------------------------------
    def test_15_billing_idempotency_checkout_success(self):
        """Checkout with Idempotency-Key succeeds and registers the key."""
        TestBackendAPI.shared_idemp_key = f"test-idemp-{uuid.uuid4().hex[:8]}"
        payload = {
            "customer_name": "Idempotency Test User",
            "payment_method": "CASH",
            "items": [{"stock_code": "10002", "quantity": 1}],
        }
        headers = {"Idempotency-Key": TestBackendAPI.shared_idemp_key}
        response = self.client.post("/api/billing/checkout", json=payload, headers=headers)
        self.assertEqual(response.status_code, 201)
        receipt = response.json()
        self.assertIn("invoice_no", receipt)
        self.assertEqual(receipt["customer_name"], "Idempotency Test User")

    def test_16_billing_idempotency_replay_prevents_duplicate_billing(self):
        """Replaying identical request with same key returns cached receipt without deducting stock."""
        # Check current stock before replay
        prod_before = self.client.get("/api/products/10002").json()
        stock_before = prod_before["current_stock"]

        # Re-send same request with same Idempotency-Key
        payload = {
            "customer_name": "Idempotency Test User",
            "payment_method": "CASH",
            "items": [{"stock_code": "10002", "quantity": 1}],
        }
        headers = {"Idempotency-Key": TestBackendAPI.shared_idemp_key}
        response = self.client.post("/api/billing/checkout", json=payload, headers=headers)
        self.assertEqual(response.status_code, 201)

        # Check stock after replay: must be completely unchanged
        prod_after = self.client.get("/api/products/10002").json()
        stock_after = prod_after["current_stock"]
        self.assertEqual(stock_before, stock_after)

    def test_17_billing_idempotency_payload_mismatch_rejected(self):
        """Reusing an idempotency key with a different payload must fail with HTTP 422."""
        payload_altered = {
            "customer_name": "Different Customer Name",
            "payment_method": "CARD",
            "items": [{"stock_code": "10002", "quantity": 5}],
        }
        headers = {"Idempotency-Key": TestBackendAPI.shared_idemp_key}
        response = self.client.post("/api/billing/checkout", json=payload_altered, headers=headers)
        self.assertEqual(response.status_code, 422)
        self.assertIn("different request payload", response.json()["detail"])

    def test_18_billing_idempotency_failed_request_allows_clean_retry(self):
        """Failed checkout (e.g. invalid SKU) cleans up key to allow immediate retry."""
        retry_key = f"test-retry-{uuid.uuid4().hex[:8]}"
        headers = {"Idempotency-Key": retry_key}
        invalid_payload = {
            "customer_name": "Retry User",
            "payment_method": "CASH",
            "items": [{"stock_code": "NONEXISTENT_SKU_RETRY", "quantity": 1}],
        }
        resp_fail = self.client.post("/api/billing/checkout", json=invalid_payload, headers=headers)
        self.assertEqual(resp_fail.status_code, 404)

        # Immediate retry with same key but valid payload succeeds
        valid_payload = {
            "customer_name": "Retry User",
            "payment_method": "CASH",
            "items": [{"stock_code": "10002", "quantity": 1}],
        }
        resp_success = self.client.post("/api/billing/checkout", json=valid_payload, headers=headers)
        self.assertEqual(resp_success.status_code, 201)


if __name__ == "__main__":
    unittest.main()
