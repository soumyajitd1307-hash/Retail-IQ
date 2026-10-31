# Retail IQ — Role B Exploratory Data Analysis Report

**Author:** Role B (Features Lead)  
**Branch:** `Souvik`  
**Date:** October 31, 2026  
**Dataset Analyzed:** `customer_features.csv` (200 customer profiles, 10 engineered features)  
**Artifacts Location:** `outputs/`

---

## 1. Executive Summary

This report delivers the exploratory data analysis (EDA) of the ten engineered customer features constructed for the Retail IQ intelligence platform. 

The analysis reveals meaningful variance across customer purchase recency, basket size, promotional dependency, and product breadth. Clear behavioral signals emerge—including a highly polarized discount engagement pattern, strong linkage between repeat purchasing and multi-category exploration, and pronounced spending drift over the six-month observation window.

> [!NOTE]
> In accordance with project boundaries, this report focuses purely on univariate distributions, bivariate relationships, and behavioral patterns. Customer clustering, segmentation, and machine learning models are strictly reserved for Role C.

---

## 2. Descriptive Statistics Summary

The table below presents the central tendencies, dispersion, and range for all ten customer features across the 200 customer profiles:

| Feature Name | Count | Mean | Std Dev | Min | 25% | Median (50%) | 75% | Max |
|---|---|---|---|---|---|---|---|---|
| `recency_days` | 200 | 48.04 | 36.69 | 1.00 | 14.00 | 40.00 | 75.25 | 163.00 |
| `frequency` | 200 | 18.74 | 11.74 | 3.00 | 7.00 | 18.00 | 27.00 | 45.00 |
| `monetary` ($) | 200 | 20,685.36 | 19,467.12 | 902.82 | 4,927.34 | 14,283.50 | 30,316.43 | 75,582.94 |
| `avg_order_value` ($) | 200 | 939.09 | 432.06 | 225.51 | 624.26 | 875.20 | 1,256.63 | 2,043.68 |
| `offer_dependency` | 200 | 0.3617 | 0.3055 | 0.0000 | 0.0741 | 0.2967 | 0.6667 | 1.0000 |
| `avg_discount_pct` (%) | 200 | 9.49 | 11.00 | 0.00 | 0.78 | 4.51 | 17.47 | 35.28 |
| `repeat_rate` | 200 | 0.9058 | 0.0818 | 0.6667 | 0.8571 | 0.9444 | 0.9630 | 0.9778 |
| `category_diversity` | 200 | 5.18 | 1.20 | 2.00 | 5.00 | 6.00 | 6.00 | 6.00 |
| `spend_trend` (%) | 199 | -33.66 | 52.31 | -100.00 | -76.41 | -39.93 | 2.52 | 164.13 |
| `promo_lift` (%) | 177 | -15.24 | 34.78 | -75.05 | -35.90 | -24.07 | 1.59 | 167.08 |

*Note: `spend_trend` has 1 undefined customer (`C0082`); `promo_lift` has 23 undefined customers (20 zero-discount, 3 discount-only).*

---

## 3. Univariate Feature Distributions

Visual plots for all distributions are stored in `outputs/`. Key takeaways from each distribution include:

### A. Customer Spending (`monetary` & `avg_order_value`)
* **Reference Plot:** `outputs/customer_spending_distribution.png`
* **Monetary Spend:** The monetary distribution displays severe positive skewness ($\text{mean} = \$20,685$, $\text{median} = \$14,283$). The top 25% of customers spend between $\$30,316$ and $\$75,583$, generating the vast majority of retail revenue.
* **Average Order Value (AOV):** AOV is moderately right-skewed, ranging from $\$225.51$ up to $\$2,043.68$ per order. This indicates that customer value is driven by both high order frequency and elevated ticket size.

### B. Order Frequency (`frequency`) & Recency (`recency_days`)
* **Reference Plots:** `outputs/frequency_distribution.png`, `outputs/recency_distribution.png`
* **Frequency:** Spans from 3 orders to 45 orders. The distribution is multi-modal, reflecting distinct customer operational cadences (e.g. occasional buyers clustering around 3–7 orders vs. highly active purchasers clustering around 25–40 orders).
* **Recency:** Median recency is 40 days, but 25% of the customer base has not transacted in over 75 days (maximum 163 days). This segment exhibits clear churn/dormancy risk.

### C. Promotional Dependency (`offer_dependency` & `avg_discount_pct`)
* **Reference Plot:** `outputs/offer_dependency_distribution.png`
* **Bimodal Polarization:** The customer base exhibits distinct attitudes toward promotions:
  - **Full-Price Loyalists:** 20 customers have an `offer_dependency` of exactly 0.0000 (never transacting on promotion).
  - **Discount Maximizers:** 3 customers have an `offer_dependency` of 1.0000 (purchasing exclusively during sales), with the top quartile exhibiting offer dependencies exceeding 66.7%.
* **Average Discount:** Across all orders, the mean customer discount is 9.49%, though discount-sensitive customers achieve personal order averages exceeding 35%.

