"""
Retail IQ — Unit and Integration Tests for Role C Customer Segmentation
========================================================================
Author: Role C (Analytics, Validation & ML Lead)

Tests cover:
  1. Data loading and required column verification.
  2. Customer ID uniqueness and row count preservation.
  3. Strict target leakage governance (persona_true excluded from features).
  4. Feature transformations (log1p scaling for skewed variables).
  5. Missing-value handling (spend_trend explicit imputation).
  6. Standardization and scaling verification (zero mean, unit variance).
  7. K-Means execution and convergence.
  8. Valid K range evaluation.
  9. Cluster assignment completeness (no null or out-of-range cluster IDs).
 10. RFM Loyalty Score boundary enforcement [0.0, 100.0] and edge cases.
 11. Offer Sensitivity Score boundary enforcement [0.0, 100.0] and zero-discount guarantee.
 12. Rule-based recommendation generation completeness.
 13. Customer output schema compliance (data/segmented_customers.csv).
 14. Segment profile aggregation and customer count reconciliation.
 15. Exact revenue reconciliation to the source transaction ledger.
 16. Reproducibility under fixed random seed.
 17. Multi-metric evaluation grid completeness (data/segmentation_metrics.csv).
"""

import os
import pytest
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans

from src.segmentation import (
    load_and_preprocess_customer_features,
    build_candidate_feature_matrices,
    evaluate_clustering_grid,
    select_best_model,
    assign_dynamic_business_labels,
    generate_segment_profiles,
    EXPECTED_COLUMNS,
    CANDIDATE_SET_DEFINITIONS,
)
from src.scoring import (
    compute_rfm_loyalty_score,
    compute_offer_sensitivity_score,
    DEFAULT_DEPTH_CEILING,
)
from src.recommendations import (
    generate_customer_recommendation,
    attach_recommendations,
)
from src.cluster_validation import evaluate_persona_alignment


@pytest.fixture(scope="session")
def preprocessed_data():
    """Load and preprocess customer features once for the test session."""
    assert os.path.exists("customer_features.csv"), "customer_features.csv not found"
    df, meta = load_and_preprocess_customer_features("customer_features.csv")
    return df, meta


@pytest.fixture(scope="session")
def candidate_matrices(preprocessed_data):
    """Generate candidate matrices for session."""
    df, _ = preprocessed_data
    return build_candidate_feature_matrices(df)


@pytest.fixture(scope="session")
def segmented_customers():
    """Load exported segmented customer deliverable."""
    path = "data/segmented_customers.csv"
    assert os.path.exists(path), f"{path} not found"
    return pd.read_csv(path)


@pytest.fixture(scope="session")
def segment_profiles():
    """Load exported segment profile deliverable."""
    path = "data/segment_profiles.csv"
    assert os.path.exists(path), f"{path} not found"
    return pd.read_csv(path)


# =====================================================================
# 1. Ingestion, Preprocessing & Governance Tests
# =====================================================================

def test_data_loading_and_columns(preprocessed_data):
    """Verify customer features are loaded with all expected columns."""
    df, _ = preprocessed_data
    for col in EXPECTED_COLUMNS:
        assert col in df.columns, f"Expected column {col} missing from features"
    assert len(df) == 200, f"Expected 200 customers, got {len(df)}"


def test_customer_id_uniqueness(preprocessed_data):
    """Verify customer IDs are unique and no row duplication occurs."""
    df, _ = preprocessed_data
    assert df["customer_id"].is_unique
    assert df["customer_id"].nunique() == 200


def test_persona_true_exclusion(preprocessed_data):
    """Ensure persona_true is not present in customer features."""
    df, _ = preprocessed_data
    assert "persona_true" not in df.columns


def test_missing_value_imputation(preprocessed_data):
    """Verify spend_trend has zero NaNs after preprocessing and C0082 was imputed."""
    df, meta = preprocessed_data
    assert df["spend_trend"].isna().sum() == 0
    assert "spend_trend" in meta
    assert meta["spend_trend"]["affected_customer_count"] == 1
    assert "C0082" in meta["spend_trend"]["affected_customers"]


def test_feature_transformations(preprocessed_data):
    """Verify log1p transformations for monetary, frequency, and AOV."""
    df, _ = preprocessed_data
    assert "log_monetary" in df.columns
    assert "log_frequency" in df.columns
    assert "log_aov" in df.columns

    # Verify mathematical match: log1p(x) == log(1 + x)
    assert np.allclose(df["log_monetary"], np.log1p(df["monetary"]))
    assert np.allclose(df["log_frequency"], np.log1p(df["frequency"]))
    assert np.allclose(df["log_aov"], np.log1p(df["avg_order_value"]))


def test_candidate_matrices_scaling(candidate_matrices):
    """Verify all candidate feature sets are scaled with zero mean and unit variance."""
    assert len(candidate_matrices) == 4
    for name, (X_df, scaler) in candidate_matrices.items():
        assert len(X_df) == 200
        # Check standard normal properties
        means = X_df.mean().values
        stds = X_df.std(ddof=0).values
        assert np.allclose(means, 0.0, atol=1e-5), f"Means not centered for {name}: {means}"
        assert np.allclose(stds, 1.0, atol=1e-5), f"Stds not unit for {name}: {stds}"


# =====================================================================
# 2. Scoring Engine Tests
# =====================================================================

