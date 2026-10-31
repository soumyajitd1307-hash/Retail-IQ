"""
Retail IQ — Unit and Integration Tests for Role B Feature Engineering
====================================================================
Tests cover:
  1. Data loading and preprocessing.
  2. Mathematical correctness of all 10 features.
  3. Edge case handling (zero denominators, missing discount/non-discount orders).
  4. Treatment of 'Unknown' product categories.
  5. Governance rules (exclusion of persona_true, snapshot reproducibility).
  6. Monetary reconciliation and data validation checks.
"""

import os
import pytest
import numpy as np
import pandas as pd

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
    DEFAULT_SNAPSHOT_DATE,
    P1_END_DATE,
    P2_START_DATE,
    REQUIRED_FEATURES,
    FINAL_COLUMNS,
)

DATA_PATH = "data/transactions_clean.csv"


@pytest.fixture(scope="session")
def raw_transactions():
    """Load and preprocess transaction data once for test session."""
    assert os.path.exists(DATA_PATH), f"File {DATA_PATH} not found"
    return load_and_preprocess_transactions(DATA_PATH)


@pytest.fixture(scope="session")
def customer_features(raw_transactions):
    """Build customer features DataFrame once for test session."""
    return build_customer_features(raw_transactions)


# =====================================================================
# 1. Input Validation Tests
# =====================================================================

def test_input_data_integrity(raw_transactions):
    """Verify input transaction integrity against data dictionary and cleaning report."""
    assert len(raw_transactions) == 3748
    assert raw_transactions["customer_id"].nunique() == 200
    assert raw_transactions["order_id"].nunique() == 3748
    assert (raw_transactions["amount"] > 0).all()
    assert (raw_transactions["quantity"] > 0).all()
    assert raw_transactions["parsed_date"].notna().all()
    assert raw_transactions["parsed_date"].min() == pd.Timestamp("2026-05-01")
    assert raw_transactions["parsed_date"].max() == pd.Timestamp("2026-10-29")


def test_input_validation_summary(raw_transactions):
    """Verify validate_input_transactions returns all expected keys and 0 issues."""
    val = validate_input_transactions(raw_transactions)
    assert val["total_transactions"] == 3748
    assert val["unique_customers"] == 200
    assert val["unique_orders"] == 3748
    assert val["negative_amounts"] == 0
    assert val["duplicate_orders"] == 0


# =====================================================================
# 2. RFM Features Tests
# =====================================================================

def test_rfm_calculation(raw_transactions):
    """Verify RFM feature calculation logic and manual customer checks."""
    rfm = compute_rfm_features(raw_transactions, DEFAULT_SNAPSHOT_DATE)
    assert len(rfm) == 200
    assert (rfm["recency_days"] >= 1).all()  # Latest tx is Oct 29, snapshot is Oct 30 -> min recency is 1
    assert (rfm["frequency"] >= 1).all()
    assert (rfm["monetary"] > 0).all()
    assert (rfm["avg_order_value"] > 0).all()

    # Manual verification for C0001
    c1_rfm = rfm.loc["C0001"]
    assert c1_rfm["frequency"] == 5
    assert c1_rfm["recency_days"] == 56  # 2026-10-30 minus 2026-09-04 = 56 days
    assert c1_rfm["monetary"] == 4027.20
    assert round(c1_rfm["avg_order_value"], 2) == 805.44


def test_monetary_reconciliation(raw_transactions, customer_features):
    """Reconcile total monetary sum against transaction amount sum."""
    raw_sum = raw_transactions["amount"].sum()
    feat_sum = customer_features["monetary"].sum()
    assert abs(raw_sum - feat_sum) < 0.05, f"Discrepancy: {raw_sum} vs {feat_sum}"


# =====================================================================
# 3. Discount Features Tests
# =====================================================================

def test_discount_features(raw_transactions):
    """Test offer_dependency and avg_discount_pct boundaries and specific customers."""
    disc = compute_discount_features(raw_transactions)
    assert len(disc) == 200
    assert (disc["offer_dependency"] >= 0.0).all()
    assert (disc["offer_dependency"] <= 1.0).all()
    assert (disc["avg_discount_pct"] >= 0.0).all()
    assert (disc["avg_discount_pct"] <= 100.0).all()

    # C0002 has 0 discounted orders
    c2_disc = disc.loc["C0002"]
    assert c2_disc["offer_dependency"] == 0.0
    assert c2_disc["avg_discount_pct"] == 0.0

    # C0121 has only discounted orders
    c121_disc = disc.loc["C0121"]
    assert c121_disc["offer_dependency"] == 1.0
    assert c121_disc["avg_discount_pct"] > 0.0


