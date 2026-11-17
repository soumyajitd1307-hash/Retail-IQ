"""
Retail IQ — Automated Backend-to-Frontend Data Synchronization
==============================================================
Author: Role C (Analytics, Validation & ML Lead)

This module automates the synchronization between the Retail IQ backend machine
learning pipeline and the frontend web dashboard.

Whenever the backend pipeline executes successfully, this script reads the latest
produced deliverables:
  1. data/segmented_customers.csv  -> frontend/src/data/customers.json
  2. data/segment_profiles.csv     -> frontend/src/data/segmentProfiles.json
  3. data/segmentation_metrics.csv -> frontend/src/data/segmentationMetrics.json
  4. models/model_metadata.json    -> frontend/src/data/modelMetadata.json

Integrity & Safety Guarantees:
  - Preserves exact JSON schemas expected by frontend/src/services/dataService.js.
  - Does NOT modify original backend CSV files, trained models, or hyperparameters.
  - Enforces numeric precision and converts float NaN/Inf to null.
  - Validates customer count and revenue reconciliation before and after export.
  - Employs atomic file replacement (writes to .tmp before replacing) so that
    existing frontend files are never corrupted or partially written if an error occurs.
  - Aborts safely without touching frontend files if source data fails validation.
"""

import os
import sys
import json
import logging
import math
import shutil
import tempfile
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
import numpy as np

logger = logging.getLogger("export_frontend_data")

# Required columns in segmented_customers.csv
REQUIRED_CUSTOMER_COLUMNS = [
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
    # Consumed by frontend/src/components/common/CustomerDrawer.jsx
    "repeat_rate",
    "promo_lift",
]

# Required columns in segment_profiles.csv
REQUIRED_PROFILE_COLUMNS = [
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
    "mean_spend_trend",
    "median_recency",
    "median_frequency",
    "median_monetary",
    "median_aov",
    "strategic_playbook",
]

# Required columns in segmentation_metrics.csv
REQUIRED_METRICS_COLUMNS = [
    "candidate_set",
    "k",
    "feature_count",
    "features",
    "inertia",
    "silhouette_score",
    "davies_bouldin_index",
    "calinski_harabasz_score",
    "cluster_sizes",
    "min_cluster_size",
    "min_cluster_pct",
    "min_cluster_silhouette",
    "negative_silhouette_count",
    "stability_ari_mean",
]

# Fields of model_metadata.json['evaluation_metrics'] consumed by
# frontend/src/services/dataService.js (and therefore by the UI).
REQUIRED_EVALUATION_METRIC_FIELDS = [
    "selected_candidate_set",
    "selected_k",
    "features",
    "silhouette_score",
    "davies_bouldin_index",
    "calinski_harabasz_score",
    "stability_ari_mean",
]

# Fields above that must hold a finite number (not bool, NaN or Inf).
NUMERIC_EVALUATION_METRIC_FIELDS = [
    "silhouette_score",
    "davies_bouldin_index",
    "calinski_harabasz_score",
    "stability_ari_mean",
]


class ExportValidationError(ValueError):
    """Raised when data validation fails during frontend export."""
    pass


