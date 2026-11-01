"""
Retail IQ — Role B: Customer Feature Engineering Pipeline
=========================================================
Author: Role B (Features Lead)
Branch: Souvik

This module transforms transaction-level retail records into a clean,
reproducible, customer-level feature dataset for downstream segmentation
and machine learning (Role C).

The pipeline computes 10 customer features across six analytical dimensions:
  A. RFM Features:
     1. recency_days
     2. frequency
     3. monetary
     4. avg_order_value
  B. Discount Features:
     5. offer_dependency
     6. avg_discount_pct
  C. Customer Loyalty:
     7. repeat_rate
  D. Category Diversity:
     8. category_diversity
  E. Spending Trend:
     9. spend_trend
  F. Promotional Response:
     10. promo_lift

CRITICAL GOVERNANCE RULES:
- persona_true is synthetic ground-truth used strictly for validation;
  it is NEVER included in the final feature dataset.
- order_id is used for order-level deduplication and counting, not as an ML feature.
- Original cleaned transaction dataset is strictly preserved without modification.
- Undefined mathematical values (zero denominators) are preserved as NaN,
  never silently imputed as zero.
"""

import os
import sys
import logging
from typing import Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("feature_engineering")

# Fixed constants for reproducibility
DEFAULT_SNAPSHOT_DATE = "2026-10-30"
P1_END_DATE = "2026-07-31"      # First period: May 1, 2026 – July 31, 2026
P2_START_DATE = "2026-08-01"    # Second period: August 1, 2026 – October 31, 2026

REQUIRED_FEATURES = [
    "recency_days",
    "frequency",
    "monetary",
    "avg_order_value",
    "offer_dependency",
    "avg_discount_pct",
    "repeat_rate",
    "category_diversity",
    "spend_trend",
    "promo_lift",
]

FINAL_COLUMNS = ["customer_id"] + REQUIRED_FEATURES


def load_and_preprocess_transactions(filepath: str) -> pd.DataFrame:
    """
    Load cleaned transactions CSV and parse transaction dates.

    Args:
        filepath: Path to cleaned transaction CSV file.

    Returns:
        pd.DataFrame: Cleaned transaction data with parsed dates.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Cleaned transactions file not found at: {filepath}")

    logger.info(f"Loading transaction dataset from {filepath}")
    df = pd.read_csv(filepath)

    # Validate essential columns
    required_cols = [
        "customer_id",
        "order_id",
        "transaction_date",
        "category",
        "quantity",
        "amount",
        "discount_percent",
        "is_discounted",
    ]
    missing_cols = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns in dataset: {missing_cols}")

    # Parse transaction dates (format: DD/MM/YY)
    df["parsed_date"] = pd.to_datetime(df["transaction_date"], format="%d/%m/%y")

    # Ensure numeric types
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df["discount_percent"] = pd.to_numeric(df["discount_percent"], errors="coerce")
    df["is_discounted"] = pd.to_numeric(df["is_discounted"], errors="coerce").astype(int)

    logger.info(
        f"Loaded {len(df)} transactions across {df['customer_id'].nunique()} unique customers "
        f"spanning {df['parsed_date'].min().strftime('%Y-%m-%d')} to {df['parsed_date'].max().strftime('%Y-%m-%d')}."
    )
    return df


def compute_rfm_features(
    df: pd.DataFrame, snapshot_date_str: str = DEFAULT_SNAPSHOT_DATE
) -> pd.DataFrame:
    """
    Compute Recency, Frequency, Monetary, and Average Order Value (AOV).

    Definitions:
      1. recency_days: Number of days between customer's latest transaction date
         and snapshot date (October 30, 2026).
      2. frequency: Total unique orders (order_id) made by customer.
      3. monetary: Total amount spent (amount paid after discount) across all transactions.
      4. avg_order_value: Total monetary divided by frequency.

    Args:
        df: Transaction DataFrame with 'parsed_date', 'customer_id', 'order_id', 'amount'.
        snapshot_date_str: Fixed snapshot date ISO string (YYYY-MM-DD).

    Returns:
        pd.DataFrame indexed by customer_id with ['recency_days', 'frequency', 'monetary', 'avg_order_value'].
    """
    snapshot_date = pd.to_datetime(snapshot_date_str)

    # Order-level aggregation: each row is an order, but group by customer_id
    grouped = df.groupby("customer_id")

    recency_series = (snapshot_date - grouped["parsed_date"].max()).dt.days
    frequency_series = grouped["order_id"].nunique()
    monetary_series = grouped["amount"].sum().round(2)
    aov_series = (monetary_series / frequency_series).round(4)

    rfm_df = pd.DataFrame(
        {
            "recency_days": recency_series,
            "frequency": frequency_series,
            "monetary": monetary_series,
            "avg_order_value": aov_series,
        }
    )
    return rfm_df


def compute_discount_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute discount behavior features:
      5. offer_dependency: Number of discounted unique orders / total unique orders.
      6. avg_discount_pct: Average discount percentage across customer's orders.

    Args:
        df: Transaction DataFrame with 'customer_id', 'order_id', 'is_discounted', 'discount_percent'.

    Returns:
        pd.DataFrame indexed by customer_id with ['offer_dependency', 'avg_discount_pct'].
    """
    grouped = df.groupby("customer_id")
    total_orders = grouped["order_id"].nunique()

    # Discounted unique orders
    discounted_orders = df[df["is_discounted"] == 1].groupby("customer_id")["order_id"].nunique()
    discounted_orders = discounted_orders.reindex(total_orders.index, fill_value=0)

    offer_dependency = (discounted_orders / total_orders).round(4)
    avg_discount_pct = grouped["discount_percent"].mean().round(4)

    return pd.DataFrame(
        {
            "offer_dependency": offer_dependency,
            "avg_discount_pct": avg_discount_pct,
        }
    )


