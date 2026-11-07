# Retail-IQ

Retail-IQ is an end-to-end synthetic retail customer-intelligence platform. It transforms transaction records into customer-level behavioral features, discovers unsupervised customer segments, scores loyalty and promotional reliance, generates explainable recommendations, and validates the discovered segments against synthetic ground-truth personas — without ever using those personas for training.

> All customer records are synthetic (computer-generated). No real customer data is contained in this repository.

---

## 1. Project overview and roles

| Role | Scope | Primary input | Primary output |
|---|---|---|---|
| **A** — Data cleaning & QA | Deduplicate orders, remove invalid dates/amounts, cap extreme amounts, standardize categories | `data/transactions_raw.csv` | `data/transactions_clean.csv` |
| **B** — Feature engineering | Derive 10 customer-level behavioral features from cleaned transactions | `data/transactions_clean.csv` | `customer_features.csv` |
| **C** — Segmentation & ML (this branch) | Cluster customers, score behavior, label segments, recommend actions, validate post-hoc | `customer_features.csv` | `data/segmented_customers.csv`, `data/segment_profiles.csv`, `data/segmentation_metrics.csv`, `models/` |
| **D (consumer)** — Dashboarding | Consume Role C deliverables as standardized feeds | Role C CSVs | Visualizations |

Current Role C results (reproduced by `python run_segmentation.py` on the committed inputs): **Candidate 1 (Classic RFM-P) at K = 4** — Silhouette ≈ 0.58, Davies–Bouldin ≈ 0.65, stability ARI = 1.00, post-hoc persona ARI ≈ 0.99 / NMI ≈ 0.98. Business segments: **High-Value Loyal**, **Offer-Sensitive**, **At-Risk Dormant**, **Occasional Buyer**.

---

## 2. Repository structure

```text
Retail-IQ/
├── customer_features.csv          # Role B output (200 customers × 11 columns: customer_id + 10 features)
├── run_segmentation.py            # Role C end-to-end pipeline entry point
├── data/
│   ├── transactions_raw.csv
│   ├── transactions_clean.csv     # Role A output (3,748 transactions, 200 customers)
│   ├── transactions_sample.csv
│   ├── data_dictionary.md
│   ├── cleaning_report.md
│   ├── segmentation_metrics.csv   # Role C grid: 4 candidate sets × K in [2,8] (28 rows)
│   ├── segmented_customers.csv    # Role C customer feed (1 row per customer)
│   └── segment_profiles.csv       # Role C segment feed (1 row per segment)
├── models/
│   ├── kmeans_selected_model.joblib
│   ├── scaler_selected.joblib
│   └── model_metadata.json        # Full reproducibility manifest (see §7)
├── src/
│   ├── feature_engineering.py     # Role B pipeline
│   ├── segmentation.py            # Role C preprocessing, grid, selection, profiling, artifacts
│   ├── scoring.py                 # Loyalty + offer-sensitivity scores ([0,100])
│   ├── recommendations.py         # Explainable, currency-neutral recommendations
│   ├── cluster_validation.py      # Post-hoc persona validation with integrity checks
│   ├── eda_analysis.py            # Role B exploratory plots (300 DPI, outputs/)
│   └── create_notebook.py         # Reproducible notebook generator
├── tests/
│   ├── test_feature_engineering.py # Role B tests
│   ├── test_segmentation.py        # Role C pipeline tests
│   └── test_repository_audit.py    # Audit tests: variable counts, invalid inputs, metadata, persona integrity, currency
├── reports/
│   ├── feature_definitions.md
│   ├── role_b_eda_report.md
│   ├── role_b_validation_report.md
│   ├── role_c_handoff.md
│   ├── role_c_implementation.md
│   └── role_c_validation_report.md
├── outputs/                        # EDA charts (PNG, 300 DPI)
├── notebooks/
│   └── role_b_feature_engineering.ipynb
├── pytest.ini
├── requirements.txt
└── README.md
```

---

## 3. Data and feature definitions

### 3.1 Inputs

- **`data/transactions_clean.csv`** — 3,748 cleaned transactions for 200 customers (2026-05-01 → 2026-10-29). Snapshot date for recency is fixed at **2026-10-30** for reproducibility. Extreme `amount` values were capped at the 99th percentile by Role A.
- **`customer_features.csv`** — one row per customer, 10 engineered features (schema below). `persona_true` is deliberately **excluded** (see Governance, §5).

