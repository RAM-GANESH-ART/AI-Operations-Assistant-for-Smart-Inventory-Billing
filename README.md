# AI Operations Assistant for Smart Inventory & Billing
> **GLA University – Semester 3 Main Project**  
> **Domain**: Retail Demand Forecasting, Smart Inventory Optimization & Operations AI  
> **Dataset**: UCI Online Retail Transaction Dataset (UK Retail Ledger)  
> **Target**: 7-Day Forward Product Demand (`Future7DayDemand` in units)  

---

## 📊 Model Performance: Baseline vs. Random Forest (MAE Comparison)

The predictive engine forecasts **7-day forward product demand (`Future7DayDemand`)** using strictly chronological train/validation/test splits with a **7-day calendar purge buffer** at all boundaries to eliminate lookahead bias and future-data leakage.

### Final Holdout Test Evaluation (Unseen Test Data)

The table below compares the naive and heuristic baselines against the machine learning Random Forest regressors on the final holdout test set (`289,777` chronological observations):

| Model Architecture | Test MAE ↓ | Test RMSE ↓ | Test $R^2$ ↑ | Improvement vs. Level 0 | Improvement vs. Level 1 | Evaluation Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Level 0 Baseline (Global Mean)** | `38.9465` | `188.9420` | `-0.0077` | *Baseline* | — | Naive Reference |
| **Level 1 Baseline (Product Historical Mean)** | `28.7596` | `182.2648` | `+0.0623` | +26.16% | *Baseline* | Historical Heuristic |
| **Initial Random Forest Regressor** | `26.4215` | `178.5120` | `+0.1004` | +32.16% | +8.13% | Feature Engineered |
| **Optimized Random Forest (`RF-DEPTH-10`)** ⭐ | **`24.2222`** | **`174.7635`** | **`+0.1379`** | **+37.81%** | **+15.78%** | **Selected Production Model** |

> [!NOTE]
> **Understanding Level 0 Forecast vs. Error**:
> - **Prediction Value**: The Level 0 model predicts a constant value of **`18.3150` units** for every observation (the global training set mean of 7-day demand). This is also the fallback demand value applied in the inventory engine (FR-2.4) when an ML forecast is unavailable.
> - **Test Error (MAE)**: The **`38.9465`** (or `39.1022` in Notebook 02) metric is the **Mean Absolute Error** between this constant prediction and the true actual test demand.
>
> **Key Conclusion**:  
> The **Optimized Random Forest (`RF-DEPTH-10`)** reduces the test MAE down to **`24.22 units`**, outperforming the Level 0 global naive baseline by **37.81%** and beating the product-level moving average (Level 1) by **15.78%**.

---

### Hyperparameter Search & Validation Tuning

To prevent overfitting to holdout test data, hyperparameter tuning was conducted strictly on an internal validation set (`X_inner_train` vs. `X_validation`):

| Model ID | Estimators (`n_estimators`) | Max Depth (`max_depth`) | Min Leaf Samples (`min_samples_leaf`) | Validation MAE ↓ | Validation RMSE ↓ | Validation $R^2$ ↑ | Training Time |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`RF-DEPTH-10`** ⭐ | **100** | **10** | **2** | **17.1521** | **56.8663** | **0.3667** | **~0.37 min** |
| `RF-LEAF-5` | 100 | 15 | 5 | 17.7059 | 58.6653 | 0.3260 | ~0.43 min |
| `RF-BASELINE` | 100 | 15 | 2 | 17.8721 | 59.3007 | 0.3113 | ~0.47 min |
| `RF-200-TREES` | 200 | 15 | 2 | 17.8748 | 59.3408 | 0.3104 | ~0.83 min |
| `RF-DEPTH-20` | 100 | 20 | 2 | 18.4679 | 60.0871 | 0.2929 | ~0.46 min |

*Depth Regularization Insight: Setting `max_depth=10` prevented the trees from memorizing demand spikes and noise, generating the strongest generalization and lowest validation error.*

---

### Top Feature Importances (Supervised Feature Space)