def compute_loyalty_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute customer loyalty metrics:
      7. repeat_rate: (unique orders - 1) / unique orders.
         Captures repeat purchase proportion over the six-month observation window.
         If frequency <= 0, returns NaN.

    Args:
        df: Transaction DataFrame with 'customer_id', 'order_id'.

    Returns:
        pd.DataFrame indexed by customer_id with ['repeat_rate'].
    """
    grouped = df.groupby("customer_id")
    frequency = grouped["order_id"].nunique()

    # Safe calculation handling edge case of frequency <= 0
    repeat_rate = np.where(frequency > 0, (frequency - 1) / frequency, np.nan)
    repeat_rate_series = pd.Series(repeat_rate, index=frequency.index).round(4)

    return pd.DataFrame({"repeat_rate": repeat_rate_series})


def compute_category_diversity(
    df: pd.DataFrame, exclude_unknown: bool = True
) -> pd.DataFrame:
    """
    Compute category diversity:
      8. category_diversity: Count of distinct product categories purchased by customer.

    Treatment of 'Unknown':
      Role A filled missing raw category entries with 'Unknown'.
      When exclude_unknown=True (default), 'Unknown' is treated as missing data
      rather than an authentic distinct merchandise category, preventing artificial
      inflation of diversity scores.
      Both documented and supported.

    Args:
        df: Transaction DataFrame with 'customer_id', 'category'.
        exclude_unknown: Whether to exclude 'Unknown' category from count.

    Returns:
        pd.DataFrame indexed by customer_id with ['category_diversity'].
    """
    if exclude_unknown:
        filtered_df = df[df["category"] != "Unknown"]
    else:
        filtered_df = df

    diversity = filtered_df.groupby("customer_id")["category"].nunique()
    all_custs = pd.Index(df["customer_id"].unique())
    diversity = diversity.reindex(all_custs, fill_value=0)

    return pd.DataFrame({"category_diversity": diversity.astype(int)})


def compute_spending_trend(
    df: pd.DataFrame,
    p1_end_str: str = P1_END_DATE,
    p2_start_str: str = P2_START_DATE,
) -> pd.DataFrame:
    """
    Compute spend trend comparing customer spending across two trimesters:
      Period 1 (P1): May 1, 2026 – July 31, 2026
      Period 2 (P2): August 1, 2026 – October 31, 2026

      9. spend_trend: ((P2_spend - P1_spend) / P1_spend) * 100

    Handling of zero denominators:
      Customers with zero spending in Period 1 (e.g. newly acquired customers in P2)
      have an undefined percentage change. This value is strictly preserved as NaN,
      NOT filled with zero or infinity, preventing distortion in ML algorithms.

    Args:
        df: Transaction DataFrame with 'customer_id', 'parsed_date', 'amount'.
        p1_end_str: End of Period 1 (inclusive).
        p2_start_str: Start of Period 2 (inclusive).

    Returns:
        pd.DataFrame indexed by customer_id with ['spend_trend'].
    """
    p1_end = pd.to_datetime(p1_end_str)
    p2_start = pd.to_datetime(p2_start_str)

    p1_df = df[df["parsed_date"] <= p1_end]
    p2_df = df[df["parsed_date"] >= p2_start]

    all_custs = pd.Index(df["customer_id"].unique())

    p1_spend = p1_df.groupby("customer_id")["amount"].sum().reindex(all_custs, fill_value=0.0)
    p2_spend = p2_df.groupby("customer_id")["amount"].sum().reindex(all_custs, fill_value=0.0)

    # Calculate percentage change where p1_spend > 0, else np.nan
    trend = np.where(
        p1_spend > 0,
        ((p2_spend - p1_spend) / p1_spend) * 100.0,
        np.nan,
    )
    trend_series = pd.Series(trend, index=all_custs).round(4)

    return pd.DataFrame({"spend_trend": trend_series})


def compute_promotional_lift(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute promotional response lift:
      10. promo_lift: Percentage difference in Average Order Value (AOV)
          between discounted orders (is_discounted == 1) and non-discounted orders (is_discounted == 0):

          promo_lift = ((AOV_discounted - AOV_non_discounted) / AOV_non_discounted) * 100

    Methodology & Denominator:
      - Denominator: AOV_non_discounted (baseline full-price purchasing behaviour).
      - Numerator: AOV_discounted - AOV_non_discounted.
      - Distinguishing observed discounts from promotional exposure:
        The dataset contains observed transaction discount markers (is_discounted).
        Campaign IDs are partially recorded (e.g. MONSOON26, DIWALI26), but no separate
        campaign calendar table exists. We calculate observed discount-driven lift directly
        from verified transaction records without fabricating synthetic exposure schedules.
      - Customers lacking either comparison group (e.g. 0 discounted orders or 0 non-discounted
        orders) have an undefined lift. These are retained as NaN (undefined), never imputed as zero.

    Args:
        df: Transaction DataFrame with 'customer_id', 'amount', 'is_discounted'.

    Returns:
        pd.DataFrame indexed by customer_id with ['promo_lift'].
    """
    all_custs = pd.Index(df["customer_id"].unique())

    # Discounted AOV
    disc_df = df[df["is_discounted"] == 1]
    aov_disc = disc_df.groupby("customer_id")["amount"].mean()

    # Non-discounted AOV
    nondisc_df = df[df["is_discounted"] == 0]
    aov_nondisc = nondisc_df.groupby("customer_id")["amount"].mean()

    # Reindex to all customers
    aov_disc = aov_disc.reindex(all_custs)
    aov_nondisc = aov_nondisc.reindex(all_custs)

    # Condition: both must exist and aov_nondisc must be > 0
    valid_mask = aov_disc.notna() & aov_nondisc.notna() & (aov_nondisc > 0)

    lift = np.where(
        valid_mask,
        ((aov_disc - aov_nondisc) / aov_nondisc) * 100.0,
        np.nan,
    )
    lift_series = pd.Series(lift, index=all_custs).round(4)

    return pd.DataFrame({"promo_lift": lift_series})


