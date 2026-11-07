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
from typing import Dict, Any, Tuple
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
from src.recommendations import attach_recommendations
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


def run_pipeline(
    features_path: str = "customer_features.csv",
    transactions_path: str = "data/transactions_clean.csv",
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Execute full Role C customer segmentation workflow.

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
    save_artifacts(model, scaler, best_candidate, output_dir=MODELS_DIR)

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
    df_final = attach_recommendations(df_preprocessed)

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
    segment_profiles_df = generate_segment_profiles(final_customer_df)
    profiles_csv_path = os.path.join(DATA_DIR, "segment_profiles.csv")
    segment_profiles_df.to_csv(profiles_csv_path, index=False)
    logger.info(f"Exported segment profiles to {profiles_csv_path} ({len(segment_profiles_df)} rows)")

    # Step 7: Post-Hoc External Validation against persona_true
    logger.info("[Step 7/7] Executing post-hoc external validation against persona_true...")
    persona_validation_results = evaluate_persona_alignment(
        final_customer_df, transactions_path=transactions_path
    )

    # Verification checks
    total_cust = len(final_customer_df)
    total_rev = round(float(final_customer_df["monetary"].sum()), 2)
    profile_cust = int(segment_profiles_df["customer_count"].sum())
    profile_rev = round(float(segment_profiles_df["total_revenue"].sum()), 2)

    assert total_cust == 200, f"Expected 200 customers, got {total_cust}"
    assert profile_cust == 200, f"Profile customers sum {profile_cust} != 200"
    assert abs(total_rev - profile_rev) < 0.05, f"Revenue discrepancy: {total_rev} vs {profile_rev}"

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
    }


if __name__ == "__main__":
    run_pipeline()