def df_to_clean_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Convert a DataFrame to a list of dicts, converting all NaN/Inf floats
    cleanly to Python None (which serializes to JSON null).
    """
    json_str = df.to_json(orient="records", date_format="iso")
    return json.loads(json_str)


def atomic_write_json(data: Any, target_path: str, indent: int = 2) -> None:
    """
    Write data to target_path atomically using a temporary file.

    Guarantees that target_path is either completely updated or untouched.
    """
    target_dir = os.path.dirname(target_path)
    if target_dir:
        os.makedirs(target_dir, exist_ok=True)

    temp_path = f"{target_path}.tmp"
    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=indent, ensure_ascii=False)
            f.write("\n")
            f.flush()
            os.fsync(f.fileno())

        # Atomic replace
        os.replace(temp_path, target_path)
    except Exception as exc:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        raise IOError(f"Failed to atomically write JSON to {target_path}: {exc}") from exc


def validate_model_metadata(
    model_meta: Dict[str, Any],
    df_metrics: pd.DataFrame,
    meta_path: str,
    metrics_path: str,
) -> None:
    """
    Validate that the model manifest can satisfy the frontend data contract.

    Checks the top-level keys consumed by dataService.js, the full set of
    evaluation_metrics fields it reads, the structural validity of the
    champion configuration, and that the champion actually appears in the
    evaluated grid. No fixed candidate name or cluster count is assumed.
    """
    for req_key in ("candidate_set", "n_clusters", "cluster_centers", "evaluation_metrics"):
        if req_key not in model_meta:
            raise ExportValidationError(f"Missing required key '{req_key}' in {meta_path}")

    n_clusters = model_meta["n_clusters"]
    if isinstance(n_clusters, bool) or not isinstance(n_clusters, int) or n_clusters <= 0:
        raise ExportValidationError(
            f"Invalid 'n_clusters' in {meta_path}: expected a positive integer, got {n_clusters!r}"
        )

    evaluation = model_meta["evaluation_metrics"]
    if not isinstance(evaluation, dict):
        raise ExportValidationError(
            f"'evaluation_metrics' in {meta_path} must be an object, got {type(evaluation).__name__}"
        )

    missing_fields = [k for k in REQUIRED_EVALUATION_METRIC_FIELDS if k not in evaluation]
    if missing_fields:
        raise ExportValidationError(
            f"{meta_path} evaluation_metrics is missing required fields consumed by the "
            f"frontend: {missing_fields}"
        )

    champion_name = evaluation["selected_candidate_set"]
    if not isinstance(champion_name, str) or not champion_name.strip():
        raise ExportValidationError(
            f"Invalid evaluation_metrics.selected_candidate_set in {meta_path}: "
            f"expected a non-empty string, got {champion_name!r}"
        )

    champion_k = evaluation["selected_k"]
    if isinstance(champion_k, bool) or not isinstance(champion_k, int) or champion_k <= 0:
        raise ExportValidationError(
            f"Invalid evaluation_metrics.selected_k in {meta_path}: "
            f"expected a positive integer, got {champion_k!r}"
        )

    features = evaluation["features"]
    if not isinstance(features, str) or not features.strip():
        raise ExportValidationError(
            f"Invalid evaluation_metrics.features in {meta_path}: "
            f"expected a non-empty string, got {features!r}"
        )

    for field in NUMERIC_EVALUATION_METRIC_FIELDS:
        value = evaluation[field]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(float(value)):
            raise ExportValidationError(
                f"Invalid evaluation_metrics.{field} in {meta_path}: "
                f"expected a finite number, got {value!r}"
            )

    champion_rows = df_metrics[
        (df_metrics["candidate_set"] == champion_name) & (df_metrics["k"] == champion_k)
    ]
    if champion_rows.empty:
        available_sets = sorted(str(s) for s in df_metrics["candidate_set"].unique())
        available_ks = sorted(int(k) for k in df_metrics["k"].unique())
        raise ExportValidationError(
            f"Champion metadata in {meta_path} refers to candidate_set={champion_name!r}, "
            f"k={champion_k} which is not present in {metrics_path}. "
            f"Available candidate sets: {available_sets}; evaluated k values: {available_ks}"
        )

    if champion_k != n_clusters:
        raise ExportValidationError(
            f"Inconsistent champion metadata in {meta_path}: evaluation_metrics.selected_k="
            f"{champion_k} does not match n_clusters={n_clusters}"
        )


def validate_source_files(
    data_dir: str = "data",
    models_dir: str = "models",
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """
    Load and validate backend deliverable files before performing any export.

    Returns:
        Tuple of (df_customers, df_profiles, df_metrics, model_metadata)

    Raises:
        ExportValidationError: When files are missing, malformed, or inconsistent.
    """
    cust_path = os.path.join(data_dir, "segmented_customers.csv")
    prof_path = os.path.join(data_dir, "segment_profiles.csv")
    metrics_path = os.path.join(data_dir, "segmentation_metrics.csv")
    meta_path = os.path.join(models_dir, "model_metadata.json")

    for path, desc in [
        (cust_path, "segmented customers CSV"),
        (prof_path, "segment profiles CSV"),
        (metrics_path, "segmentation metrics CSV"),
        (meta_path, "model metadata JSON"),
    ]:
        if not os.path.exists(path):
            raise ExportValidationError(f"Missing backend deliverable ({desc}) at: {path}")

    # 1. Load segmented customers
    try:
        df_cust = pd.read_csv(cust_path)
    except Exception as e:
        raise ExportValidationError(f"Cannot read {cust_path}: {e}")

    if df_cust.empty:
        raise ExportValidationError(f"{cust_path} is empty.")

    missing_cust_cols = [c for c in REQUIRED_CUSTOMER_COLUMNS if c not in df_cust.columns]
    if missing_cust_cols:
        raise ExportValidationError(
            f"{cust_path} is missing required columns: {missing_cust_cols}"
        )

    if not df_cust["customer_id"].is_unique:
        duplicates = df_cust[df_cust["customer_id"].duplicated()]["customer_id"].tolist()
        raise ExportValidationError(f"Duplicate customer_ids found in {cust_path}: {duplicates}")

    # 2. Load segment profiles
    try:
        df_prof = pd.read_csv(prof_path)
    except Exception as e:
        raise ExportValidationError(f"Cannot read {prof_path}: {e}")

    if df_prof.empty:
        raise ExportValidationError(f"{prof_path} is empty.")

    missing_prof_cols = [c for c in REQUIRED_PROFILE_COLUMNS if c not in df_prof.columns]
    if missing_prof_cols:
        raise ExportValidationError(
            f"{prof_path} is missing required columns: {missing_prof_cols}"
        )

    # Reconcile customer counts between customer feed and profile feed
    total_cust_rows = len(df_cust)
    profile_cust_sum = int(df_prof["customer_count"].sum())
    if total_cust_rows != profile_cust_sum:
        raise ExportValidationError(
            f"Customer count mismatch: {cust_path} has {total_cust_rows} rows, "
            f"but {prof_path} sums to {profile_cust_sum} customers."
        )

    # Reconcile revenue between customer feed and profile feed
    total_cust_rev = round(float(df_cust["monetary"].sum()), 2)
    profile_rev_sum = round(float(df_prof["total_revenue"].sum()), 2)
    rev_diff = abs(total_cust_rev - profile_rev_sum)
    if rev_diff >= 0.05:
        raise ExportValidationError(
            f"Revenue discrepancy between {cust_path} ({total_cust_rev:.2f}) and "
            f"{prof_path} ({profile_rev_sum:.2f}): difference is {rev_diff:.4f} units."
        )

    # 3. Load segmentation metrics
    try:
        df_metrics = pd.read_csv(metrics_path)
    except Exception as e:
        raise ExportValidationError(f"Cannot read {metrics_path}: {e}")

    if df_metrics.empty:
        raise ExportValidationError(f"{metrics_path} is empty.")

    missing_metrics_cols = [c for c in REQUIRED_METRICS_COLUMNS if c not in df_metrics.columns]
    if missing_metrics_cols:
        raise ExportValidationError(
            f"{metrics_path} is missing required columns: {missing_metrics_cols}"
        )

    # 4. Load model metadata
    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            model_meta = json.load(f)
    except Exception as e:
        raise ExportValidationError(f"Cannot parse JSON in {meta_path}: {e}")

    if not isinstance(model_meta, dict):
        raise ExportValidationError(f"Expected dict in {meta_path}, got {type(model_meta)}")

    validate_model_metadata(model_meta, df_metrics, meta_path, metrics_path)

    return df_cust, df_prof, df_metrics, model_meta


def validate_exported_json(
    frontend_dir: str,
    expected_cust_count: int,
    expected_revenue: float,
    expected_profile_count: int,
    expected_metrics_count: int,
) -> Dict[str, Any]:
    """
    Re-read exported JSON files from frontend_dir and verify consistency.
    """
    cust_json_path = os.path.join(frontend_dir, "customers.json")
    prof_json_path = os.path.join(frontend_dir, "segmentProfiles.json")
    metrics_json_path = os.path.join(frontend_dir, "segmentationMetrics.json")
    meta_json_path = os.path.join(frontend_dir, "modelMetadata.json")

    with open(cust_json_path, "r", encoding="utf-8") as f:
        exported_cust = json.load(f)
    with open(prof_json_path, "r", encoding="utf-8") as f:
        exported_prof = json.load(f)
    with open(metrics_json_path, "r", encoding="utf-8") as f:
        exported_metrics = json.load(f)
    with open(meta_json_path, "r", encoding="utf-8") as f:
        exported_meta = json.load(f)

    # Verify counts
    if len(exported_cust) != expected_cust_count:
        raise ExportValidationError(
            f"Exported customers.json has {len(exported_cust)} records, expected {expected_cust_count}"
        )

    if len(exported_prof) != expected_profile_count:
        raise ExportValidationError(
            f"Exported segmentProfiles.json has {len(exported_prof)} records, expected {expected_profile_count}"
        )

    if len(exported_metrics) != expected_metrics_count:
        raise ExportValidationError(
            f"Exported segmentationMetrics.json has {len(exported_metrics)} records, expected {expected_metrics_count}"
        )

    # Verify exported revenue
    exported_rev = round(sum(float(c.get("monetary", 0.0)) for c in exported_cust), 2)
    exported_prof_rev = round(sum(float(p.get("total_revenue", 0.0)) for p in exported_prof), 2)

    if abs(exported_rev - expected_revenue) >= 0.05:
        raise ExportValidationError(
            f"Exported customers revenue sum ({exported_rev:.2f}) does not match expected ({expected_revenue:.2f})"
        )

    if abs(exported_prof_rev - expected_revenue) >= 0.05:
        raise ExportValidationError(
            f"Exported segment profiles revenue sum ({exported_prof_rev:.2f}) does not match expected ({expected_revenue:.2f})"
        )

    return {
        "verified_customer_count": len(exported_cust),
        "verified_profile_count": len(exported_prof),
        "verified_metrics_count": len(exported_metrics),
        "verified_revenue": exported_rev,
        "model_candidate_set": exported_meta.get("candidate_set"),
        "model_n_clusters": exported_meta.get("n_clusters"),
    }


def export_backend_to_frontend(
    data_dir: str = "data",
    models_dir: str = "models",
    frontend_dir: str = "frontend/src/data",
) -> Dict[str, Any]:
    """
    Main entry point: Read backend outputs, validate, atomically export
    clean JSON assets to frontend_dir, and re-validate exported data.

    Args:
        data_dir: Path to directory containing CSV outputs (default 'data').
        models_dir: Path to directory containing model metadata (default 'models').
        frontend_dir: Path to target frontend JSON directory (default 'frontend/src/data').

    Returns:
        Dict[str, Any]: Summary of exported records and verification results.
    """
    logger.info("Starting automated backend-to-frontend data synchronization...")
    logger.info(f"Source dirs: data='{data_dir}', models='{models_dir}' | Target: '{frontend_dir}'")

    # Step 1: Validate input files
    df_cust, df_prof, df_metrics, model_meta = validate_source_files(
        data_dir=data_dir, models_dir=models_dir
    )

    cust_count = len(df_cust)
    total_rev = round(float(df_cust["monetary"].sum()), 2)
    prof_count = len(df_prof)
    metrics_count = len(df_metrics)

    logger.info(
        f"Source data verified: {cust_count} customers, {prof_count} profiles, "
        f"{metrics_count} metric records, total revenue = {total_rev:,.2f}"
    )

    # Step 2: Convert to clean records (converting NaN/Inf to None)
    cust_records = df_to_clean_records(df_cust)
    prof_records = df_to_clean_records(df_prof)
    metrics_records = df_to_clean_records(df_metrics)

    # Step 3: Stage all four JSON assets, validate the staged set, then commit.
    # Nothing in frontend_dir is replaced until every staged file is verified,
    # so a failed write or validation cannot leave a partial/inconsistent set.
    cust_out_path = os.path.join(frontend_dir, "customers.json")
    prof_out_path = os.path.join(frontend_dir, "segmentProfiles.json")
    metrics_out_path = os.path.join(frontend_dir, "segmentationMetrics.json")
    meta_out_path = os.path.join(frontend_dir, "modelMetadata.json")

    os.makedirs(frontend_dir, exist_ok=True)
    staging_dir = tempfile.mkdtemp(prefix=".retailiq-export-", dir=frontend_dir)
    try:
        staged_files = {
            "customers.json": cust_records,
            "segmentProfiles.json": prof_records,
            "segmentationMetrics.json": metrics_records,
            "modelMetadata.json": model_meta,
        }
        for filename, payload in staged_files.items():
            atomic_write_json(payload, os.path.join(staging_dir, filename))

        logger.info("Validating staged frontend JSON before replacing existing assets...")
        validate_exported_json(
            frontend_dir=staging_dir,
            expected_cust_count=cust_count,
            expected_revenue=total_rev,
            expected_profile_count=prof_count,
            expected_metrics_count=metrics_count,
        )

        logger.info(
            f"Committing {cust_count} customers, {prof_count} segment profiles, "
            f"{metrics_count} metric evaluations and model metadata -> {frontend_dir}"
        )
        for filename in staged_files:
            os.replace(
                os.path.join(staging_dir, filename),
                os.path.join(frontend_dir, filename),
            )

        # Step 4: Re-validate the committed files
        validation_summary = validate_exported_json(
            frontend_dir=frontend_dir,
            expected_cust_count=cust_count,
            expected_revenue=total_rev,
            expected_profile_count=prof_count,
            expected_metrics_count=metrics_count,
        )
    finally:
        shutil.rmtree(staging_dir, ignore_errors=True)

    logger.info("=================================================================")
    logger.info("   FRONTEND DATA SYNCHRONIZATION COMPLETED SUCCESSFULLY!")
    logger.info(f"   • Exported Customers: {cust_count} records -> {cust_out_path}")
    logger.info(f"   • Exported Segment Profiles: {prof_count} records -> {prof_out_path}")
    logger.info(f"   • Exported Grid Metrics: {metrics_count} records -> {metrics_out_path}")
    logger.info(f"   • Exported Model Metadata -> {meta_out_path}")
    logger.info(f"   • Total Reconciled Revenue: {total_rev:,.2f}")
    logger.info("=================================================================")

    return {
        "status": "success",
        "exported_files": {
            "customers": cust_out_path,
            "segment_profiles": prof_out_path,
            "segmentation_metrics": metrics_out_path,
            "model_metadata": meta_out_path,
        },
        "validation": validation_summary,
    }


def main():
    """CLI runner for standalone synchronization."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    data_dir = sys.argv[1] if len(sys.argv) > 1 else "data"
    models_dir = sys.argv[2] if len(sys.argv) > 2 else "models"
    frontend_dir = sys.argv[3] if len(sys.argv) > 3 else "frontend/src/data"

    try:
        res = export_backend_to_frontend(
            data_dir=data_dir, models_dir=models_dir, frontend_dir=frontend_dir
        )
        print(f"Sync completed successfully: {res['validation']}")
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