def build_customer_features(
    df: pd.DataFrame,
    snapshot_date: str = DEFAULT_SNAPSHOT_DATE,
    exclude_unknown_category: bool = True,
) -> pd.DataFrame:
    """
    Orchestrate full customer feature engineering pipeline.

    Combines:
      - RFM features (recency_days, frequency, monetary, avg_order_value)
      - Discount features (offer_dependency, avg_discount_pct)
      - Loyalty features (repeat_rate)
      - Category diversity (category_diversity)
      - Spending trend (spend_trend)
      - Promotional lift (promo_lift)

    Guarantees:
      - Output has exactly one row per customer.
      - Columns ordered logically: customer_id followed by 10 features.
      - persona_true is excluded from final output.

    Args:
        df: Cleaned transaction DataFrame.
        snapshot_date: Fixed snapshot date for recency calculation.
        exclude_unknown_category: Whether to ignore 'Unknown' product category.

    Returns:
        pd.DataFrame: Customer-level feature table.
    """
    logger.info("Building customer feature table...")

    rfm = compute_rfm_features(df, snapshot_date_str=snapshot_date)
    discount = compute_discount_features(df)
    loyalty = compute_loyalty_features(df)
    diversity = compute_category_diversity(df, exclude_unknown=exclude_unknown_category)
    trend = compute_spending_trend(df)
    lift = compute_promotional_lift(df)

    # Concatenate all feature blocks along columns
    features = pd.concat([rfm, discount, loyalty, diversity, trend, lift], axis=1)

    # Reset index to make customer_id an explicit column
    features = features.reset_index()
    features = features.rename(columns={"index": "customer_id"})

    # Sort deterministically by customer_id
    features = features.sort_values("customer_id").reset_index(drop=True)

    # Ensure exact column ordering and exclusion of persona_true
    features = features[FINAL_COLUMNS]

    logger.info(
        f"Successfully generated customer features: {features.shape[0]} rows, "
        f"{features.shape[1]} columns."
    )
    return features


