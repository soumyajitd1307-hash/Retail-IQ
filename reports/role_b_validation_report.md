# Retail IQ — Role B Validation & Quality Assurance Report

**Author:** Role B (Features Lead)  
**Branch:** `Souvik`  
**Execution Date:** October 31, 2026  
**Input Dataset:** `data/transactions_clean.csv` (Role A output)  
**Output Dataset:** `customer_features.csv` (Role B deliverable)  
**Fixed Snapshot Date:** October 30, 2026 (`2026-10-30`)

---

## 1. Executive Summary

This report documents the comprehensive validation and quality verification suite executed on the engineered customer features dataset (`customer_features.csv`). 

All **14 automated validation checks** and **all 11 integration test suites** passed with a **100% success rate**. 
Total monetary value was reconciled to the exact penny ($4,137,071.75). The final output contains exactly **200 customer rows** and **11 columns** (`customer_id` plus the 10 required features). Synthetic target `persona_true` is strictly excluded to prevent target leakage into Role C's segmentation pipeline.

---

## 2. Input Data Quality Verification

Before executing feature transformations, the input dataset `data/transactions_clean.csv` was subjected to pre-flight data audits:

| Audit Parameter | Expected Baseline | Observed Value | Status |
|---|---|---|---|
| **Total Cleaned Transactions** | 3,748 rows | 3,748 rows | PASS |
| **Unique Customer Count** | 200 customers | 200 customers | PASS |
| **Unique Order Count** | 3,748 orders | 3,748 orders | PASS |
| **Duplicate `order_id` Records** | 0 duplicates | 0 duplicates | PASS |
| **Negative Amounts (`amount < 0`)** | 0 rows | 0 rows | PASS |
| **Zero Amounts (`amount == 0`)** | 0 rows | 0 rows | PASS |
| **Non-positive Quantities** | 0 rows | 0 rows | PASS |
| **Invalid Date Formats** | 0 rows | 0 rows | PASS |
| **Observation Date Span** | May 1, 2026 – Oct 29, 2026 | 2026-05-01 to 2026-10-29 | PASS |

---

## 3. Automated Feature Validation Check Results

The automated validator `validate_engineered_features()` produced the following results across all quality criteria:

| Check # | Quality Assertion | Expected Value | Observed Result | Pass / Fail |
|---|---|---|---|---|
| 1 | **Row Count Reconciliation** | 200 rows | 200 rows | **PASS** |
| 2 | **Customer ID Uniqueness** | 200 unique IDs | 200 unique IDs (0 duplicates) | **PASS** |
| 3 | **Required Columns Present** | 10 features + `customer_id` | All 11 columns present in exact order | **PASS** |
| 4 | **Target Leakage Prevention** | `persona_true` absent | `persona_true` excluded | **PASS** |
| 5 | **Monetary Reconciliation** | Total $\Delta < \$1.00$ | Raw: $4,137,071.75, Feat: $4,137,071.75 ($\Delta = \$0.00$) | **PASS** |
| 6 | **Recency Validity** | $\ge 0$ days | Min: 1 day, Max: 163 days | **PASS** |
| 7 | **Frequency Positivity** | $\ge 1$ order | Min: 3 orders, Max: 45 orders | **PASS** |
| 8 | **AOV Mathematical Match** | $\text{AOV} = \text{monetary} / \text{frequency}$ | Max $\Delta < 0.0001$ across all customers | **PASS** |
| 9 | **Offer Dependency Bounded** | $[0.0, 1.0]$ | Min: 0.0000, Max: 1.0000 | **PASS** |
| 10 | **Avg Discount Pct Bounded** | $[0.0, 100.0]$ | Min: 0.00%, Max: 35.28% | **PASS** |
| 11 | **Repeat Rate Bounded** | $[0.0, 1.0)$ | Min: 0.6667, Max: 0.9778 | **PASS** |
| 12 | **Category Diversity Positivity**| $\ge 1$ category | Min: 2 categories, Max: 6 categories | **PASS** |
| 13 | **Spend Trend Undefined Isolation**| Exactly customers with $P_1 = \$0$ | Exactly 1 customer (`C0082`) is NaN | **PASS** |
| 14 | **Promo Lift Undefined Isolation** | Exactly customers missing a group | Exactly 23 customers are NaN (20 no-promo, 3 promo-only) | **PASS** |

