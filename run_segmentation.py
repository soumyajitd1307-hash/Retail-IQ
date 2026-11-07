"""
Retail IQ — Role C: Main Customer Segmentation Pipeline Entry Point
====================================================================
Author: Role C (Analytics, Validation & ML Lead)

Executes the complete end-to-end Role C analytical pipeline from the repository root:
  1. Ingests customer_features.csv (Role B output).
  2. Applies data preprocessing, transformations, and explicit imputation.
  3. Evaluates 4 candidate feature sets across K in [2, 8] with multiple metrics.
  4. Persists the evaluation grid to 'data/segmentation_metrics.csv'.
  5. Selects the optimal model based on geometric separation, stability, and interpretability.
  6. Computes RFM Loyalty Score and Offer Sensitivity Score (bounded [0, 100]).
  7. Derives dynamic business segment labels based on empirical cluster profiles.
  8. Generates explainable, data-backed primary customer recommendations.
  9. Exports standardized Role D deliverables:
     - 'data/segmented_customers.csv'
     - 'data/segment_profiles.csv'
 10. Executes post-hoc external persona validation (ARI / NMI diagnostics).
 11. Produces comprehensive validation documentation.
"""

import os
import sys
import json
import logging
from typing import Dict, Any, Optional, Set, Tuple
import pandas as pd
import numpy as np

# Ensure project root is on path
sys.path.insert(0, os.path.abspath("."))

from src.segmentation import (
    load_and_preprocess_customer_features,
    build_candidate_feature_matrices,
    evaluate_clustering_grid,
    select_best_model,
    assign_dynamic_business_labels,
    generate_segment_profiles,
    save_artifacts,
)
from src.scoring import compute_rfm_loyalty_score, compute_offer_sensitivity_score
from src.recommendations import attach_recommendations, DEFAULT_CURRENCY
from src.cluster_validation import evaluate_persona_alignment

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("run_segmentation")

DATA_DIR = "data"
OUTPUTS_DIR = "outputs"
REPORTS_DIR = "reports"
MODELS_DIR = "models"