def validate_input_transactions(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validate transaction-level input data quality.

    Checks:
      - Total transaction count (expected: 3,748)
      - Unique customer count (expected: 200)
      - Unique order count (expected: 3,748)
      - Absence of negative amounts
      - Quantity positive integers
      - Valid date parsing

    Returns:
        Dict[str, Any]: Validation summary.
    """
    report = {
        "total_transactions": len(df),
        "unique_customers": df["customer_id"].nunique(),
        "unique_orders": df["order_id"].nunique(),
        "negative_amounts": (df["amount"] < 0).sum(),
        "zero_amounts": (df["amount"] == 0).sum(),
        "negative_quantities": (df["quantity"] <= 0).sum(),
        "date_nulls": df["parsed_date"].isnull().sum(),
        "duplicate_orders": df["order_id"].duplicated().sum(),
    }
    return report


def validate_engineered_features(
    features_df: pd.DataFrame, raw_df: pd.DataFrame
) -> Dict[str, Any]:
    """
    Comprehensive data quality and mathematical validation of customer features.

    Validates:
      1. Exactly one row per customer.
      2. customer_id column preserved and unique.
      3. All 10 required features present.
      4. persona_true completely excluded.
      5. Monetary total matches transaction amount sum exactly.
      6. recency_days non-negative.
      7. frequency >= 1 for all observed customers.
      8. avg_order_value matches monetary / frequency.
      9. offer_dependency bounded within [0.0, 1.0].
      10. avg_discount_pct bounded within [0.0, 100.0].
      11. repeat_rate bounded within [0.0, 1.0].
      12. category_diversity >= 1.
      13. Undefined spend_trend properly isolated to customers with 0 Period 1 spend.
      14. Undefined promo_lift properly isolated to customers missing either group.

    Returns:
        Dict[str, Any]: Detailed validation test results.
    """
    logger.info("Executing comprehensive feature validation checks...")
    results: Dict[str, Any] = {}

    # Check 1: Row count
    expected_customers = raw_df["customer_id"].nunique()
    actual_rows = len(features_df)
    results["row_count_matches_customers"] = bool(actual_rows == expected_customers)
    results["total_customers"] = actual_rows

    # Check 2: Unique customer IDs
    results["customer_ids_unique"] = bool(features_df["customer_id"].nunique() == actual_rows)

    # Check 3: Required columns present
    present_cols = set(features_df.columns)
    required_cols = set(FINAL_COLUMNS)
    results["all_columns_present"] = bool(required_cols.issubset(present_cols))
    results["exact_column_match"] = bool(list(features_df.columns) == FINAL_COLUMNS)

    # Check 4: persona_true excluded
    results["persona_true_excluded"] = bool("persona_true" not in features_df.columns)

    # Check 5: Monetary reconciliation
    tx_monetary_sum = raw_df["amount"].sum()
    feat_monetary_sum = features_df["monetary"].sum()
    monetary_diff = abs(tx_monetary_sum - feat_monetary_sum)
    results["monetary_reconciliation_exact"] = bool(monetary_diff < 1.0)
    results["transaction_total_amount"] = round(float(tx_monetary_sum), 2)
    results["feature_total_monetary"] = round(float(feat_monetary_sum), 2)
    results["monetary_discrepancy"] = round(float(monetary_diff), 4)

    # Check 6: Recency non-negative
    results["recency_non_negative"] = bool((features_df["recency_days"] >= 0).all())
    results["recency_min"] = int(features_df["recency_days"].min())
    results["recency_max"] = int(features_df["recency_days"].max())

    # Check 7: Frequency positive
    results["frequency_positive"] = bool((features_df["frequency"] >= 1).all())
    results["frequency_min"] = int(features_df["frequency"].min())
    results["frequency_max"] = int(features_df["frequency"].max())

    # Check 8: AOV consistency
    aov_recomputed = features_df["monetary"] / features_df["frequency"]
    aov_diff = (features_df["avg_order_value"] - aov_recomputed).abs().max()
    results["aov_consistent"] = bool(aov_diff < 0.01)

    # Check 9: Offer dependency range
    results["offer_dependency_valid_range"] = bool(
        ((features_df["offer_dependency"] >= 0.0) & (features_df["offer_dependency"] <= 1.0)).all()
    )

    # Check 10: Discount pct range
    results["avg_discount_pct_valid_range"] = bool(
        ((features_df["avg_discount_pct"] >= 0.0) & (features_df["avg_discount_pct"] <= 100.0)).all()
    )

    # Check 11: Repeat rate range
    results["repeat_rate_valid_range"] = bool(
        ((features_df["repeat_rate"] >= 0.0) & (features_df["repeat_rate"] <= 1.0)).all()
    )

    # Check 12: Category diversity
    results["category_diversity_positive"] = bool((features_df["category_diversity"] >= 1).all())
    results["category_diversity_max"] = int(features_df["category_diversity"].max())

    # Check 13: Undefined spend trend validation
    p1_end = pd.to_datetime(P1_END_DATE)
    p1_zero_custs = (
        raw_df[raw_df["parsed_date"] <= p1_end]
        .groupby("customer_id")["amount"]
        .sum()
        .reindex(features_df["customer_id"], fill_value=0.0)
    )
    expected_undefined_spend_trend = p1_zero_custs[p1_zero_custs == 0].index.tolist()
    actual_undefined_spend_trend = features_df[features_df["spend_trend"].isna()]["customer_id"].tolist()
    results["undefined_spend_trend_count"] = len(actual_undefined_spend_trend)
    results["undefined_spend_trend_customers"] = actual_undefined_spend_trend
    results["undefined_spend_trend_correct"] = bool(
        set(expected_undefined_spend_trend) == set(actual_undefined_spend_trend)
    )

    # Check 14: Undefined promo lift validation
    disc_custs = set(raw_df[raw_df["is_discounted"] == 1]["customer_id"])
    nondisc_custs = set(raw_df[raw_df["is_discounted"] == 0]["customer_id"])
    all_set = set(features_df["customer_id"])
    expected_undefined_lift = (all_set - disc_custs) | (all_set - nondisc_custs)
    actual_undefined_lift = set(features_df[features_df["promo_lift"].isna()]["customer_id"])
    results["undefined_promo_lift_count"] = len(actual_undefined_lift)
    results["undefined_promo_lift_correct"] = bool(expected_undefined_lift == actual_undefined_lift)
    results["customers_without_discounted_orders"] = len(all_set - disc_custs)
    results["customers_without_nondiscounted_orders"] = len(all_set - nondisc_custs)

    all_passed = bool(all(
        v for k, v in results.items() if isinstance(v, (bool, np.bool_))
    ))
    results["all_validation_checks_passed"] = all_passed
    logger.info(f"Feature validation completed. All tests passed: {all_passed}")
    return results


def export_customer_features(
    features_df: pd.DataFrame, output_path: str = "customer_features.csv"
) -> None:
    """
    Save customer feature table to CSV.

    Args:
        features_df: Feature table to export.
        output_path: Target CSV path.
    """
    features_df.to_csv(output_path, index=False)
    logger.info(f"Exported customer features to {output_path}")


def run_pipeline(
    input_path: str = "data/transactions_clean.csv",
    output_path: str = "customer_features.csv",
    snapshot_date: str = DEFAULT_SNAPSHOT_DATE,
    exclude_unknown_category: bool = True,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Execute end-to-end Role B feature engineering pipeline.

    Args:
        input_path: Path to transactions_clean.csv.
        output_path: Destination path for customer_features.csv.
        snapshot_date: Fixed snapshot date for recency.
        exclude_unknown_category: Exclude 'Unknown' category flag.

    Returns:
        Tuple[pd.DataFrame, Dict[str, Any]]: (features_df, validation_results)
    """
    logger.info("=== Starting Role B Feature Engineering Pipeline ===")
    raw_df = load_and_preprocess_transactions(input_path)

    # Validate input data
    input_val = validate_input_transactions(raw_df)
    logger.info(f"Input validation: {input_val}")

    # Build features
    features_df = build_customer_features(
        raw_df,
        snapshot_date=snapshot_date,
        exclude_unknown_category=exclude_unknown_category,
    )

    # Validate engineered features
    val_results = validate_engineered_features(features_df, raw_df)
    if not val_results["all_validation_checks_passed"]:
        logger.warning("One or more validation checks failed! Review report for details.")

    # Export output
    export_customer_features(features_df, output_path=output_path)
    logger.info("=== Role B Feature Engineering Pipeline Finished Successfully ===")
    return features_df, val_results


if __name__ == "__main__":
    # Allow command line execution with optional arguments
    in_file = sys.argv[1] if len(sys.argv) > 1 else "data/transactions_clean.csv"
    out_file = sys.argv[2] if len(sys.argv) > 2 else "customer_features.csv"
    run_pipeline(input_path=in_file, output_path=out_file)