---

## 4. Manual Customer Calculation Verification

To audit feature calculations against raw transaction logs, we selected three representative customers exhibiting distinct behavioral patterns and edge cases:

---

### Customer 1: `C0001` (Multi-Channel Standard Buyer)

#### Raw Transaction Summary
* **Total Transactions:** 5 orders
* **Dates:** `2026-05-22`, `2026-07-05`, `2026-07-14`, `2026-07-18`, `2026-09-04`
* **Categories:** Home & Kitchen (2), Grocery (2), Clothing (1)
* **Amounts:** $580.09, $730.08, $520.17, $890.22, $1306.64
* **Discounts:** 1 order discounted (Order `O000005` on `2026-09-04`: 18.87% discount)

#### Calculation Walk-Through
1. **`recency_days`:** Latest order date is September 4, 2026 (`2026-09-04`).  
   Snapshot date: October 30, 2026 (`2026-10-30`).  
   $$\text{Days} = 2026\text{-}10\text{-}30 - 2026\text{-}09\text{-}04 = \mathbf{56\text{ days}}.$$
2. **`frequency`:** 5 unique `order_id` values $\rightarrow \mathbf{5}$.
3. **`monetary`:** $580.09 + 730.08 + 520.17 + 890.22 + 1306.64 = \mathbf{\$4,027.20}$.
4. **`avg_order_value`:** $\$4,027.20 / 5 = \mathbf{\$805.44}$.
5. **`offer_dependency`:** 1 discounted order out of 5 orders = $1 / 5 = \mathbf{0.2000}$.
6. **`avg_discount_pct`:** $(0 + 0 + 0 + 0 + 18.87) / 5 = \mathbf{3.7740\%}$.
7. **`repeat_rate`:** $(5 - 1) / 5 = \mathbf{0.8000}$.
8. **`category_diversity`:** 3 distinct categories (Home & Kitchen, Grocery, Clothing) $\rightarrow \mathbf{3}$.
9. **`spend_trend`:**  
   - Trimester 1 (May–Jul): $580.09 + 730.08 + 520.17 + 890.22 = \$2,720.56$.  
   - Trimester 2 (Aug–Oct): $\$1,306.64$.  
   $$\text{spend\_trend} = \left( \frac{1,306.64 - 2,720.56}{2,720.56} \right) \times 100 = \mathbf{-51.9717\%}.$$
10. **`promo_lift`:**  
    - $\text{AOV}_{\text{discounted}} = \$1,306.64$ (1 order).  
    - $\text{AOV}_{\text{non-discounted}} = (580.09 + 730.08 + 520.17 + 890.22) / 4 = \$680.14$.  
    $$\text{promo\_lift} = \left( \frac{1,306.64 - 680.14}{680.14} \right) \times 100 = \mathbf{+92.1134\%}.$$

**Engineered Table Match:** Exactly matches row in `customer_features.csv` (`[C0001, 56, 5, 4027.20, 805.44, 0.20, 3.774, 0.80, 3, -51.9717, 92.1134]`).

---

### Customer 2: `C0002` (High-Value Full-Price Buyer / Zero Discounts Edge Case)

#### Raw Transaction Summary
* **Total Transactions:** 42 orders spanning `2026-05-04` to `2026-10-19`.
* **Discounts:** 0 discounted orders across all 42 transactions (`is_discounted == 0` for 100% of orders).
* **Categories:** All 6 categories purchased.
* **Total Spend:** $69,446.21.

#### Calculation Walk-Through
1. **`recency_days`:** Latest order on `2026-10-19`.  
   $$2026\text{-}10\text{-}30 - 2026\text{-}10\text{-}19 = \mathbf{11\text{ days}}.$$