| Rank | Feature | Importance | Operational Meaning |
| :---: | :--- | :---: | :--- |
| 1 | `RollingMean_30` | **51.39%** | 30-day historical moving average demand |
| 2 | `HistoricalMean` | **23.57%** | All-time historical sales mean per SKU |
| 3 | `RollingMean_7` | **7.32%** | Short-term 7-day sales momentum |
| 4 | `Month` | **6.49%** | Annual seasonality pattern |
| 5 | `AvgUnitPrice` | **5.85%** | Product pricing dynamic (forward-filled without leakage) |
| 6 | `Year` | **1.99%** | Macro annual trend |
| 7 | `Lag_1` | **1.20%** | Previous day sales |
| 8 | `Lag_30` | **0.90%** | Sales from 30 days prior |
| 9 | `DayOfWeek` | **0.75%** | Intra-week demand cyclicality |
| 10 | `Lag_7` | **0.55%** | Same-weekday prior week sales |

---

## 📦 Inventory Engine & Reorder Logic (Phase 6)

The application translates demand forecasts into automated, actionable purchase recommendations via `reorder_engine.py`:

- **SRS Reorder Quantity Formula**:
  $$\text{SuggestedOrderQty} = \lceil\max(0, \text{PredictedDemand7Day} + \text{SafetyStock} - \text{AvailableStock})\rceil$$
  where $\text{AvailableStock} = \text{CurrentStock} - \text{ReservedStock}$.
- **Reorder Point (Classification Only)**:
  $$\text{ReorderPoint} = (\text{AvgDailyDemand} \times \text{LeadTimeDays}) + \text{SafetyStock}$$
- **Stock Statuses**: `OUT_OF_STOCK`, `CRITICAL`, `REORDER_REQUIRED`, `HEALTHY`, `OVERSTOCKED`.
- **Level 0 Fallback (FR-2.4)**: If ML prediction is unavailable, NaN, negative, or infinite, uses `LEVEL_0_GLOBAL_TRAINING_MEAN_7DAY = 18.3150`.
- **Manual Override (FR-2.5)**: Allows shop owner to override suggested quantity before purchase order generation.
- **Test Coverage**: 55 unit tests (`test_reorder_engine.py`) covering calculations, edge cases, boolean type rejection, and lead-time scenarios.

---

## 📁 Repository Structure

```text
├── .gitignore                                      # Excludes large binaries, local caches & notes
├── README.md                                       # Project overview, MAE benchmark & guide
├── SRS_v1.0_22515500047_Smart_inventory_.pdf       # System Requirements Specification
└── smart-inventory-ai/
    ├── data/
    │   ├── Online Retail.xlsx                      # Raw transaction dataset (UCI Online Retail)
    │   └── processed_daily_sales.csv               # Cleaned daily sales ledger (zero-filled grid)
    ├── database/
    │   ├── schema.sql                              # Phase 7: PostgreSQL 16 DDL & relational schema (7 core tables)
    │   ├── connection.py                           # Database connection & transaction manager
    │   ├── init_db.py                              # Database creation & schema deployment
    │   ├── import_sales.py                         # 1.46M row bulk COPY & aggregate validator
    │   ├── seed_demo_data.py                       # Clearly labeled demo seed records
    │   └── test_database.py                        # Phase 7: 12-test database integrity & concurrency suite
    ├── models/
    │   └── optimized_random_forest_demand_model.joblib # Serialized best model artifact (RF-DEPTH-10)
    ├── notebooks/
    │   ├── 01_data_preprocessing.ipynb             # Data ingestion, cleaning, calendar expansion
    │   ├── 02_baseline.ipynb                       # Target calculation, Level 0 & Level 1 baselines
    │   ├── 03_feature_engineering_random_forest.ipynb # 10-feature pipeline & initial Random Forest
    │   └── 04_model_experimentation.ipynb         # Validation hyperparameter search & test holdout
    ├── results/
    │   ├── optimized_random_forest_feature_importance.csv
    │   ├── optimized_random_forest_final_comparison.csv
    │   ├── random_forest_experiment_results.csv
    │   └── random_forest_results.csv
    └── services/
        ├── reorder_engine.py                       # Phase 6: Inventory reorder engine
        ├── test_reorder_engine.py                  # Phase 6: 55-test verification suite
        └── billing_service.py                      # Phase 7: Transactional billing & concurrency control
```