def validate_pipeline_outputs(
    final_customer_df: pd.DataFrame,
    segment_profiles_df: pd.DataFrame,
    persona_validation_results: Dict[str, Any],
    expected_customer_ids: Optional[Set[str]] = None,
) -> Dict[str, Any]:
    """
    Data-integrity checks that reconcile pipeline outputs without assuming a
    fixed customer count (no hardcoded population size).

    Verifies:
      - Output is non-empty and customer IDs are unique.
      - Every output customer appears exactly once in the profiles
        (count reconciliation between the customer feed and the segment feed).
      - Monetary totals reconcile between the customer feed and the segment
        feed to within half a cent per record (rounding tolerance).
      - When an expected ID set is supplied (e.g. the input feature matrix),
        the output population matches it exactly (no silent loss/addition).
      - When persona validation counts are available, they reconcile with the
        customer feed length.
      - No null cluster assignments or segment labels.

    Args:
        final_customer_df: Customer-level segmented output.
        segment_profiles_df: Segment-level aggregate output.
        persona_validation_results: Dict returned by evaluate_persona_alignment.
        expected_customer_ids: Optional set of input customer IDs for strict
                               population reconciliation.

    Returns:
        Dict[str, Any]: Reconciliation summary (counts, revenue totals, flags).

    Raises:
        AssertionError: When any reconciliation check fails, with a descriptive
                        message identifying the mismatch.
    """
    total_cust = len(final_customer_df)
    assert total_cust > 0, "Segmented customer output is empty."

    assert "customer_id" in final_customer_df.columns, "Missing 'customer_id' in segmented output."
    assert final_customer_df["customer_id"].is_unique, (
        f"Segmented output contains duplicate customer_id values: "
        f"{final_customer_df['customer_id'].duplicated().sum()} duplicate row(s)."
    )

    # Cluster / segment completeness.
    if "cluster_id" in final_customer_df.columns:
        assert final_customer_df["cluster_id"].isna().sum() == 0, "Null cluster_id values in segmented output."
    if "segment_name" in final_customer_df.columns:
        assert final_customer_df["segment_name"].isna().sum() == 0, "Null segment_name values in segmented output."

    # Population reconciliation against the input feature matrix (when supplied).
    if expected_customer_ids is not None:
        output_ids = set(final_customer_df["customer_id"].tolist())
        missing = sorted(set(expected_customer_ids) - output_ids)
        extra = sorted(output_ids - set(expected_customer_ids))
        assert not missing and not extra, (
            f"Customer population mismatch vs. input features: "
            f"{len(missing)} missing {missing[:10]}, {len(extra)} extra {extra[:10]}."
        )

    # Customer-count reconciliation between the two deliverables.
    profile_cust = int(segment_profiles_df["customer_count"].sum()) if "customer_count" in segment_profiles_df.columns else -1
    assert profile_cust == total_cust, (
        f"Customer-count mismatch: customer feed has {total_cust} rows but segment profiles "
        f"sum to {profile_cust}."
    )

    # Revenue reconciliation between the two deliverables.
    total_rev = round(float(final_customer_df["monetary"].sum()), 2) if "monetary" in final_customer_df.columns else 0.0
    profile_rev = round(float(segment_profiles_df["total_revenue"].sum()), 2) if "total_revenue" in segment_profiles_df.columns else 0.0
    revenue_diff = abs(total_rev - profile_rev)
    # Tolerance absorbs per-segment cent-rounding (profile totals are sums of
    # rounded per-segment values). Scales with the number of segments, not
    # the customer count, so the check stays valid for any population size.
    n_segments = len(segment_profiles_df) if len(segment_profiles_df) else 1
    tolerance = 0.01 * n_segments + 0.05
    assert revenue_diff < tolerance, (
        f"Revenue discrepancy between customer feed ({total_rev}) and segment profiles "
        f"({profile_rev}): diff={revenue_diff} exceeds tolerance {tolerance:.2f}."
    )

    # Persona-validation reconciliation (when counts are reported).
    validated_count = persona_validation_results.get("validated_customer_count")
    if validated_count is not None:
        assert int(validated_count) == total_cust, (
            f"Persona validation covered {validated_count} customers but segmented output "
            f"has {total_cust}."
        )

    return {
        "total_customers": total_cust,
        "profile_customer_sum": profile_cust,
        "total_revenue": total_rev,
        "profile_revenue": profile_rev,
        "revenue_discrepancy": round(float(revenue_diff), 4),
        "validated_customer_count": int(validated_count) if validated_count is not None else None,
        "all_checks_passed": True,
    }


