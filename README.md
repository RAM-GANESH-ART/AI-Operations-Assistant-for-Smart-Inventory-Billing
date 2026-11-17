# AI Operations Assistant for Smart Inventory & Billing
> **Semester 3 Main Project** | Master's / Engineering Curriculum  
> **Domain**: Retail Demand Forecasting, Smart Inventory Optimization & Operations AI

---

## 📊 Model Performance: MAE vs Baseline Comparison

The core objective of the predictive engine is forecasting **7-day future demand (`Future7DayDemand`)** for retail products using chronological train/validation/test splits to eliminate lookahead bias and data leakage.

### Final Holdout Test Evaluation

| Model | Test MAE ↓ | Test RMSE ↓ | Test $R^2$ ↑ | Improvement vs Level 0 | Improvement vs Level 1 | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Level 0 Baseline (Global Mean)** | `38.9465` | `188.9420` | `-0.0077` | *Baseline* | — | Naive Reference |
| **Level 1 Baseline (Product Historical Mean)** | `28.7596` | `182.2648` | `+0.0623` | +26.16% | *Baseline* | Historical Heuristic |
| **Random Forest (Initial Baseline Model)** | `26.4215` | `178.5120` | `+0.1004` | +32.16% | +8.13% | Feature Engineered |
| **Optimized Random Forest (`RF-DEPTH-10`)** | **`24.2222`** | **`174.7635`** | **`+0.1379`** | **+37.81%** | **+15.78%** | **Selected Best Model** |

> **Key Takeaway**:  
> The **Optimized Random Forest (`RF-DEPTH-10`)** achieves an MAE of **24.22 units**, outperforming the Level 0 global baseline by **37.81%** and beating the product-level historical moving average (Level 1) by **15.78%** on unseen holdout test data.

---

### Hyperparameter Experimentation (Validation Set)

Model architectures and hyperparameters were tuned strictly on the validation set (`X_inner_train` vs `X_validation`) to prevent holdout contamination:

| Experiment | Trees (`n_estimators`) | Max Depth (`max_depth`) | Min Leaf Samples (`min_samples_leaf`) | Validation MAE ↓ | Validation RMSE ↓ | Validation $R^2$ ↑ | Training Time |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`RF-DEPTH-10`** ⭐ | **100** | **10** | **2** | **17.1521** | **56.8663** | **0.3667** | **~0.37 min** |
| `RF-LEAF-5` | 100 | 15 | 5 | 17.7059 | 58.6653 | 0.3260 | ~0.43 min |
| `RF-BASELINE` | 100 | 15 | 2 | 17.8721 | 59.3007 | 0.3113 | ~0.47 min |
| `RF-200-TREES` | 200 | 15 | 2 | 17.8748 | 59.3408 | 0.3104 | ~0.83 min |
| `RF-DEPTH-20` | 100 | 20 | 2 | 18.4679 | 60.0871 | 0.2929 | ~0.46 min |

*Notice: Limiting `max_depth=10` provided the strongest regularization against retail demand noise and overfitting, yielding the lowest MAE.*

---

### Top Feature Importances

| Rank | Feature | Importance | Description |
| :---: | :--- | :---: | :--- |
| 1 | `RollingMean_30` | **51.39%** | 30-day historical moving average demand |
| 2 | `HistoricalMean` | **23.57%** | All-time historical sales mean per SKU |
| 3 | `RollingMean_7` | **7.32%** | Short-term 7-day sales momentum |
| 4 | `Month` | **6.49%** | Annual seasonality pattern |
| 5 | `AvgUnitPrice` | **5.85%** | Product pricing dynamic |
| 6 | `Year` | **1.99%** | Macro annual trend |
| 7 | `Lag_1` | **1.20%** | Previous day sales |
| 8 | `Lag_30` | **0.90%** | Sales from 30 days prior |
| 9 | `DayOfWeek` | **0.75%** | Intra-week demand cyclicality |
| 10 | `Lag_7` | **0.55%** | Same-weekday prior week sales |

---

## 📁 Repository Structure

```text
├── .gitignore
├── README.md
├── SRS_v1.0_22515500047_Smart_inventory_.pdf
└── smart-inventory-ai/
    ├── data/
    │   ├── Online Retail.xlsx               # Raw transaction dataset (UCI)
    │   └── processed_daily_sales.csv        # Cleaned zero-filled daily sales ledger
    ├── models/
    │   └── optimized_random_forest_demand_model.joblib  # Serialized model artifact
    ├── notebooks/
    │   ├── 01_data_preprocessing.ipynb      # Cleaning, UK filtering, calendar grid creation
    │   ├── 02_baseline.ipynb                # Target definition (Future7DayDemand) & baselines
    │   ├── 03_feature_engineering_random_forest.ipynb # Feature creation & initial RF model
    │   └── 04_model_experimentation.ipynb  # Hyperparameter tuning, validation & test holdout
    └── results/
        ├── optimized_random_forest_feature_importance.csv
        ├── optimized_random_forest_final_comparison.csv
        ├── optimized_random_forest_test_predictions.csv
        ├── random_forest_experiment_results.csv
        ├── random_forest_predictions.csv
        └── random_forest_results.csv
```

---

## 🛠️ Portable Execution & Path Resolution

All notebooks utilize **portable, dynamic path resolution** (`pathlib.Path`). There are **no machine-specific or hardcoded user paths**, allowing seamless execution whether run:
1. Directly within JupyterLab / VS Code Notebook editor (`smart-inventory-ai/notebooks/`).
2. From the project root (`./`) or `smart-inventory-ai/`.
3. In headless/CI environments via `nbconvert` or python scripts.

### Quickstart

1. **Clone repository and install dependencies**:
   ```bash
   git clone <repo-url>
   cd "main project"
   pip install pandas numpy scikit-learn openpyxl matplotlib joblib jupyter nbconvert
   ```

2. **Run Notebooks in Sequence**:
   - `01_data_preprocessing.ipynb`: Processes raw transactions into a daily demand ledger.
   - `02_baseline.ipynb`: Establishes Level 0 and Level 1 benchmarks.
   - `03_feature_engineering_random_forest.ipynb`: Constructs feature space and initial model.
   - `04_model_experimentation.ipynb`: Runs validation search and serializes final model artifact.

3. **Inference with Saved Model**:
   ```python
   import joblib

   # Load model artifact
   artifact = joblib.load("smart-inventory-ai/models/optimized_random_forest_demand_model.joblib")
   model = artifact["model"]
   features = artifact["feature_columns"]

   print("Model loaded successfully. Features:", features)
   ```
