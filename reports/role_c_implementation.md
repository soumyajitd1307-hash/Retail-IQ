# Retail IQ — Role C Implementation & Integration Guide

**Author:** Role C Lead (Analytics, Validation & ML Customer Segmentation)  
**Date:** November 7, 2026  
**Status:** Completed, Verified, and Tested (24/24 Tests Passing)  
**Deliverable CSVs:** `data/segmented_customers.csv`, `data/segment_profiles.csv`, `data/segmentation_metrics.csv`

---

## 1. Overview of Created & Modified Files

### A. Source Code Modules Created:
* [`src/scoring.py`](file:///c:/projects/Retail-IQ/src/scoring.py): Continuous behavioral scoring engines:
  - `compute_rfm_loyalty_score()`: Weighted RFM index with theoretical bounds $[0.00, 100.00]$ (observed empirical range: **1.76 to 98.70**). Normalizes against cohort min-max bounds (cohort-relative).
  - `compute_offer_sensitivity_score()`: Decoupled discount incidence and depth score with theoretical bounds $[0.00, 100.00]$ (observed empirical range: **0.00 to 91.17**). Zero-discount buyers cleanly evaluate to 0.00.
* [`src/recommendations.py`](file:///c:/projects/Retail-IQ/src/recommendations.py): Explainable, rule-based recommendation logic:
  - `generate_customer_recommendation()`: Tailors actions per customer profile.
  - `generate_segment_strategic_playbook()`: Generates executive strategies per segment.
  - `attach_recommendations()`: Vectorized attachment of recommendations to customer records.
* [`src/segmentation.py`](file:///c:/projects/Retail-IQ/src/segmentation.py): Unsupervised machine learning segmentation engine:
  - `load_and_preprocess_customer_features()`: Transforms features and handles explicit median imputation.
  - `build_candidate_feature_matrices()`: Scales and constructs 4 benchmark candidate sets.
  - `evaluate_clustering_grid()`: Multi-metric evaluation across $K \in [2, 8]$.
  - `select_best_model()`: Multi-criterion model selector (Silhouette, Davies-Bouldin, stability).
  - `assign_dynamic_business_labels()`: Derives defensible segment labels from empirical centroids.
  - `generate_segment_profiles()`: Compiles aggregate metrics, revenue %, and playbooks.
  - `save_artifacts()`: Persists fitted K-Means models and scalers to `models/`.
* [`src/cluster_validation.py`](file:///c:/projects/Retail-IQ/src/cluster_validation.py): Post-hoc external validation engine:
  - `load_ground_truth_personas()`: Safely extracts `persona_true` from cleaned transactions.
  - `evaluate_persona_alignment()`: Computes diagnostic Adjusted Rand Index (ARI), Normalized Mutual Information (NMI), and contingency matrices.
* [`run_segmentation.py`](file:///c:/projects/Retail-IQ/run_segmentation.py): Orchestrates the entire Role C pipeline from root.

### B. Test Suites Created:
* [`tests/test_segmentation.py`](file:///c:/projects/Retail-IQ/tests/test_segmentation.py): 13 comprehensive unit and integration tests covering preprocessing, scaling, K-Means execution, score bounds, zero-discount rules, schema adherence, revenue reconciliation, and stability.

### C. Analytical Reports Created:
* [`reports/role_c_validation_report.md`](file:///c:/projects/Retail-IQ/reports/role_c_validation_report.md): Technical report detailing candidate comparisons, model selection rationale, cluster profiles, and validation metrics.
* [`reports/role_c_implementation.md`](file:///c:/projects/Retail-IQ/reports/role_c_implementation.md): This implementation guide.

### D. Deliverable Data Files Generated:
* `data/segmented_customers.csv`: 200 customer profiles with segment assignments, scores, and primary recommendations.
* `data/segment_profiles.csv`: 4 segment aggregate profiles with financial metrics and strategic playbooks.
* `data/segmentation_metrics.csv`: Complete multi-metric evaluation grid (28 models tested).
* `models/kmeans_selected_model.joblib`: Serialized optimal K-Means model ($K=4$).
* `models/scaler_selected.joblib`: Serialized StandardScaler fitted on Candidate 1 features.
* `models/model_metadata.json`: Preprocessing and centroid parameters.

### E. Existing Files Modified:
* `requirements.txt`: Added `scikit-learn>=1.3.0,<2.0.0` and `scipy>=1.11.0,<2.0.0`. Preserved all existing dependencies.

---

## 2. Pipeline Execution Instructions

To execute the complete Role C segmentation and analytics workflow from the repository root:

```bash
# Activate virtual environment
.\.venv\Scripts\Activate.ps1  # On Windows PowerShell
# or: source .venv/bin/activate # On Unix/macOS

# Run the end-to-end pipeline
python run_segmentation.py
```

To execute the entire automated test suite:

```bash
pytest -v
```

All 24 unit and integration tests pass with 100% success rate.

---

## 3. Standardized Output Schemas for Role D Dashboard

### A. Customer Intelligence Feed: `data/segmented_customers.csv`
* Exactly 200 rows (one per unique customer), sorted by `customer_id` ascending:

| Column Name | Data Type | Valid Range / Format | Description |
|---|---|---|---|
| `customer_id` | String | `C0001` – `C0200` | Primary Key |
| `cluster_id` | Integer | `0, 1, 2, 3` | Numeric cluster ID from K-Means |
| `segment_name` | String | Categorical | Business segment label (*High-Value Loyal*, etc.) |
| `loyalty_score` | Float | `0.00` to `100.00` | Continuous RFM loyalty index |
| `offer_sensitivity_score` | Float | `0.00` to `100.00` | Continuous promotional reliance index |
| `recency_days` | Integer | $\ge 0$ | Calendar days since snapshot (`2026-10-30`) |
| `frequency` | Integer | $\ge 1$ | Unique order count |
| `monetary` | Float | $\ge 0.0$ | Cumulative net spend |
| `avg_order_value` | Float | $\ge 0.0$ | Net spend per unique order |
| `offer_dependency` | Float | `0.0000` to `1.0000` | Proportion of orders placed with discount |
| `avg_discount_pct` | Float | `0.00` to `100.00` | Average discount percentage across all orders |
| `spend_trend` | Float | Percentage, `NaN` allowed | Trimester 1 to Trimester 2 spend change |
| `category_diversity` | Integer | `1` to `6` | Unique product categories purchased |
| `primary_recommendation` | String | Text | Prescriptive, explainable marketing action |

---

### B. Segment Benchmark Feed: `data/segment_profiles.csv`
* Exactly 4 rows (one per segment), sorted by `mean_monetary` descending:

| Column Name | Data Type | Description |
|---|---|---|
| `segment_name` | String | Business segment label (Unique PK) |
| `cluster_id` | Integer | Corresponding numeric cluster ID |
| `customer_count` | Integer | Number of customers in segment |
| `pct_of_customers` | Float | Segment customer percentage of total base |
| `total_revenue` | Float | Cumulative monetary spend contributed |
| `pct_of_revenue` | Float | Percentage of total enterprise revenue contributed |
| `mean_recency` | Float | Mean recency in calendar days |
| `mean_frequency` | Float | Mean order frequency |
| `mean_monetary` | Float | Mean cumulative spend |
| `mean_aov` | Float | Mean average order value |
| `mean_offer_dependency` | Float | Mean offer dependency ratio |
| `mean_loyalty_score` | Float | Mean loyalty score |
| `mean_offer_sensitivity`| Float | Mean offer sensitivity score |
| `strategic_playbook` | String | Executive-level marketing playbook guidance |

---

## 4. Reproducibility & Governance Guarantees

1. **Fixed Random Seeds:** All clustering executions utilize `random_state=42` with `n_init=50`. Cluster assignments are 100% deterministic.
2. **Zero Target Leakage:** `persona_true` is never touched by any training module. It is imported solely during post-hoc diagnostics in `src/cluster_validation.py`.
3. **Scoring Bounds & Normalization Notice:**
   - Both RFM Loyalty Score and Offer Sensitivity Score are mathematically bounded in $[0.00, 100.00]$.
   - Observed range in dataset: Loyalty Score spans **1.76 to 98.70** (Min: `C0023`, Max: `C0085`); Offer Sensitivity Score spans **0.00 to 91.17** (Min: 0.00 across 20 full-price buyers, Max: `C0121`).
   - The loyalty score currently normalizes against cohort empirical min/max bounds (cohort-relative). For longitudinal benchmarking across future quarterly dataset refreshes, fixed reference anchor bounds should be stored in `models/model_metadata.json`.
4. **Strict Financial Balance:**
   - Raw transaction total: `4,137,071.75` units
   - Customer features total: `4,137,071.75` units
   - Segment profiles total: `4,137,071.75` units
   - Discrepancy: `0.00` units.