### 3.2 The ten engineered features (Role B)

| # | Feature | Dimension | Definition | Range / units |
|---|---|---|---|---|
| 1 | `recency_days` | RFM | Days from latest transaction to 2026-10-30 | 1–163 days |
| 2 | `frequency` | RFM | Count of unique `order_id`s | 3–45 orders |
| 3 | `monetary` | RFM | Sum of `amount` (paid after discount) | 902.82–75,582.94 currency units |
| 4 | `avg_order_value` | RFM | `monetary / frequency` | 225.51–2,043.68 units |
| 5 | `offer_dependency` | Discount | Share of orders with `is_discounted == 1` | 0.0–1.0 |
| 6 | `avg_discount_pct` | Discount | Mean `discount_percent` | 0–35.28 % |
| 7 | `repeat_rate` | Loyalty | `(frequency − 1) / frequency` | 0.667–0.978 |
| 8 | `category_diversity` | Merchandise | Distinct categories excluding `Unknown` | 2–6 categories |
| 9 | `spend_trend` | Dynamics | % change P1 (May–Jul) → P2 (Aug–Oct) | −100 % to +164 % (1 NaN: C0082) |
| 10 | `promo_lift` | Promotion | % AOV difference, discounted vs non-discounted | −75 % to +167 % (23 NaNs) |

Monetary columns have **no documented fiat currency** (neither USD nor INR) and are treated throughout as **generic currency units**. This is why Role C recommendations are currency-neutral by default (§6).

Undefined values are preserved as `NaN`, never silently zeroed:

- `spend_trend` is `NaN` for C0082 (joined in P2, so P1 spend = 0).
- `promo_lift` is `NaN` for 23 customers lacking either a discounted or a non-discounted comparison group.

---

## 4. Role C methodology

### 4.1 Preprocessing (`src/segmentation.py: load_and_preprocess_customer_features`)

- Validates all 11 expected columns and customer-ID uniqueness; raises on duplicates.
- `log1p(max(x, 0))` on `monetary` → `log_monetary`, `frequency` → `log_frequency`, `avg_order_value` → `log_aov` (reduces right-skew).
- `recency_days` and `offer_dependency` stay linear.
- `spend_trend` missing values are imputed with the **cohort median** (explicitly reported in `imputation_meta`); `promo_lift` is excluded from clustering and retained only for profiling.
- Four candidate feature matrices are standardized with `StandardScaler` (zero mean, unit variance per feature).

Candidate sets:

| Candidate | Features |
|---|---|
| 1 — Classic RFM-P | `recency_days`, `log_frequency`, `log_monetary`, `offer_dependency` |
| 2 — Decoupled cadence/basket | `recency_days`, `log_frequency`, `log_aov`, `offer_dependency` |
| 3 — Spend and basket | `recency_days`, `log_monetary`, `log_aov`, `offer_dependency` |
| 4 — Temporal extended | `recency_days`, `log_frequency`, `log_monetary`, `offer_dependency`, `spend_trend` |

### 4.2 Grid evaluation and model selection

- **Grid:** 4 candidate sets × K ∈ {2, …, 8} = 28 K-Means fits (`k-means++`, `n_init=50`, `max_iter=500`, `tol=1e-5`, `random_state=42`). Full results are written to `data/segmentation_metrics.csv`.
- **Metrics per configuration:** inertia, Silhouette (mean, per-cluster minimum, negative-sample count), Davies–Bouldin, Calinski–Harabasz, cluster sizes / minimum-cluster size & % , and multi-seed stability (mean pairwise ARI across seeds 42/101/202/303/404).
- **Selection:** degenerate configurations (minimum cluster < 10 customers) are filtered; remaining rows are ranked on Silhouette (max), Davies–Bouldin (min), Calinski–Harabasz (max), and stability (max) with weights 0.35 / 0.35 / 0.15 / 0.15. No K or label mapping is hardcoded.
- On the committed inputs this selects **Candidate 1 at K = 4** (Silhouette ≈ 0.58; on inspection, frequency alongside monetary sharpens boundaries, while adding `spend_trend` dilutes separation).

### 4.3 Behavioral scoring (`src/scoring.py`)

Both scores are bounded to **[0.00, 100.00]** and return no nulls.

