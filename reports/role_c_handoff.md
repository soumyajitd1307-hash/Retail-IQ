# Retail IQ — Role C Handoff & Customer Feature Integration Guide

**From:** Role B (Features Lead)  
**To:** Role C (Customer Segmentation & ML Lead)  
**Branch:** `Souvik`  
**Dataset Deliverable:** `customer_features.csv` (Located at repository root)  
**Reference Snapshot Date:** October 30, 2026 (`2026-10-30`)  
**Status:** Validated, Reconciled, and Ready for Ingestion

---

## 1. Overview of Role B Deliverables

Role B has engineered a customer-level analytical feature matrix from the 3,748 cleaned transaction records produced by Role A (`data/transactions_clean.csv`). 

Key deliverables provided for Role C include:
1. **`customer_features.csv`**: The primary customer dataset containing exactly 200 customer profiles with all 10 engineered features.
2. **`reports/feature_definitions.md`**: Complete mathematical specifications, boundary conditions, and rationale for all 10 features.
3. **`reports/role_b_validation_report.md`**: Integrity audits, source data monetary reconciliation, and manual calculation walk-throughs for representative customers.
4. **`reports/role_b_eda_report.md`**: Univariate distribution analysis, descriptive statistics, and correlation matrix.
5. **`outputs/`**: 8 publication-ready 300 DPI distribution charts and correlation heatmaps.
6. **`notebooks/role_b_feature_engineering.ipynb`**: Complete reproducible interactive workflow.
7. **`src/feature_engineering.py` & `tests/test_feature_engineering.py`**: Fully tested, modular feature generation pipeline.

> [!IMPORTANT]
> **Role Boundary Statement:**
> Customer clustering, classification, customer persona segmentation, dimensionality reduction (e.g., PCA/t-SNE), and predictive ML modeling belong exclusively to Role C. Role B provides the verified feature space without imposing any specific clustering algorithm, cluster count ($K$), or classification model.

---

## 2. Dataset Location & Loading Instructions

The primary feature matrix is stored at the repository root:
`customer_features.csv`

### Ingestion Example in Python:

```python
import pandas as pd

# Load the customer feature matrix
df = pd.read_csv("customer_features.csv")

print(df.head())
print(df.shape)
print(df.isnull().sum())
```

Expected output shape: Exactly `(200, 11)` — representing 200 unique customers across 11 columns (`customer_id` plus the 10 features).

---

## 3. Feature Definitions & Schema

| # | Column Name | Dimension | Pandas Data Type | Theoretical Range | Empirical Range in Data | Units |
|---|---|---|---|---|---|---|
| 0 | `customer_id` | Identifier | `object` (string) | `C0001`–`C0200` | 200 unique IDs | ID |
| 1 | `recency_days` | RFM | `int64` | $[0, \infty)$ | 1 to 163 | Calendar Days |
| 2 | `frequency` | RFM | `int64` | $[1, \infty)$ | 3 to 45 | Unique Orders |
| 3 | `monetary` | RFM | `float64` | $[0.0, \infty)$ | 902.82 to 75,582.94 | Currency Units |
| 4 | `avg_order_value` | RFM | `float64` | $[0.0, \infty)$ | 225.51 to 2,043.68 | Currency Units |
| 5 | `offer_dependency`| Discount | `float64` | $[0.0, 1.0]$ | 0.0000 to 1.0000 | Ratio |
| 6 | `avg_discount_pct`| Discount | `float64` | $[0.0, 100.0]$ | 0.0000 to 35.2783 | Percentage (%) |
| 7 | `repeat_rate` | Loyalty | `float64` | $[0.0, 1.0)$ | 0.6667 to 0.9778 | Ratio |
| 8 | `category_diversity`| Diversity| `int64` | $[1, 6]$ | 2 to 6 | Categories |
| 9 | `spend_trend` | Dynamics | `float64` | $(-\infty, \infty)$ | -100.0000 to +164.1254 | Percentage (%) |
| 10 | `promo_lift` | Response | `float64` | $(-\infty, \infty)$ | -75.0534 to +167.0790 | Percentage (%) |

---

## 4. Missing-Value Summary & Undefined Mechanics

The dataset exhibits zero arbitrary missing data. Null values (`NaN`) occur strictly as mathematically undefined calculations resulting from zero denominators or missing comparison groups:

| Feature | Null Count | Null % | Affected Customers | Mathematical Cause |
|---|---|---|---|---|
| `customer_id` | 0 | 0.0% | None | None |
| `recency_days` | 0 | 0.0% | None | None |
| `frequency` | 0 | 0.0% | None | None |
| `monetary` | 0 | 0.0% | None | None |
| `avg_order_value` | 0 | 0.0% | None | None |
| `offer_dependency`| 0 | 0.0% | None | None |
| `avg_discount_pct`| 0 | 0.0% | None | None |
| `repeat_rate` | 0 | 0.0% | None | None |
| `category_diversity`| 0 | 0.0% | None | None |
| `spend_trend` | 1 | 0.5% | `C0082` | Zero spend in Trimester 1 ($P_1 = 0$) |
| `promo_lift` | 23 | 11.5% | 20 zero-discount customers, 3 discount-only customers | Missing comparison group ($\text{AOV}_{\text{disc}}$ or $\text{AOV}_{\text{nondisc}}$ absent) |