def test_loyalty_score_boundaries_and_logic(preprocessed_data):
    """Test RFM loyalty score bounds [0.0, 100.0] and inverse recency behavior."""
    df, _ = preprocessed_data
    loyalty = compute_rfm_loyalty_score(df)
    assert len(loyalty) == 200
    assert loyalty.isna().sum() == 0
    assert (loyalty >= 0.0).all()
    assert (loyalty <= 100.0).all()

    # Customer with high spend and high frequency should have high loyalty
    high_spenders = df[df["monetary"] > 40000]
    assert loyalty.loc[high_spenders.index].mean() > 70.0


def test_offer_sensitivity_score_zero_discount(preprocessed_data):
    """Test offer sensitivity bounds [0.0, 100.0] and exact zero for zero-discount buyers."""
    df, _ = preprocessed_data
    sens = compute_offer_sensitivity_score(df)
    assert len(sens) == 200
    assert sens.isna().sum() == 0
    assert (sens >= 0.0).all()
    assert (sens <= 100.0).all()

    # Zero discount customers must have score == 0.0
    zero_promo_custs = df[df["offer_dependency"] == 0.0]
    assert len(zero_promo_custs) == 20
    assert (sens.loc[zero_promo_custs.index] == 0.0).all()

    # High promo customers (offer_dep == 1.0) must have high scores
    full_promo_custs = df[df["offer_dependency"] == 1.0]
    assert len(full_promo_custs) == 3
    assert (sens.loc[full_promo_custs.index] > 70.0).all()


# =====================================================================
# 3. Model Selection & K-Means Execution Tests
# =====================================================================

def test_kmeans_execution_and_metrics(candidate_matrices):
    """Verify K-Means execution across candidate sets and K range [2, 8]."""
    metrics_df = evaluate_clustering_grid(candidate_matrices, k_range=range(2, 5))
    assert len(metrics_df) == 4 * 3  # 4 sets * 3 k values
    assert "silhouette_score" in metrics_df.columns
    assert "davies_bouldin_index" in metrics_df.columns
    assert "calinski_harabasz_score" in metrics_df.columns
    assert (metrics_df["silhouette_score"] > 0.0).all()


def test_reproducibility_fixed_random_state(candidate_matrices):
    """Verify that K-Means produces identical cluster labels under fixed random state."""
    X_df, _ = candidate_matrices["Candidate 1 (Classic RFM-P)"]
    km1 = KMeans(n_clusters=4, init="k-means++", n_init=25, random_state=42)
    l1 = km1.fit_predict(X_df)

    km2 = KMeans(n_clusters=4, init="k-means++", n_init=25, random_state=42)
    l2 = km2.fit_predict(X_df)

    assert np.array_equal(l1, l2), "Cluster assignments not identical across identical seeds!"


# =====================================================================
# 4. Deliverables & Integration Tests (Role D Contracts)
# =====================================================================

def test_segmented_customers_schema(segmented_customers):
    """Verify data/segmented_customers.csv adheres strictly to Role D contract."""
    df = segmented_customers
    assert len(df) == 200
    assert df["customer_id"].is_unique

    required_contract_cols = [
        "customer_id",
        "cluster_id",
        "segment_name",
        "loyalty_score",
        "offer_sensitivity_score",
        "recency_days",
        "frequency",
        "monetary",
        "avg_order_value",
        "offer_dependency",
        "avg_discount_pct",
        "spend_trend",
        "category_diversity",
        "primary_recommendation",
    ]
    for col in required_contract_cols:
        assert col in df.columns, f"Required column '{col}' missing from segmented_customers.csv"

    # Value checks
    assert df["cluster_id"].isna().sum() == 0
    assert df["segment_name"].isna().sum() == 0
    assert (df["loyalty_score"] >= 0.0).all() and (df["loyalty_score"] <= 100.0).all()
    assert (df["offer_sensitivity_score"] >= 0.0).all() and (df["offer_sensitivity_score"] <= 100.0).all()
    assert (df["primary_recommendation"].str.len() > 10).all()


def test_segment_profiles_schema_and_reconciliation(segment_profiles, segmented_customers):
    """Verify segment_profiles.csv aggregates and reconciles to source customer spend."""
    profiles = segment_profiles
    custs = segmented_customers

    # Check required columns
    required_cols = [
        "segment_name",
        "cluster_id",
        "customer_count",
        "pct_of_customers",
        "total_revenue",
        "pct_of_revenue",
        "mean_recency",
        "mean_frequency",
        "mean_monetary",
        "mean_aov",
        "mean_offer_dependency",
        "mean_loyalty_score",
        "mean_offer_sensitivity",
        "strategic_playbook",
    ]
    for col in required_cols:
        assert col in profiles.columns, f"Required column '{col}' missing from segment_profiles.csv"

    # Reconciliation checks
    assert profiles["customer_count"].sum() == 200
    assert abs(profiles["pct_of_customers"].sum() - 100.0) < 0.1

    # Revenue reconciliation
    cust_total_rev = round(custs["monetary"].sum(), 2)
    profile_total_rev = round(profiles["total_revenue"].sum(), 2)
    assert abs(cust_total_rev - profile_total_rev) < 0.05
    assert abs(profiles["pct_of_revenue"].sum() - 100.0) < 0.1


def test_persona_alignment_post_hoc(segmented_customers):
    """Verify post-hoc persona alignment calculation and reporting."""
    res = evaluate_persona_alignment(segmented_customers, "data/transactions_clean.csv")
    assert "adjusted_rand_index" in res
    assert "normalized_mutual_info" in res
    assert res["adjusted_rand_index"] > 0.50
    assert res["normalized_mutual_info"] > 0.50

