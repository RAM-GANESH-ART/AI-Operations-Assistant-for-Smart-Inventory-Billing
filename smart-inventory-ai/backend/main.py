"""
FastAPI Backend Application
AI Operations Assistant for Smart Inventory & Billing
GLA University – Semester 3 Main Project

Entry point for the REST API server.
Run: uvicorn smart-inventory-ai.backend.main:app --reload
"""

import sys
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# Path setup – ensure database/ and services/ are importable
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
DB_DIR = PROJECT_DIR / "database"
SERVICES_DIR = PROJECT_DIR / "services"
MODELS_DIR = PROJECT_DIR / "models"

for p in [str(DB_DIR), str(SERVICES_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# ---------------------------------------------------------------------------
# Shared application state (populated at startup)
# ---------------------------------------------------------------------------
ml_model = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML model once at server startup; release on shutdown."""
    model_path = MODELS_DIR / "optimized_random_forest_demand_model.joblib"
    if model_path.exists():
        artifact = joblib.load(model_path)
        ml_model["model"] = artifact["model"]
        ml_model["features"] = artifact["feature_columns"]
        print(f"[STARTUP] Loaded ML model from {model_path.name}")
        print(f"[STARTUP] Feature columns: {artifact['feature_columns']}")
    else:
        print(f"[STARTUP] WARNING: Model file not found at {model_path}")
        print("[STARTUP] Forecast endpoint will use Level 0 fallback (18.3150)")
    yield
    ml_model.clear()
    print("[SHUTDOWN] ML model released from memory.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Smart Inventory & Billing API",
    description=(
        "REST API for the AI Operations Assistant – "
        "Demand Forecasting, Inventory Management, Reorder Recommendations, "
        "and Point-of-Sale Billing."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow frontend to call the API from any origin during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------
from routers import products, forecast, reorder, billing, dashboard  # noqa: E402

app.include_router(products.router, prefix="/api", tags=["Products & Inventory"])
app.include_router(forecast.router, prefix="/api", tags=["Demand Forecasting"])
app.include_router(reorder.router, prefix="/api", tags=["Reorder Recommendations"])
app.include_router(billing.router, prefix="/api", tags=["Billing & Checkout"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])


@app.get("/", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    """API health check and model status."""
    return {
        "status": "running",
        "project": "AI Operations Assistant for Smart Inventory & Billing",
        "model_loaded": "model" in ml_model,
        "docs_url": "/docs",
    }