2. **`frequency`:** 42 orders $\rightarrow \mathbf{42}$.
3. **`monetary`:** $\mathbf{\$69,446.21}$.
4. **`avg_order_value`:** $\$69,446.21 / 42 = \mathbf{\$1,653.4812}$.
5. **`offer_dependency`:** 0 discounted orders / 42 = $\mathbf{0.0000}$.
6. **`avg_discount_pct`:** $\mathbf{0.0000\%}$.
7. **`repeat_rate`:** $(42 - 1) / 42 = \mathbf{0.9762}$.
8. **`category_diversity`:** 6 distinct categories $\rightarrow \mathbf{6}$.
9. **`spend_trend`:**  
   - $P_1$ Spend: $\$42,947.33$.  
   - $P_2$ Spend: $\$26,498.88$.  
   $$\text{spend\_trend} = \left( \frac{26,498.88 - 42,947.33}{42,947.33} \right) \times 100 = \mathbf{-38.2991\%}.$$
10. **`promo_lift`:** Since `C0002` has **0 discounted transactions**, $\text{AOV}_{\text{discounted}}$ is null.  
    $$\text{promo\_lift} = \mathbf{NaN\text{ (Undefined)}}.$$

**Engineered Table Match:** Exactly matches row in `customer_features.csv`. Promo lift is preserved as `NaN` and not corrupted to zero.

---

### Customer 3: `C0082` (Late-Onboarding Edge Case / Zero Denominator Trend)

#### Raw Transaction Summary
* **Total Transactions:** 5 orders
* **Dates:** `2026-08-06`, `2026-08-07`, `2026-08-25`, `2026-08-29`, `2026-09-13`
* **Observation:** Customer's earliest transaction occurred on August 6, 2026. Therefore, customer had **$0.00 spend** in Trimester 1 (May–July 2026).
* **Total Spend:** $2,080.96 (all in Trimester 2).

#### Calculation Walk-Through
1. **`recency_days`:** Latest order on `2026-09-13`.  
   $$2026\text{-}10\text{-}30 - 2026\text{-}09\text{-}13 = \mathbf{47\text{ days}}.$$
2. **`frequency`:** 5 orders $\rightarrow \mathbf{5}$.
3. **`monetary`:** $\mathbf{\$2,080.96}$.
4. **`avg_order_value`:** $\$2,080.96 / 5 = \mathbf{\$416.1920}$.
5. **`offer_dependency`:** 1 discounted order out of 5 = $\mathbf{0.2000}$.
6. **`avg_discount_pct`:** $(24.04 + 0 + 0 + 0 + 0) / 5 = \mathbf{4.8080\%}$.
7. **`repeat_rate`:** $(5 - 1) / 5 = \mathbf{0.8000}$.
8. **`category_diversity`:** 4 distinct categories $\rightarrow \mathbf{4}$.
9. **`spend_trend`:**  
   - $P_1$ Spend: $\$0.00$.  
   - $P_2$ Spend: $\$2,080.96$.  
   $$\text{spend\_trend} = \frac{2,080.96 - 0.00}{0.00} \times 100 = \mathbf{NaN\text{ (Undefined)}}.$$
10. **`promo_lift`:**  
    - Discounted order: $\$528.46$ (1 order).  
    - Non-discounted orders (4 orders): $(\$367.29 + \$307.87 + \$751.80 + \$125.54) / 4 = \$388.125$.  
    $$\text{promo\_lift} = \left( \frac{528.46 - 388.125}{388.125} \right) \times 100 = \mathbf{+36.1572\%}.$$

**Engineered Table Match:** Exactly matches row in `customer_features.csv`. Spend trend is preserved as `NaN` and not corrupted to zero.

---

## 5. Reconciliation Summary

$$\sum_{j=1}^{200} \text{monetary}_j = \$4,137,071.75 \quad \equiv \quad \sum_{i=1}^{3748} \text{amount}_i = \$4,137,071.75$$

The reconciliation error is **$0.0000**, confirming that no transactions were dropped, misgrouped, or double-counted during feature transformation. All unit tests in `tests/test_feature_engineering.py` pass cleanly.
