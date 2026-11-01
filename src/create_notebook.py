"""
Generates the comprehensive Jupyter Notebook for Role B Feature Engineering.
"""

import json
import os

notebook_cells = []

def add_markdown(source):
    notebook_cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": source.strip().split("\n")
    })

def add_code(source):
    # Ensure lines have proper newlines
    lines = [line + "\n" for line in source.strip().split("\n")]
    if lines:
        lines[-1] = lines[-1].rstrip("\n")
    notebook_cells.append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": lines
    })

# Cell 1: Header
add_markdown("""
# Retail IQ — Customer Feature Engineering Pipeline (Role B)
**Author:** Role B (Features Lead)  
**Branch:** `Souvik`  
**Snapshot Date:** October 30, 2026 (`2026-10-30`)  
**Input Data:** `data/transactions_clean.csv` (3,748 cleaned transactions, 200 unique customers)  
**Output Data:** `customer_features.csv` (200 customer profiles, 10 engineered features)

---

## Overview & Analytical Scope
This notebook implements the end-to-end customer feature engineering pipeline for Retail IQ. It transforms transaction-level sales data into a high-dimensional, customer-level representation designed for downstream customer segmentation and ML modeling (Role C).

### Analytical Notes on Currency and Promotion Exposure:
- **Currency:** As documented in `data/data_dictionary.md`, financial columns (`amount`, `discount_amount`) record monetary value without an explicitly specified fiat currency (neither USD nor INR). All financial values are treated strictly as standardized monetary / currency units.
- **Promotional Lift Methodology:** No promotional campaign calendar table exists in the dataset. Consequently, `promo_lift` calculates the observed difference in Average Order Value (AOV) between discounted transactions (`is_discounted == 1`) and non-discounted transactions (`is_discounted == 0`), capturing observed pricing sensitivity rather than causal campaign effectiveness.

### The Ten Required Customer Features:
1. **Recency Days (`recency_days`):** Days elapsed from customer's latest order to the fixed snapshot date (`2026-10-30`).
2. **Frequency (`frequency`):** Count of unique orders (`order_id`) placed by the customer.
3. **Monetary (`monetary`):** Total amount spent (net paid amount after discount) across all transactions in currency units.
4. **Average Order Value (`avg_order_value`):** Monetary spend divided by frequency in currency units.
5. **Offer Dependency (`offer_dependency`):** Fraction of unique orders that utilized a promotion/discount.
6. **Average Discount Percentage (`avg_discount_pct`):** Mean percentage discount across all customer orders.
7. **Repeat Rate (`repeat_rate`):** Six-month repeat purchase ratio `(frequency - 1) / frequency`.
8. **Category Diversity (`category_diversity`):** Count of distinct product merchandise categories purchased (excluding `Unknown`).
9. **Spending Trend (`spend_trend`):** Percentage change in spending between Trimester 1 (May–Jul 2026) and Trimester 2 (Aug–Oct 2026).
10. **Promotional Lift (`promo_lift`):** Percentage difference in AOV between discounted and non-discounted orders.
""")

# Cell 2: Imports
add_code("""import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Ensure reproducibility and plotting style
sns.set_theme(style="whitegrid", palette="muted")
plt.rcParams["figure.figsize"] = (10, 6)
pd.set_option("display.max_columns", 15)
pd.set_option("display.width", 1000)

from src.feature_engineering import (
    load_and_preprocess_transactions,
    compute_rfm_features,
    compute_discount_features,
    compute_loyalty_features,
    compute_category_diversity,
    compute_spending_trend,
    compute_promotional_lift,
    build_customer_features,
    validate_input_transactions,
    validate_engineered_features,
    export_customer_features,
    DEFAULT_SNAPSHOT_DATE,
    FINAL_COLUMNS,
)
print("Pipeline modules successfully imported!")
""")

# Cell 3: Markdown - Data Loading
add_markdown("""
## 1. Data Ingestion & Preprocessing
We ingest `data/transactions_clean.csv`, which was produced by Role A.
- Date format is `DD/MM/YY` and parsed to `datetime64[ns]`.
- Numeric fields (`amount`, `quantity`, `discount_percent`) are cast to standard types.
""")