- **RFM Loyalty Score** (`compute_rfm_loyalty_score`): `0.30·S_R + 0.35·S_F + 0.35·S_M`, where recency is inverted-linear and frequency/monetary are log-scaled min–max normalized **cohort-relatively**. Observed range ≈ 1.76–98.70.
- **Offer Sensitivity Score** (`compute_offer_sensitivity_score`): `0.70·S_incidence + 0.30·S_depth`, where incidence = `100·offer_dependency` and depth uses the conditional discount depth against a 50 % ceiling. Customers with `offer_dependency == 0` score exactly 0.00. Observed range ≈ 0.00–91.17.

### 4.4 Business labels and profiles

Cluster IDs are mapped from empirical centroid percentiles (offer intensity, recency, spend/frequency rank, spend trend) into defensible business names — never `cluster 0 = Loyal` by fiat. `generate_segment_profiles()` aggregates counts, customer/revenue shares, means/medians, mean scores, and an executive `strategic_playbook` per segment. On the committed data the four segments are:

| Segment | Customers | Revenue share | Character |
|---|---|---|---|
| High-Value Loyal | 50 (25 %) | 59.7 % | Recency ≈ 9 d, high spend, negligible discounting |
| At-Risk Dormant | 40 (20 %) | 20.6 % | Recency ≈ 92 d, strong negative spend trend |
| Offer-Sensitive | 49 (25 %) | 14.5 % | Offer dependency ≈ 79 % |
| Occasional Buyer | 61 (31 %) | 5.2 % | Infrequent, low spend |

### 4.5 Recommendations (`src/recommendations.py`)

Rule-based and explainable from segment, recency, spend tier, loyalty, and offer sensitivity only. Monetary wording is **currency-neutral by default** (e.g., “10 % off on 300+ spend”) and configurable via the `currency` argument (e.g., `currency="$"` → “$300”). No USD is assumed.

### 4.6 Post-hoc persona validation (`src/cluster_validation.py`)

`evaluate_persona_alignment()` joins `persona_true` **strictly after** clustering has converged and compares partitions with ARI/NMI plus cross-tabulations and per-segment purity. ARI/NMI are reported as **diagnostics, not pass/fail hurdles**. On the committed data: ARI ≈ 0.99, NMI ≈ 0.98 (a single borderline customer, C0123, differs — see `reports/role_c_validation_report.md`).

**Integrity checks (all raise `ValidationError`, never silently discard):**

1. Segmented `customer_id`s must be unique and the required columns (`customer_id`, `cluster_id`, `segment_name`) present.
2. Each customer must have exactly one consistent, non-missing `persona_true` in the transaction file (conflicting labels, NaN/empty labels, and empty files all raise).
3. The deduplicated ground-truth table must itself have unique customer IDs.
4. Segmented and ground-truth populations must match **exactly**; extra or missing customers are listed explicitly (verified by a post-merge row-count guard).

---

## 5. Governance

1. **`persona_true` never trains.** It is absent from `customer_features.csv`, all candidate matrices, preprocessing, K selection, and business labeling. It is loaded only inside `src/cluster_validation.py` for post-hoc diagnostics.
2. **No hardcoded population size.** Pipeline reconciliation (`run_segmentation.validate_pipeline_outputs`) verifies non-emptiness, ID uniqueness, input↔output population equality, customer-count and revenue reconciliation between the customer and segment feeds, and persona-validation coverage — for **any** customer count.
3. **Currency-neutral by default.** Amounts are generic currency units; recommendation text only includes a symbol when a caller explicitly passes `currency`.
4. **Exact monetary reconciliation.** Customer-feed `monetary` sums equal segment-profile `total_revenue` sums (and the source transaction total, 4,137,071.75 units) to the cent.
5. **Reproducibility.** Fixed `random_state=42`, `n_init=50`; model manifest records hyperparameters, feature order, scaler statistics, imputation, evaluation metrics, dataset info, and scoring config (§7).

---

## 6. Outputs

