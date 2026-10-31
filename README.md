# Retail-IQ

Retail-IQ is an end-to-end customer intelligence and analytics platform designed to transform raw retail transaction records into actionable customer segmentation and predictive machine learning models.

---

## Architecture & Project Structure

The project is structured into three collaborative roles:
- **Role A — Data Cleaning & Quality Assurance:** Ingests raw transactions, resolves duplicate orders, cleans anomalous entries, caps extreme outlier amounts at the 99th percentile, and standardizes categories (`data/transactions_clean.csv`).
- **Role B — Feature Engineering (Current Branch: `Souvik`):** Transforms order-level cleaned records into customer-level behavioral profiles across RFM, discount sensitivity, loyalty, category diversity, spending trends, and promotional responsiveness (`customer_features.csv`).
- **Role C — Customer Segmentation & ML Modeling:** Consumes engineered customer features for clustering, persona validation, and predictive modeling.

---

## Directory Organization

```text
Retail-IQ/
├── data/
│   ├── transactions_clean.csv      # Cleaned transaction dataset (Role A output, primary input for Role B)
│   ├── transactions_raw.csv        # Raw transaction dataset
│   ├── transactions_sample.csv     # Sample dataset
│   ├── data_dictionary.md          # Data dictionary and column definitions
│   └── cleaning_report.md          # Role A data cleaning documentation
├── notebooks/
│   └── role_b_feature_engineering.ipynb  # Comprehensive workflow, calculation, and EDA notebook
├── outputs/                        # High-resolution exploratory visualizations (300 DPI)
│   ├── category_diversity_distribution.png
│   ├── correlation_heatmap.png
│   ├── customer_spending_distribution.png
│   ├── feature_summary_grid.png
│   ├── frequency_distribution.png
│   ├── offer_dependency_distribution.png
│   ├── recency_distribution.png
│   └── spend_trend_and_promo_lift.png
├── reports/
│   ├── feature_definitions.md      # Detailed mathematical formulas and assumptions for all 10 features
│   ├── role_b_eda_report.md        # Comprehensive exploratory findings and correlation analysis
│   └── role_b_validation_report.md # Data quality audits, reconciliation, and customer walk-throughs
├── src/
│   ├── __init__.py
│   ├── feature_engineering.py      # Reusable, production-grade feature engineering pipeline
│   ├── eda_analysis.py             # Script to generate visualizations and summary stats
│   └── create_notebook.py          # Script generating the reproducible Jupyter notebook
├── tests/
│   ├── __init__.py
│   └── test_feature_engineering.py # Pytest test suite covering calculations, edge cases, and validation
├── .gitignore                      # Git ignore file for Python cache, venv, and checkpoints
├── customer_features.csv           # Final customer-level feature dataset (200 rows, 10 features)
├── pytest.ini                      # Pytest configuration
├── requirements.txt                # Project dependencies
└── README.md                       # Project overview, installation, and execution instructions
```

---

## Role B — Customer Feature Engineering

### The Ten Engineered Customer Features

The pipeline processes 3,748 transaction records for 200 distinct customers, computing exactly one customer profile per row:

| Feature Name | Dimension | Formula / Description | Range in Data |
|---|---|---|---|
| `recency_days` | RFM | Days from latest transaction to snapshot date (`2026-10-30`) | 1 to 163 days |
| `frequency` | RFM | Count of unique orders (`order_id`) placed by customer | 3 to 45 orders |
| `monetary` | RFM | Total spend (paid amount after discount) across all transactions | $902.82 to $75,582.94 |
| `avg_order_value` | RFM | Monetary spend divided by frequency | $225.51 to $2,043.68 |
| `offer_dependency` | Discount | Proportion of unique orders with applied discount (`is_discounted == 1`) | 0.0000 to 1.0000 |
| `avg_discount_pct` | Discount | Average discount percentage across all customer orders | 0.00% to 35.28% |
| `repeat_rate` | Loyalty | Six-month repeat rate: `(frequency - 1) / frequency` | 0.6667 to 0.9778 |
| `category_diversity` | Merchandise | Count of distinct merchandise categories purchased (excluding `Unknown`) | 2 to 6 categories |
| `spend_trend` | Dynamics | % change in spend from Trimester 1 (May–Jul) to Trimester 2 (Aug–Oct) | -100.0% to +164.13% (1 NaN) |
| `promo_lift` | Promotion | % difference in AOV between discounted and non-discounted orders | -75.05% to +167.08% (23 NaNs) |

### Key Governance & Methodology Rules:
1. **Target Leakage Prevention:** `persona_true` is synthetic ground truth used strictly for downstream validation. It is **never** used as an input feature and is excluded from `customer_features.csv`.
2. **Order-Level Accuracy:** `order_id` is used strictly for deduplication and unique-order counting, not as a numerical feature.
3. **Strict Monetary Reconciliation:** The sum of customer-level `monetary` ($4,137,071.75) matches the transaction-level `amount` sum to the exact cent ($0.00 difference).
4. **Preservation of Undefined Values:** Zero denominators are strictly preserved as `NaN`, never silently imputed as zero:
   - `spend_trend`: `C0082` joined in Trimester 2 (Period 1 spend = $0); `spend_trend` is `NaN`.
   - `promo_lift`: Customers lacking either discounted orders (20 customers) or non-discounted orders (3 customers) have `promo_lift` preserved as `NaN`.

---

## Installation & Setup

### 1. Clone the Repository & Checkout Branch
```bash
git clone https://github.com/soumyajitd1307-hash/Retail-IQ.git
cd Retail-IQ
git checkout Souvik
```

### 2. Set Up Virtual Environment & Install Dependencies
```bash
python -m venv .venv

# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# On macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
```

---

## Execution Guide

### 1. Run the Feature Engineering Pipeline
To process `data/transactions_clean.csv` and generate `customer_features.csv`:
```bash
python src/feature_engineering.py
```
*(Optionally provide custom input and output paths: `python src/feature_engineering.py <input_path> <output_path>`)*

### 2. Run the Test Suite
To verify feature calculations, edge case handling, and validation assertions:
```bash
pytest -v
```

### 3. Generate Exploratory Visualizations
To produce the descriptive statistics and high-resolution plots in `outputs/`:
```bash
python src/eda_analysis.py
```

### 4. Open the Interactive Notebook
To explore the analysis interactively:
```bash
jupyter notebook notebooks/role_b_feature_engineering.ipynb
```

---

## Hand-off to Role C (Customer Segmentation & ML)

Role C can directly ingest `customer_features.csv` for clustering and modeling:

```python
import pandas as pd

features_df = pd.read_csv("customer_features.csv")
print(features_df.shape)  # (200, 11)
```

For detailed guidance on missing value imputation, scaling recommendations, and mathematical definitions, refer to:
- [`reports/feature_definitions.md`](reports/feature_definitions.md)
- [`reports/role_b_validation_report.md`](reports/role_b_validation_report.md)
- [`reports/role_b_eda_report.md`](reports/role_b_eda_report.md)