# Cell 4: Code - Data Loading
add_code("""DATA_FILE = "../data/transactions_clean.csv" if not os.path.exists("data/transactions_clean.csv") else "data/transactions_clean.csv"
raw_df = load_and_preprocess_transactions(DATA_FILE)

print(f"Transactions Shape: {raw_df.shape}")
print(f"Unique Customers: {raw_df['customer_id'].nunique()}")
print(f"Unique Orders: {raw_df['order_id'].nunique()}")
raw_df.head()
""")

# Cell 5: Markdown - Input Validation
add_markdown("""
## 2. Input Data Quality Verification
Before transforming transactions, we execute pre-flight integrity checks to ensure zero data corruption.
""")

# Cell 6: Code - Input Validation
add_code("""input_val = validate_input_transactions(raw_df)
for check, result in input_val.items():
    print(f"  {check:<25}: {result}")
""")

# Cell 7: Markdown - Feature Engineering Execution
add_markdown("""
## 3. Modular Feature Engineering Pipeline
We run the modular feature blocks to calculate the 10 customer features.

### Mathematical Definitions & Edge Case Handling:
- **RFM:** Snapshot is fixed at `2026-10-30`. Latest transaction in data is `2026-10-29` (min recency = 1 day).
- **Discounts:** Distinguishes full-price orders from promotional orders.
- **Loyalty:** All 200 customers have $\\ge 3$ transactions, ensuring well-defined repeat rates.
- **Diversity:** `Unknown` category (1 occurrence in `C0200`) is excluded by default so missing data is not counted as a genuine product category.
- **Spend Trend:** Compares Trimester 1 (May–Jul) and Trimester 2 (Aug–Oct). Customer `C0082` joined in Trimester 2 (Period 1 spend = 0 units); the denominator is zero, so `spend_trend` is explicitly preserved as `NaN`.
- **Promo Lift:** Measures $((AOV_{disc} - AOV_{nondisc}) / AOV_{nondisc}) \\times 100$. Exactly 23 customers lack one comparison group (20 customers have 0 discounts, 3 customers have 100% discounts); their lift is explicitly preserved as `NaN`.
""")

# Cell 8: Code - Feature Engineering
add_code("""# Run the end-to-end customer feature builder
features_df = build_customer_features(raw_df, snapshot_date=DEFAULT_SNAPSHOT_DATE)
print(f"Features Table Shape: {features_df.shape}")
features_df.head(10)
""")

# Cell 9: Markdown - Validation & Reconciliation
add_markdown("""
## 4. Rigorous Quality Checks & Source Data Reconciliation
We validate:
1. One record per customer.
2. Complete absence of synthetic target `persona_true`.
3. Strict monetary reconciliation: sum of customer `monetary` matches transaction `amount` sum.
4. Correct isolation of undefined/NaN values.
""")

# Cell 10: Code - Validation
add_code("""validation_results = validate_engineered_features(features_df, raw_df)

print(f"All Validation Checks Passed: {validation_results['all_validation_checks_passed']}")
print(f"Total Transactions Amount:   {validation_results['transaction_total_amount']:,.2f} units")
print(f"Total Customer Monetary Sum: {validation_results['feature_total_monetary']:,.2f} units")
print(f"Reconciliation Discrepancy:  {validation_results['monetary_discrepancy']:,.4f} units")
print(f"Undefined Spend Trend Count: {validation_results['undefined_spend_trend_count']} (Customer: {validation_results['undefined_spend_trend_customers']})")
print(f"Undefined Promo Lift Count:  {validation_results['undefined_promo_lift_count']}")
""")