def run_pipeline(
    features_path: str = "customer_features.csv",
    transactions_path: str = "data/transactions_clean.csv",
    random_state: int = 42,
    currency: str = DEFAULT_CURRENCY,
) -> Dict[str, Any]:
    """
    Execute full Role C customer segmentation workflow.

    Args:
        features_path: Path to customer-level feature matrix (Role B output).
        transactions_path: Path to cleaned transactions (persona validation only).
        random_state: Random seed for KMeans reproducibility.
        currency: Currency symbol prefix for recommendation monetary wording.
                  Defaults to ``""`` (currency-neutral; no fiat denomination
                  is assumed). Pass a symbol only when confirmed.

    Returns:
        Dict[str, Any]: Execution metadata and summary results.
    """
    logger.info("=================================================================")
    logger.info("   RETAIL-IQ — ROLE C CUSTOMER SEGMENTATION & ANALYTICS PIPELINE")
    logger.info("=================================================================")

    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(OUTPUTS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)

    # Step 1: Preprocessing & Candidate Feature Matrices
    logger.info("[Step 1/7] Loading and preprocessing customer features...")
    df_preprocessed, imputation_meta = load_and_preprocess_customer_features(features_path)
    candidate_matrices = build_candidate_feature_matrices(df_preprocessed)

    # Step 2: Grid Evaluation across K in [2, 8]
    logger.info("[Step 2/7] Evaluating 4 candidate feature sets across K in [2, 8]...")
    metrics_df = evaluate_clustering_grid(candidate_matrices, k_range=range(2, 9), random_state=random_state)
    metrics_csv_path = os.path.join(DATA_DIR, "segmentation_metrics.csv")
    metrics_df.to_csv(metrics_csv_path, index=False)
    logger.info(f"Saved complete evaluation grid to {metrics_csv_path}")

    # Step 3: Model Selection
    logger.info("[Step 3/7] Selecting optimal clustering model...")
    best_candidate, best_k, model, scaler, X_best, rationale = select_best_model(
        metrics_df, candidate_matrices, random_state=random_state
    )
    # Best-row evaluation metrics for the persisted manifest.
    _best_rows = metrics_df[
        (metrics_df["candidate_set"] == best_candidate) & (metrics_df["k"] == best_k)
    ]
    _evaluation = dict(rationale)
    if not _best_rows.empty:
        _evaluation.update(
            {
                "inertia": float(_best_rows.iloc[0]["inertia"]),
                "cluster_sizes": str(_best_rows.iloc[0]["cluster_sizes"]),
                "min_cluster_size": int(_best_rows.iloc[0]["min_cluster_size"]),
                "min_cluster_silhouette": float(_best_rows.iloc[0]["min_cluster_silhouette"]),
                "negative_silhouette_count": int(_best_rows.iloc[0]["negative_silhouette_count"]),
            }
        )
    _dataset_info = {
        "source": features_path,
        "n_customers": int(len(df_preprocessed)),
        "n_features_total": int(df_preprocessed.shape[1]),
        "total_monetary": round(float(df_preprocessed["monetary"].sum()), 2) if "monetary" in df_preprocessed.columns else None,
        "columns": list(df_preprocessed.columns),
    }
    _scoring_config = {
        "loyalty_score": {
            "weights": {"recency": 0.30, "frequency": 0.35, "monetary": 0.35},
            "bounds": [0.0, 100.0],
            "note": "Cohort-relative min-max normalization; see reports for longitudinal anchoring guidance.",
        },
        "offer_sensitivity_score": {
            "weights": {"incidence": 0.70, "depth": 0.30},
            "depth_ceiling": 50.0,
            "bounds": [0.0, 100.0],
            "zero_discount_rule": "offer_dependency == 0.0 maps exactly to 0.0.",
        },
        "currency": currency,
        "currency_note": "Empty string means currency-neutral (no fiat denomination assumed).",
    }
    save_artifacts(
        model,
        scaler,
        best_candidate,
        output_dir=MODELS_DIR,
        feature_names=list(X_best.columns),
        imputation_meta=imputation_meta,
        evaluation_metrics=_evaluation,
        dataset_info=_dataset_info,
        scoring_config=_scoring_config,
        random_state=random_state,
    )

    # Step 4: Cluster Assignment & Behavioral Scoring
    logger.info(f"[Step 4/7] Generating cluster assignments for {best_candidate} at K={best_k}...")
    cluster_labels = model.predict(X_best)
    df_preprocessed["cluster_id"] = cluster_labels

    logger.info("[Step 4/7 - Part B] Computing continuous customer scores...")
    df_preprocessed["loyalty_score"] = compute_rfm_loyalty_score(df_preprocessed)
    df_preprocessed["offer_sensitivity_score"] = compute_offer_sensitivity_score(df_preprocessed)

    # Step 5: Profiling & Dynamic Business Label Assignment
    logger.info("[Step 5/7] Profiling clusters and assigning dynamic business labels...")
    cluster_means = df_preprocessed.groupby("cluster_id").agg({
        "recency_days": "mean",
        "frequency": "mean",
        "monetary": "mean",
        "avg_order_value": "mean",
        "offer_dependency": "mean",
        "spend_trend": "mean",
    }).rename(columns={
        "recency_days": "mean_recency",
        "frequency": "mean_frequency",
        "monetary": "mean_monetary",
        "avg_order_value": "mean_avg_order_value",
        "offer_dependency": "mean_offer_dependency",
        "spend_trend": "mean_spend_trend",
    })

    label_mapping = assign_dynamic_business_labels(cluster_means)
    df_preprocessed["segment_name"] = df_preprocessed["cluster_id"].map(label_mapping)

    # Step 6: Generate Prescriptive Recommendations
    logger.info("[Step 6/7] Generating transparent, data-backed recommendations...")
    df_final = attach_recommendations(df_preprocessed, currency=currency)

    # Reorder columns to guarantee exact Role D contract
    primary_cols = [
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
    # Retain auxiliary fields for analytical completeness
    aux_cols = [c for c in df_final.columns if c not in primary_cols and not c.startswith("log_")]
    final_customer_df = df_final[primary_cols + aux_cols].sort_values("customer_id").reset_index(drop=True)

    segmented_csv_path = os.path.join(DATA_DIR, "segmented_customers.csv")
    final_customer_df.to_csv(segmented_csv_path, index=False)
    logger.info(f"Exported segmented customer records to {segmented_csv_path} ({len(final_customer_df)} rows)")

    # Generate segment-level aggregate profiles
    segment_profiles_df = generate_segment_profiles(final_customer_df, currency=currency)
    profiles_csv_path = os.path.join(DATA_DIR, "segment_profiles.csv")
    segment_profiles_df.to_csv(profiles_csv_path, index=False)
    logger.info(f"Exported segment profiles to {profiles_csv_path} ({len(segment_profiles_df)} rows)")

    # Step 7: Post-Hoc External Validation against persona_true
    logger.info("[Step 7/7] Executing post-hoc external validation against persona_true...")
    persona_validation_results = evaluate_persona_alignment(
        final_customer_df, transactions_path=transactions_path
    )

    # Verification checks (flexible: no hardcoded population size).
    # Reconciles customer counts and revenue between the customer feed and
    # the segment feed, plus population vs. the input feature matrix and
    # persona-validation coverage. Works for any customer count.
    _expected_ids = set(df_preprocessed["customer_id"].tolist())
    reconciliation = validate_pipeline_outputs(
        final_customer_df,
        segment_profiles_df,
        persona_validation_results,
        expected_customer_ids=_expected_ids,
    )
    total_cust = reconciliation["total_customers"]
    total_rev = reconciliation["total_revenue"]
    profile_cust = reconciliation["profile_customer_sum"]
    profile_rev = reconciliation["profile_revenue"]

    logger.info("=================================================================")
    logger.info("   ROLE C PIPELINE COMPLETED SUCCESSFULLY!")
    logger.info(f"   • Selected Feature Set: {best_candidate}")
    logger.info(f"   • Selected K: {best_k}")
    logger.info(f"   • Silhouette Score: {rationale['silhouette_score']:.4f}")
    logger.info(f"   • Davies-Bouldin Index: {rationale['davies_bouldin_index']:.4f}")
    logger.info(f"   • Stability Mean ARI: {rationale['stability_ari_mean']:.4f}")
    logger.info(f"   • Post-Hoc Persona ARI: {persona_validation_results['adjusted_rand_index']:.4f}")
    logger.info(f"   • Post-Hoc Persona NMI: {persona_validation_results['normalized_mutual_info']:.4f}")
    logger.info("=================================================================")

    return {
        "best_candidate": best_candidate,
        "best_k": best_k,
        "rationale": rationale,
        "label_mapping": label_mapping,
        "imputation_meta": imputation_meta,
        "persona_validation": persona_validation_results,
        "customer_output": segmented_csv_path,
        "profiles_output": profiles_csv_path,
        "metrics_output": metrics_csv_path,
        "reconciliation": reconciliation,
        "currency": currency,
    }


if __name__ == "__main__":
    run_pipeline()