| File | Contents | Rows / size |
|---|---|---|
| `data/segmented_customers.csv` | Customer feed: IDs, cluster, segment, loyalty + sensitivity scores, RFM/discount/trend fields, `primary_recommendation`, plus auxiliaries (`repeat_rate`, `promo_lift`) | 200 (one per input customer) |
| `data/segment_profiles.csv` | Segment feed: counts, shares, revenue, means/medians, mean scores, `strategic_playbook` | 4 (one per segment) |
| `data/segmentation_metrics.csv` | 28-row evaluation grid (inertia, Silhouette, DB, CH, sizes, stability) | 28 |
| `models/kmeans_selected_model.joblib` | Fitted selected K-Means | — |
| `models/scaler_selected.joblib` | Fitted selected StandardScaler | — |
| `models/model_metadata.json` | Reproducibility manifest (below) | — |
| `outputs/*.png` | Role B EDA charts | 8 |

`models/model_metadata.json` always contains: `candidate_set`, `n_clusters`, ordered `feature_names` / `feature_name_order` / `feature_count`, `transformations` (log1p/linear/scaling spec), `imputation` report, nested `scaler` config (type, mean, scale, var, `n_samples_seen`, features), full K-Means `hyperparameters`, backward-compatible `cluster_centers` / `scaler_mean` / `scaler_scale`, `evaluation_metrics` (Silhouette, DB, CH, inertia, sizes, stability), `dataset_info` (source, n_customers, total monetary), `scoring_config` (weights, depth ceiling, currency), `random_state`, and `reproducibility` (UTC timestamp, sklearn version).

---

## 7. Installation and execution

Requirements: Python 3.10+ (developed on 3.14), dependencies pinned in `requirements.txt` (pandas, numpy, scikit-learn, scipy, matplotlib, seaborn, pytest).

```bash
# Clone and check out this branch
git clone https://github.com/soumyajitd1307-hash/Retail-IQ.git
cd Retail-IQ
git checkout fix/repository-audit-improvements

# Environment (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Environment (macOS/Linux)
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 7.1 Run the Role B feature pipeline

```bash
python src/feature_engineering.py
# Optional: python src/feature_engineering.py <input_path> <output_path>
```

### 7.2 Run the Role C segmentation pipeline

```bash
python run_segmentation.py
```

To customize the recommendation currency (default: neutral):

```python
from run_segmentation import run_pipeline
run_pipeline(currency="$")   # only if the monetary denomination is confirmed
```

### 7.3 Run the test suites

```bash
pytest -v
```

- `tests/test_feature_engineering.py` — Role B feature math, edge cases, governance.
- `tests/test_segmentation.py` — Role C preprocessing, scaling, scoring bounds, schemas, reconciliation.
- `tests/test_repository_audit.py` — variable customer counts, invalid inputs, metadata completeness, persona integrity, currency handling, `persona_true` isolation.

### 7.4 EDA and notebook

```bash
python src/eda_analysis.py
jupyter notebook notebooks/role_b_feature_engineering.ipynb
```

---

## 8. Report index

- `reports/role_c_handoff.md` — Role B → Role C contract and preprocessing guidance.
- `reports/role_c_implementation.md` — file inventory, schemas, and governance guarantees.
- `reports/role_c_validation_report.md` — full methodology, grid results, profiles, scoring formulas, persona diagnostics.
- `reports/feature_definitions.md`, `reports/role_b_validation_report.md`, `reports/role_b_eda_report.md` — Role B definitions, validation, and EDA.
- `data/data_dictionary.md`, `data/cleaning_report.md` — source schema and cleaning rules.

---

## 9. Limitations

1. **Synthetic, six-month window.** Data spans May–Oct 2026 for 200 customers; annual seasonality and real-population generalizability are out of scope.
2. **Observational, not causal.** Discount and lift metrics describe observed purchasing under discounts; without a campaign calendar or holdout they are not causal elasticity estimates.
3. **Cohort-relative scores.** Loyalty normalization uses batch min/max bounds; cross-period comparisons should anchor to fixed bounds (see `models/model_metadata.json` note).
4. **Outlier cap.** Role A capped `amount` at the 99th percentile (≈ 3,586.83 units), slightly compressing large orders.
5. **Undocumented currency.** Amounts are unit-less; consumers must confirm a denomination before rendering currency symbols.
6. **Clustering assumptions.** K-Means assumes roughly spherical, equal-variance clusters in standardized log space; highly elongated or imbalanced structures may be split or merged. ARI/NMI against `persona_true` are diagnostics, not acceptance criteria.
7. **Undefined economics.** `spend_trend` / `promo_lift` are `NaN` where the required comparison group is absent; downstream consumers must handle these explicitly.