# Cell 11: Markdown - Manual Customer Verification
add_markdown("""
## 5. Manual Customer Calculation Verification
To verify mathematical accuracy, we trace 3 distinct customer profiles:
- **`C0001`:** Typical multi-channel purchaser with both discounted and full-price orders.
- **`C0002`:** Loyal full-price buyer (0.0 offer dependency, undefined promo lift).
- **`C0082`:** Late-onboarded customer (joined August 2026, zero Period 1 spend, undefined spend trend).
""")

# Cell 12: Code - Manual Verification
add_code("""def inspect_customer(cid):
    c_df = raw_df[raw_df['customer_id'] == cid]
    c_feat = features_df[features_df['customer_id'] == cid].iloc[0]
    print(f"=== Customer {cid} Verification ===")
    print(f"Transaction Count: {len(c_df)}")
    print(f"Date Range: {c_df['parsed_date'].min().date()} to {c_df['parsed_date'].max().date()}")
    print(f"Features in Table:")
    for col in FINAL_COLUMNS[1:]:
        print(f"  {col:<20}: {c_feat[col]}")
    print()

inspect_customer("C0001")
inspect_customer("C0002")
inspect_customer("C0082")
""")

# Cell 13: Markdown - EDA
add_markdown("""
## 6. Exploratory Data Analysis & Visualizations
We examine feature distributions, central tendencies, and cross-feature correlations to understand the customer base structure prior to Role C's segmentation.
""")

# Cell 14: Code - Descriptive Statistics
add_code("""# Descriptive statistics table
num_cols = [c for c in FINAL_COLUMNS if c != "customer_id"]
stats_summary = features_df[num_cols].describe().T[['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']]
stats_summary
""")

# Cell 15: Code - Correlation Heatmap
add_code("""plt.figure(figsize=(10, 8))
corr = features_df[num_cols].corr()
mask = np.triu(np.ones_like(corr, dtype=bool))
sns.heatmap(corr, mask=mask, annot=True, fmt=".2f", cmap="coolwarm", vmin=-1, vmax=1, square=True)
plt.title("Customer Feature Correlation Matrix", fontsize=14, weight="bold", pad=15)
plt.show()
""")

# Cell 16: Code - Distribution Visualizations
add_code("""fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# 1. Monetary Spend
sns.histplot(features_df["monetary"], kde=True, ax=axes[0, 0], color="#2b5c8f")
axes[0, 0].set_title("Customer Total Spend (Currency Units)")

# 2. Order Frequency
sns.histplot(features_df["frequency"], kde=True, ax=axes[0, 1], color="#2ca02c")
axes[0, 1].set_title("Customer Order Frequency")

# 3. Offer Dependency
sns.histplot(features_df["offer_dependency"], kde=True, ax=axes[1, 0], color="#9467bd")
axes[1, 0].set_title("Offer Dependency Ratio")

# 4. Spending Trend
sns.histplot(features_df["spend_trend"].dropna(), kde=True, ax=axes[1, 1], color="#bcbd22")
axes[1, 1].axvline(0, color="red", linestyle="--")
axes[1, 1].set_title("Spending Trend (% Change T2 vs T1)")

plt.tight_layout()
plt.show()
""")

# Cell 17: Markdown - Export & Role C Hand-off
add_markdown("""
## 7. Pipeline Output & Hand-off to Role C
The final customer feature table is exported to `customer_features.csv`.
- Exactly 200 rows (one per customer).
- All 10 required features present and cleanly typed.
- Ready for Role C segmentation (K-Means, RFM clustering, PCA).
""")

# Cell 18: Code - Export
add_code("""OUTPUT_PATH = "customer_features.csv"
export_customer_features(features_df, output_path=OUTPUT_PATH)
print(f"Export confirmed: {OUTPUT_PATH} exists with {len(pd.read_csv(OUTPUT_PATH))} records.")
""")

notebook_json = {
    "cells": notebook_cells,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "name": "python",
            "version": "3.13.1"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 4
}

out_notebook = "notebooks/role_b_feature_engineering.ipynb"
with open(out_notebook, "w", encoding="utf-8") as f:
    json.dump(notebook_json, f, indent=2)

print(f"Successfully generated Jupyter notebook at {out_notebook}")