### D. Merchandise Breadth (`category_diversity`)
* **Reference Plot:** `outputs/category_diversity_distribution.png`
* **High Category Cross-Over:** Over 62% of customers (124 out of 200) have purchased across all 6 merchandise categories (`Home & Kitchen`, `Electronics`, `Grocery`, `Beauty`, `Sports`, `Clothing`).
* **Minimum Diversity:** Even the least diverse customer purchased from 2 distinct product lines.

### E. Dynamic Spend Drift (`spend_trend`)
* **Reference Plot:** `outputs/spend_trend_and_promo_lift.png`
* **General Deceleration:** The median spend trend is $-39.93\%$, indicating an overall spending contraction in Trimester 2 (Aug–Oct) compared to Trimester 1 (May–Jul).
* **Churned Customers:** 27 customers experienced a $-100.0\%$ spend trend (no purchases in Trimester 2).
* **Growth Cohort:** Conversely, a resilient subset of customers increased spending by up to $+164.13\%$.

### F. Promotional Lift (`promo_lift`)
* **Reference Plot:** `outputs/spend_trend_and_promo_lift.png`
* **Net Paid Impact:** Among the 177 customers with both discounted and full-price orders, median promotional lift is $-24.07\%$ when measured on net paid amount. Because promotional transactions apply an average discount of $\sim 27\%$, the net order total is frequently lower than full-price baseline orders unless basket volume increases substantially.
* **High-Lift Outliers:** A select cohort exhibited substantial volume expansion under promotion, reaching promotional lifts up to $+167.08\%$.

---

## 4. Bivariate Relationships & Correlation Analysis

* **Reference Plot:** `outputs/correlation_heatmap.png`

The Pearson correlation matrix among all ten numerical features reveals several key relationships:

```
                    recency_days  frequency  monetary  avg_order_value  offer_dependency  avg_discount_pct  repeat_rate  category_diversity  spend_trend  promo_lift
recency_days               1.000     -0.507    -0.485           -0.328             0.044            -0.145       -0.434              -0.323       -0.674       0.083
frequency                 -0.507      1.000     0.903            0.612            -0.357            -0.223        0.802               0.727        0.187      -0.064
monetary                  -0.485      0.903     1.000            0.839            -0.515            -0.400        0.637               0.572        0.210      -0.001
avg_order_value           -0.328      0.612     0.839            1.000            -0.508            -0.430        0.436               0.402        0.153      -0.022
offer_dependency           0.044     -0.357    -0.515           -0.508             1.000             0.942       -0.062              -0.044        0.031      -0.211
avg_discount_pct          -0.145     -0.223    -0.400           -0.430             0.942             1.000        0.070               0.087        0.171      -0.253
repeat_rate               -0.434      0.802     0.637            0.436            -0.062             0.070        1.000               0.892        0.148      -0.167
category_diversity        -0.323      0.727     0.572            0.402            -0.044             0.087        0.892               1.000        0.123      -0.178
spend_trend               -0.674      0.187     0.210            0.153             0.031             0.171        0.148               0.123        1.000      -0.009
promo_lift                 0.083     -0.064    -0.001           -0.022            -0.211            -0.253       -0.167              -0.178       -0.009       1.000
```

### Key Statistical Insights:

1. **Volume Drives Total Spend ($r = +0.903$):**  
   `frequency` and `monetary` are nearly collinear. Customers who purchase frequently contribute the overwhelming share of revenue, with order value ($r = +0.839$) playing a secondary complementary role.
2. **Promotional Metrics High Redundancy ($r = +0.942$):**  
   `offer_dependency` and `avg_discount_pct` exhibit near-perfect alignment. Customers who buy on promotion frequently also receive steeper percentage discounts. Role C should consider dimensionality reduction (PCA) or feature regularization to prevent multi-collinearity.
3. **High-Value Customers Eschew Discounts ($r = -0.515$ with Monetary; $r = -0.508$ with AOV):**  
   Customers with the highest cumulative spend and largest average order values exhibit significantly lower offer dependency. This highlights a high-margin premium segment that does not require discounting incentives.
4. **Repeat Purchases Unlock Category Breadth ($r = +0.892$):**  
   `repeat_rate` and `category_diversity` are strongly positively correlated. As customer relationship longevity and order count increase, they organically expand cross-category adoption across the product catalog.
5. **Dormancy Predicts Sharp Deceleration ($r = -0.674$):**  
   `recency_days` strongly negatively correlates with `spend_trend`. Customers with high recency days (long time since last transaction) experienced severe negative spend trends, providing an early-warning signal for customer attrition.

---

## 5. Visual Artifact Index

All generated visual assets are rendered at 300 DPI and available in `outputs/`:
- `customer_spending_distribution.png`: Histogram & KDE of Monetary and AOV.
- `frequency_distribution.png`: Distribution of order counts per customer.
- `recency_distribution.png`: Recency in days relative to snapshot date.
- `offer_dependency_distribution.png`: Bimodal discount adoption and average discount percentage.
- `category_diversity_distribution.png`: Distribution of merchandise category penetration.
- `spend_trend_and_promo_lift.png`: Trimester spend changes and promotional AOV lift.
- `correlation_heatmap.png`: Full masked triangular correlation matrix.
- `feature_summary_grid.png`: Multi-panel 10-feature distribution dashboard.