# =====================================================================
# 4. Loyalty Features Tests
# =====================================================================

def test_repeat_rate_calculation(raw_transactions):
    """Verify repeat rate formula: (frequency - 1) / frequency."""
    loyalty = compute_loyalty_features(raw_transactions)
    assert len(loyalty) == 200
    assert (loyalty["repeat_rate"] >= 0.0).all()
    assert (loyalty["repeat_rate"] < 1.0).all()

    # C0001 has 5 orders -> repeat rate = 4/5 = 0.8
    assert loyalty.loc["C0001", "repeat_rate"] == 0.8

    # Edge case: synthetic single-order test
    synthetic_df = pd.DataFrame({
        "customer_id": ["TEST_1"],
        "order_id": ["O_TEST_1"]
    })
    synth_loyalty = compute_loyalty_features(synthetic_df)
    assert synth_loyalty.loc["TEST_1", "repeat_rate"] == 0.0


# =====================================================================
# 5. Category Diversity Tests
# =====================================================================

def test_category_diversity(raw_transactions):
    """Test category diversity calculation and 'Unknown' treatment."""
    # Default: exclude Unknown
    div_excluded = compute_category_diversity(raw_transactions, exclude_unknown=True)
    assert len(div_excluded) == 200
    assert (div_excluded["category_diversity"] >= 1).all()
    assert (div_excluded["category_diversity"] <= 6).all()

    # C0200 has 1 Unknown, 2 Grocery, 1 Home & Kitchen, 1 Electronics
    # If excluded -> 3 categories
    assert div_excluded.loc["C0200", "category_diversity"] == 3

    # If included -> 4 categories
    div_included = compute_category_diversity(raw_transactions, exclude_unknown=False)
    assert div_included.loc["C0200", "category_diversity"] == 4


# =====================================================================
# 6. Spending Trend Tests
# =====================================================================

def test_spending_trend_calculation(raw_transactions):
    """Verify spend_trend calculation and handling of zero denominators."""
    trend = compute_spending_trend(raw_transactions)
    assert len(trend) == 200

    # C0001 manual check: P1 spend = 2720.56, P2 spend = 1306.64
    # ((1306.64 - 2720.56) / 2720.56) * 100 = -51.9717%
    assert round(trend.loc["C0001", "spend_trend"], 2) == -51.97

    # C0082 has zero transactions in Period 1 (joined Aug 2026) -> MUST be NaN
    assert np.isnan(trend.loc["C0082", "spend_trend"])

    # Exactly 1 customer has undefined spend_trend in the dataset
    assert trend["spend_trend"].isna().sum() == 1


# =====================================================================
# 7. Promotional Response Tests
# =====================================================================

def test_promotional_lift_calculation(raw_transactions):
    """Verify promo_lift calculation and undefined handling for missing groups."""
    lift = compute_promotional_lift(raw_transactions)
    assert len(lift) == 200

    # C0001 manual check:
    # AOV disc = 1306.64, AOV non-disc = 680.14 -> Lift = ((1306.64 - 680.14) / 680.14) * 100 = 92.1134%
    assert round(lift.loc["C0001", "promo_lift"], 2) == 92.11

    # C0002 has NO discounted orders -> MUST be NaN
    assert np.isnan(lift.loc["C0002", "promo_lift"])

    # C0121 has NO non-discounted orders -> MUST be NaN
    assert np.isnan(lift.loc["C0121", "promo_lift"])

    # Exactly 23 customers lack one comparison group -> 23 NaNs
    assert lift["promo_lift"].isna().sum() == 23


# =====================================================================
# 8. Governance, Schema, and End-to-End Validation
# =====================================================================

def test_final_features_schema_and_governance(customer_features):
    """Verify schema, row count, column order, and governance compliance."""
    assert len(customer_features) == 200
    assert customer_features["customer_id"].is_unique
    assert list(customer_features.columns) == FINAL_COLUMNS
    assert "persona_true" not in customer_features.columns
    assert "order_id" not in customer_features.columns


def test_full_validation_suite(customer_features, raw_transactions):
    """Execute full validation suite and verify all test flags pass."""
    val_results = validate_engineered_features(customer_features, raw_transactions)
    assert val_results["all_validation_checks_passed"] is True
    assert val_results["row_count_matches_customers"] is True
    assert val_results["exact_column_match"] is True
    assert val_results["persona_true_excluded"] is True
    assert val_results["monetary_reconciliation_exact"] is True
    assert val_results["undefined_spend_trend_correct"] is True
    assert val_results["undefined_promo_lift_correct"] is True