*(Note: The duplicate "online+retail/" folder and 16 MB row-by-row prediction CSVs are removed from the Git repository; prediction metrics are summarized in the CSVs above).*

---

## 🗄️ Database Architecture & Billing Integration (Phase 7)

The application implements an operational PostgreSQL 16 database designed for retail inventory management, demand forecasting, and point-of-sale billing:

### Current Scope: Seven Core Tables
1. **`users`**: Operator authentication and RBAC (`OWNER`, `MANAGER`, `CASHIER`).
2. **`products`**: Master SKU catalog with integrity constraints (`current_stock >= 0`, `reserved_stock <= current_stock`, `unit_price >= 0`, `lead_time_days > 0`).
3. **`stock_movements`**: Immutable audit ledger tracking all additions, sales, returns, and adjustments.
4. **`daily_product_sales`**: 1,464,584 historical daily sales records aggregated from transaction data.
5. **`demand_forecasts`**: 7-day model predictions and fallback audit tracking (`18.3150`).
6. **`invoices`**: POS checkout receipts with unique invoice numbering and payment methods.
7. **`invoice_items`**: Line items per invoice linking quantities, unit prices, and product SKUs.

### Future Scope: Supplier Management (Decoupled)
Supplier directory (`suppliers`), purchase orders (`purchase_orders`), line items (`purchase_order_items`), automated PO generation, and delivery lead-time tracking are marked as future scope. The 7 core tables maintain zero foreign keys or runtime dependencies on supplier tables.

### Transactional Billing & Concurrency Safety
- **Workflow**: `BillingService.process_checkout()` validates stock, creates invoice headers, inserts line items, reduces inventory, and records `'SALE'` stock movement records within a single database transaction.
- **Atomic Rollback (NFR-4)**: If any cart item has insufficient stock or encounters an error, the complete transaction rolls back automatically without partial writes or stock deductions.
- **Race Condition & Overselling Protection**: Employs row-level pessimistic locking (`SELECT ... FOR UPDATE`) during checkout. Concurrent purchases serialize smoothly, preventing overselling under high-concurrency race conditions.

---

## 🛠️ Portable Execution & Path Resolution

All notebooks utilize **portable, dynamic path resolution** (`pathlib.Path`). There are **no machine-specific or hardcoded user paths**, allowing seamless execution whether run:
1. Directly within JupyterLab / VS Code Notebook editor (`smart-inventory-ai/notebooks/`).
2. From the project root (`./`) or `smart-inventory-ai/`.
3. In headless/CI environments via `nbconvert` or python scripts.

### Quickstart

1. **Install dependencies**:
   ```bash
   pip install pandas numpy scikit-learn openpyxl matplotlib joblib jupyter psycopg2-binary sqlalchemy
   ```

2. **Run Reorder Engine Unit Tests**:
   ```bash
   python smart-inventory-ai/services/test_reorder_engine.py
   ```
   *(Expected output: `Ran 55 tests in 0.004s — OK`)*

3. **Deploy Database & Run Database Tests (PostgreSQL 16)**:
   ```bash
   python smart-inventory-ai/database/init_db.py
   python smart-inventory-ai/database/import_sales.py
   python smart-inventory-ai/database/test_database.py
   ```
   *(Expected output: `Ran 12 tests in ~7s — OK`)*

4. **Inference with Saved Model**:
   ```python
   import joblib

   # Load serialized model artifact
   artifact = joblib.load("smart-inventory-ai/models/optimized_random_forest_demand_model.joblib")
   model = artifact["model"]
   features = artifact["feature_columns"]

   print("Model loaded successfully. Features:", features)
   ```