### Context for Undefined Values:
1. **`spend_trend` (`C0082`):** Customer `C0082` onboarded on August 6, 2026. Because their spend in May–July 2026 was exactly 0 units, dividing by zero is undefined. Rather than corrupting this into 0% or an arbitrary number, Role B preserved it as `NaN`.
2. **`promo_lift` (23 customers):**
   - 20 customers never purchased on discount (`offer_dependency == 0.0`), meaning discounted AOV does not exist.
   - 3 customers (`C0121`, `C0147`, `C0191`) purchased exclusively on discount (`offer_dependency == 1.0`), meaning full-price baseline AOV does not exist.
   - Role B avoided fabricating counterfactual order values, recording these as `NaN`.

---

## 5. Important Empirical Feature Correlations

The Pearson correlation analysis highlights key relationships that Role C should evaluate when choosing distance metrics and dimensionality reduction techniques:

* **Frequency & Monetary ($r = +0.903$):** Highly correlated. Total customer spend is predominantly volume-driven.
* **Offer Dependency & Avg Discount Pct ($r = +0.942$):** Collinear. High promo frequency customers also receive higher discount depths. In distance-based clustering (like K-Means), keeping both without scaling or PCA could give double weight to discount sensitivity.
* **Monetary & Offer Dependency ($r = -0.515$):** Moderate negative association. Highest-spending customer cohorts rely least on discount offers.
* **Repeat Rate & Category Diversity ($r = +0.892$):** Strong positive association. Repeated purchasing strongly correlates with broader category exploration across the store catalog.
* **Recency Days & Spending Trend ($r = -0.674$):** Strong negative association. Long periods of inactivity strongly correlate with negative spending momentum between Trimester 1 and Trimester 2.

*Note: All correlation figures represent observational statistical associations and do not imply causal mechanisms.*

---

## 6. Recommended Preprocessing Considerations for Role C

Role C has full autonomy over model design and data preprocessing. Below are technical recommendations based on Role B's exploratory findings:

### A. Missing Value Handling Options:
1. **Option 1: Indicator Flags + Cohort Imputation (Recommended for Tree/Distance Models):**
   - Add binary flags `missing_spend_trend`, `zero_promo_customer`, and `promo_only_customer`.
   - Impute missing values with cohort medians (`spend_trend`: $-39.93\%$, `promo_lift`: $-24.07\%$) or 0.
2. **Option 2: KNN / Iterative Imputer:**
   - Impute `promo_lift` using nearest neighbors based on `avg_order_value`, `category_diversity`, and `frequency`.
3. **Option 3: Feature Exclusion / Sub-clustering:**
   - Run core customer segmentation using the complete 8 features (RFM, Discounts, Loyalty, Diversity), and analyze `spend_trend` and `promo_lift` as secondary descriptive overlays.

### B. Feature Scaling & Transformations:
- **Skewness:** `monetary` and `frequency` exhibit heavy right-skew. Consider log transformation (`np.log1p`) or `RobustScaler` / `StandardScaler` prior to distance-based algorithms like K-Means or DBSCAN.
- **Dimensionality Reduction:** Given the high correlation between `offer_dependency` and `avg_discount_pct` ($r = 0.942$), PCA can effectively eliminate redundancy and improve cluster separation.

### C. Governance & Target Leakage Prevention:
- `persona_true` is present in the raw data but was deliberately omitted from `customer_features.csv`.
- Role C can join `persona_true` separately from `data/transactions_clean.csv` to validate unsupervised cluster alignment post-hoc (e.g. comparing K-Means clusters against ground truth personas using Adjusted Rand Index or Normalized Mutual Information).
- Never train a supervised model using `persona_true` as an input feature.

---

## 7. Known Limitations & Contextual Nuances

1. **Undocumented Currency:** The source data dictionary does not specify a fiat currency (neither USD nor INR). Amounts must be treated as standardized currency units.
2. **Observational vs. Causal Lift:** Without an explicit campaign-day calendar, `promo_lift` reflects observed pricing sensitivity, not causal campaign uplift.
3. **Six-Month Observation Window:** The transaction timeframe spans May 1, 2026 to October 29, 2026. Seasonality across annual retail cycles is truncated.
4. **Outlier Cap:** Extreme transactions were pre-capped at the 99th percentile ($3,586.83$ units) by Role A, slightly compressing maximum order values.
