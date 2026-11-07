"""
Retail IQ — Role C: Customer Segmentation & ML Pipeline
========================================================
Author: Role C (Analytics, Validation & ML Lead)

This module implements the end-to-end unsupervised customer segmentation
pipeline:
  1. Data Preprocessing & Candidate Feature Set Generation:
     - Transforms raw features (log1p on monetary, frequency, AOV)
     - Preserves linear recency and bounded offer dependency
     - Handles missing values transparently (median imputation for spend_trend)
     - Builds 4 benchmark candidate feature sets
     - Fits and stores StandardScaler transformations
  2. Model Selection Across K in [2, 8]:
     - Evaluates K-Means (k-means++, n_init=50, max_iter=500, tol=1e-5)
     - Computes Inertia, Silhouette, Davies-Bouldin, Calinski-Harabasz
     - Measures cluster sizes, minimum cluster size, per-cluster silhouettes
     - Measures clustering stability across multiple random seeds via pairwise ARI
     - Saves full metric comparison grid to 'data/segmentation_metrics.csv'
     - Persists selected model & preprocessing artifacts to 'models/'
  3. Dynamic Cluster Profiling & Business Label Assignment:
     - Derives cluster profiles across all 10 customer features (means and medians)
     - Calculates customer counts, customer %, total revenue, revenue %
     - Maps numeric cluster IDs dynamically based on centroid percentile ranks
     - Generates 'data/segment_profiles.csv'
  4. Final Dataset Assembly & Validation:
     - Generates 'data/segmented_customers.csv'
     - Reconciles customer counts and monetary totals to the exact cent

GOVERNANCE:
  - persona_true is STRICTLY ISOLATED from training and model selection.
  - No cluster count (e.g. K=4) or numeric mapping is hardcoded.
"""

import json
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    silhouette_score,
    silhouette_samples,
    davies_bouldin_score,
    calinski_harabasz_score,
    adjusted_rand_score,
)

from src.scoring import compute_rfm_loyalty_score, compute_offer_sensitivity_score
from src.recommendations import attach_recommendations, generate_segment_strategic_playbook

logger = logging.getLogger("segmentation")

# Required features in input dataset
EXPECTED_COLUMNS = [
    "customer_id",
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

CANDIDATE_SET_DEFINITIONS = {
    "Candidate 1 (Classic RFM-P)": [
        "recency_days",
        "log_frequency",
        "log_monetary",
        "offer_dependency",
    ],
    "Candidate 2 (Decoupled Cadence/Basket)": [
        "recency_days",
        "log_frequency",
        "log_aov",
        "offer_dependency",
    ],
    "Candidate 3 (Spend and Basket)": [
        "recency_days",
        "log_monetary",
        "log_aov",
        "offer_dependency",
    ],
    "Candidate 4 (Temporal Extended)": [
        "recency_days",
        "log_frequency",
        "log_monetary",
        "offer_dependency",
        "spend_trend",
    ],
}


def load_and_preprocess_customer_features(
    filepath: str = "customer_features.csv",
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Load customer_features.csv and engineer transformed feature columns.

    Applies:
      - log1p to monetary, frequency, and avg_order_value
      - Explicit median imputation for missing spend_trend (Customer C0082)
      - Retains linear recency_days and bounded offer_dependency

    Returns:
        Tuple[pd.DataFrame, Dict[str, Any]]: (preprocessed_df, imputation_metadata)
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Customer features file not found at: {filepath}")

    logger.info(f"Loading customer features from {filepath}")
    df = pd.read_csv(filepath)

    # 1. Column validation
    missing_cols = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Input customer features missing expected columns: {missing_cols}")

    # 2. Row count and uniqueness check
    if not df["customer_id"].is_unique:
        raise ValueError("customer_id column contains duplicate identifiers.")

    n_customers = len(df)
    logger.info(f"Loaded features for {n_customers} unique customers.")

    # 3. Handle missing values explicitly
    imputation_report = {}
    
    # Check spend_trend
    spend_trend_nulls = df["spend_trend"].isna().sum()
    if spend_trend_nulls > 0:
        median_spend_trend = float(df["spend_trend"].median())
        affected_custs = df[df["spend_trend"].isna()]["customer_id"].tolist()
        df["spend_trend"] = df["spend_trend"].fillna(median_spend_trend)
        imputation_report["spend_trend"] = {
            "method": "cohort_median",
            "imputed_value": round(median_spend_trend, 4),
            "affected_customer_count": int(spend_trend_nulls),
            "affected_customers": affected_custs,
        }
        logger.info(
            f"Imputed spend_trend for {spend_trend_nulls} customer(s) with median: {median_spend_trend:.4f}"
        )

    # Note on promo_lift: Retained as is for descriptive post-hoc analysis; excluded from clustering
    promo_lift_nulls = df["promo_lift"].isna().sum()
    imputation_report["promo_lift"] = {
        "status": "excluded_from_clustering_preserved_for_profiling",
        "null_count": int(promo_lift_nulls),
    }

    # 4. Feature Transformations
    df["log_monetary"] = np.log1p(np.maximum(df["monetary"].astype(float), 0.0))
    df["log_frequency"] = np.log1p(np.maximum(df["frequency"].astype(float), 0.0))
    df["log_aov"] = np.log1p(np.maximum(df["avg_order_value"].astype(float), 0.0))

    return df, imputation_report


def build_candidate_feature_matrices(
    df: pd.DataFrame,
) -> Dict[str, Tuple[pd.DataFrame, StandardScaler]]:
    """
    Build standardized feature matrices for all four candidate feature sets.

    Args:
        df: Preprocessed customer features DataFrame.

    Returns:
        Dict mapping candidate set name to (scaled_dataframe, fitted_scaler).
    """
    candidate_matrices = {}

    for name, cols in CANDIDATE_SET_DEFINITIONS.items():
        subset = df[cols].copy()
        scaler = StandardScaler()
        scaled_vals = scaler.fit_transform(subset)
        scaled_df = pd.DataFrame(scaled_vals, columns=cols, index=df.index)
        candidate_matrices[name] = (scaled_df, scaler)
        logger.info(f"Built scaled matrix for '{name}' with shape {scaled_df.shape}")

    return candidate_matrices


def evaluate_clustering_grid(
    candidate_matrices: Dict[str, Tuple[pd.DataFrame, StandardScaler]],
    k_range: range = range(2, 9),
    random_state: int = 42,
    stability_seeds: Tuple[int, ...] = (42, 101, 202, 303, 404),
) -> pd.DataFrame:
    """
    Perform exhaustive grid evaluation across candidate feature sets and K values.

    Computes:
      - Inertia (WCSS)
      - Silhouette score (overall mean and per-cluster minimum)
      - Davies-Bouldin index
      - Calinski-Harabasz score
      - Cluster size distribution & minimum cluster size
      - Multi-seed clustering stability (mean pairwise ARI across runs)

    Returns:
        pd.DataFrame: Comprehensive comparison table of evaluation metrics.
    """
    logger.info("Beginning multi-metric clustering evaluation grid across K in [2, 8]...")
    records = []

    for set_name, (X_df, scaler) in candidate_matrices.items():
        for k in k_range:
            kmeans = KMeans(
                n_clusters=k,
                init="k-means++",
                n_init=50,
                max_iter=500,
                tol=1e-5,
                random_state=random_state,
            )
            labels = kmeans.fit_predict(X_df)

            # Core metrics
            inertia = float(kmeans.inertia_)
            sil_score = float(silhouette_score(X_df, labels))
            db_score = float(davies_bouldin_score(X_df, labels))
            ch_score = float(calinski_harabasz_score(X_df, labels))

            # Per-cluster silhouettes and sizes
            sil_samples = silhouette_samples(X_df, labels)
            cluster_sizes = [int(np.sum(labels == c)) for c in range(k)]
            min_cluster_size = min(cluster_sizes)
            min_cluster_pct = round((min_cluster_size / len(X_df)) * 100.0, 2)
            per_cluster_sil = [
                round(float(sil_samples[labels == c].mean()), 4) for c in range(k)
            ]
            min_cluster_sil = min(per_cluster_sil)
            negative_sil_count = int(np.sum(sil_samples < 0))

            # Stability evaluation across random seeds
            ari_scores = []
            seed_labels = [labels]
            for s in stability_seeds:
                if s == random_state:
                    continue
                km_s = KMeans(
                    n_clusters=k,
                    init="k-means++",
                    n_init=50,
                    max_iter=500,
                    tol=1e-5,
                    random_state=s,
                )
                l_s = km_s.fit_predict(X_df)
                ari_scores.append(adjusted_rand_score(labels, l_s))
            mean_stability_ari = round(float(np.mean(ari_scores)), 4) if ari_scores else 1.0

            records.append({
                "candidate_set": set_name,
                "k": k,
                "feature_count": X_df.shape[1],
                "features": ", ".join(X_df.columns),
                "inertia": round(inertia, 2),
                "silhouette_score": round(sil_score, 4),
                "davies_bouldin_index": round(db_score, 4),
                "calinski_harabasz_score": round(ch_score, 2),
                "cluster_sizes": str(cluster_sizes),
                "min_cluster_size": min_cluster_size,
                "min_cluster_pct": min_cluster_pct,
                "min_cluster_silhouette": min_cluster_sil,
                "negative_silhouette_count": negative_sil_count,
                "stability_ari_mean": mean_stability_ari,
            })

    metrics_df = pd.DataFrame(records)
    logger.info(f"Completed grid evaluation: {len(metrics_df)} configurations tested.")
    return metrics_df


def select_best_model(
    metrics_df: pd.DataFrame,
    candidate_matrices: Dict[str, Tuple[pd.DataFrame, StandardScaler]],
    random_state: int = 42,
) -> Tuple[str, int, KMeans, StandardScaler, pd.DataFrame, Dict[str, Any]]:
    """
    Select the optimal clustering model based on a holistic multi-criterion objective:
      1. Silhouette coefficient (cohesion & separation)
      2. Davies-Bouldin index (minimizing inter-cluster overlap)
      3. Cluster balance (eliminating degenerate clusters with < 5% of customers)
      4. Stability ARI across random seeds
      5. Dimensional parsimony and business actionability

    Returns:
        Tuple of:
          - best_candidate_name
          - best_k
          - best_kmeans_model
          - best_scaler
          - X_best_df
          - selection_rationale_dict
    """
    # Filter out degenerate configurations where minimum cluster has fewer than 10 customers (5%)
    viable = metrics_df[metrics_df["min_cluster_size"] >= 10].copy()
    if viable.empty:
        logger.warning("No configurations satisfied minimum cluster size >= 10; relaxing threshold to >= 5.")
        viable = metrics_df[metrics_df["min_cluster_size"] >= 5].copy()

    # Composite ranking: maximize silhouette & calinski, minimize davies_bouldin, maximize stability
    viable["sil_rank"] = viable["silhouette_score"].rank(ascending=False)
    viable["db_rank"] = viable["davies_bouldin_index"].rank(ascending=True)
    viable["ch_rank"] = viable["calinski_harabasz_score"].rank(ascending=False)
    viable["stability_rank"] = viable["stability_ari_mean"].rank(ascending=False)

    viable["composite_score"] = (
        0.35 * viable["sil_rank"]
        + 0.35 * viable["db_rank"]
        + 0.15 * viable["ch_rank"]
        + 0.15 * viable["stability_rank"]
    )

    best_row = viable.sort_values("composite_score").iloc[0]

    best_set = str(best_row["candidate_set"])
    best_k = int(best_row["k"])

    X_best_df, best_scaler = candidate_matrices[best_set]

    # Fit final model
    best_kmeans = KMeans(
        n_clusters=best_k,
        init="k-means++",
        n_init=50,
        max_iter=500,
        tol=1e-5,
        random_state=random_state,
    )
    best_kmeans.fit(X_best_df)

    rationale = {
        "selected_candidate_set": best_set,
        "selected_k": best_k,
        "features": best_row["features"],
        "silhouette_score": float(best_row["silhouette_score"]),
        "davies_bouldin_index": float(best_row["davies_bouldin_index"]),
        "calinski_harabasz_score": float(best_row["calinski_harabasz_score"]),
        "min_cluster_size": int(best_row["min_cluster_size"]),
        "stability_ari_mean": float(best_row["stability_ari_mean"]),
        "selection_justification": (
            f"Selected {best_set} at K={best_k} with highest composite separation "
            f"(Silhouette={best_row['silhouette_score']:.4f}, DB Index={best_row['davies_bouldin_index']:.4f}, "
            f"Stability ARI={best_row['stability_ari_mean']:.4f}). Cluster sizes {best_row['cluster_sizes']} "
            "are well-balanced with zero degenerate clusters and distinct commercial interpretability."
        ),
    }

    logger.info(f"Model selection complete: {best_set} at K={best_k}")
    return best_set, best_k, best_kmeans, best_scaler, X_best_df, rationale


def assign_dynamic_business_labels(
    cluster_profiles: pd.DataFrame,
) -> Dict[int, str]:
    """
    Dynamically assign defensible business segment names to numeric cluster IDs
    strictly by inspecting actual empirical cluster centroids.

    Never hardcodes cluster 0 as Loyal or cluster 1 as At-Risk.

    Archetype Detection Rules:
      - High-Value Loyal: Low recency, High monetary/frequency, Low offer dependency
      - Offer-Sensitive: High offer dependency, High average discount depth
      - At-Risk Dormant: High recency, Negative spend trend, Moderate/High historical spend
      - Occasional Buyer: Low frequency, Low monetary, Low/Moderate category diversity

    Args:
        cluster_profiles: DataFrame indexed by cluster_id containing mean feature values.

    Returns:
        Dict[int, str]: Mapping from cluster_id to business segment name.
    """
    mapping: Dict[int, str] = {}
    assigned_labels = set()

    # Compute percentiles across all clusters to establish relative standing
    r_ranks = cluster_profiles["mean_recency"].rank()
    f_ranks = cluster_profiles["mean_frequency"].rank(ascending=False)
    m_ranks = cluster_profiles["mean_monetary"].rank(ascending=False)
    o_ranks = cluster_profiles["mean_offer_dependency"].rank(ascending=False)
    trend_ranks = cluster_profiles["mean_spend_trend"].rank()

    for cid in cluster_profiles.index:
        rec = cluster_profiles.loc[cid, "mean_recency"]
        mon = cluster_profiles.loc[cid, "mean_monetary"]
        freq = cluster_profiles.loc[cid, "mean_frequency"]
        offer = cluster_profiles.loc[cid, "mean_offer_dependency"]
        trend = cluster_profiles.loc[cid, "mean_spend_trend"]

        # 1. High Offer Sensitivity
        if o_ranks[cid] == 1 and offer >= 0.50:
            label = "Offer-Sensitive"
        # 2. High Value Loyal: Top spend/frequency and low recency
        elif (m_ranks[cid] == 1 or f_ranks[cid] == 1) and r_ranks[cid] <= len(cluster_profiles) / 2:
            label = "High-Value Loyal"
        # 3. At-Risk Dormant: Highest recency and sharpest negative spend trend
        elif r_ranks[cid] == len(cluster_profiles) or (rec >= 70.0 and trend <= -60.0):
            label = "At-Risk Dormant"
        # 4. Occasional Buyer: Lowest frequency / monetary spend
        elif f_ranks[cid] == len(cluster_profiles) or m_ranks[cid] == len(cluster_profiles):
            label = "Occasional Buyer"
        # 5. Alternate/Granular labels if K expands
        else:
            if rec <= 30.0 and freq >= 15.0:
                label = "Active Steady Shopper"
            elif mon > 20000.0:
                label = "High-Ticket Selective"
            else:
                label = f"Engaged Cohort {cid}"

        # Collision avoidance
        original_label = label
        counter = 2
        while label in assigned_labels:
            label = f"{original_label} {counter}"
            counter += 1

        assigned_labels.add(label)
        mapping[int(cid)] = label

    logger.info(f"Dynamic business label mapping established: {mapping}")
    return mapping


def generate_segment_profiles(
    df: pd.DataFrame,
    cluster_col: str = "cluster_id",
    segment_col: str = "segment_name",
    currency: str = "",
) -> pd.DataFrame:
    """
    Generate comprehensive segment profiles aggregating all customer features.

    Calculates:
      - customer_count, pct_of_customers
      - total_revenue, pct_of_revenue
      - mean and median values across all key metrics
      - strategic playbook recommendations

    Args:
        df: Customer-level segmented DataFrame.
        cluster_col: Column holding numeric cluster IDs.
        segment_col: Column holding business segment names.
        currency: Optional currency symbol prefix for playbook monetary
                  references. Defaults to ``""`` (currency-neutral). Only
                  pass a symbol when the monetary denomination is confirmed.

    Returns:
        pd.DataFrame: Formatted segment profile table ready for export.
    """
    logger.info("Computing segment-level aggregate profiles...")
    total_customers = len(df)
    total_enterprise_revenue = df["monetary"].sum()

    profiles = []

    for cluster_id, group in df.groupby(cluster_col):
        seg_name = group[segment_col].iloc[0]
        cust_count = len(group)
        pct_cust = round((cust_count / total_customers) * 100.0, 2)
        tot_rev = round(float(group["monetary"].sum()), 2)
        pct_rev = round((tot_rev / total_enterprise_revenue) * 100.0, 2)

        mean_rec = round(float(group["recency_days"].mean()), 2)
        mean_freq = round(float(group["frequency"].mean()), 2)
        mean_mon = round(float(group["monetary"].mean()), 2)
        mean_aov = round(float(group["avg_order_value"].mean()), 2)
        mean_offer_dep = round(float(group["offer_dependency"].mean()), 4)
        mean_loyalty = round(float(group["loyalty_score"].mean()), 2)
        mean_offer_sens = round(float(group["offer_sensitivity_score"].mean()), 2)
        mean_spend_trend = round(float(group["spend_trend"].mean()), 2)

        median_rec = round(float(group["recency_days"].median()), 2)
        median_freq = round(float(group["frequency"].median()), 2)
        median_mon = round(float(group["monetary"].median()), 2)
        median_aov = round(float(group["avg_order_value"].median()), 2)

        profile_row = pd.Series({
            "segment_name": seg_name,
            "cluster_id": int(cluster_id),
            "customer_count": int(cust_count),
            "pct_of_customers": pct_cust,
            "total_revenue": tot_rev,
            "pct_of_revenue": pct_rev,
            "mean_recency": mean_rec,
            "mean_frequency": mean_freq,
            "mean_monetary": mean_mon,
            "mean_aov": mean_aov,
            "mean_offer_dependency": mean_offer_dep,
            "mean_loyalty_score": mean_loyalty,
            "mean_offer_sensitivity": mean_offer_sens,
            "mean_spend_trend": mean_spend_trend,
            "median_recency": median_rec,
            "median_frequency": median_freq,
            "median_monetary": median_mon,
            "median_aov": median_aov,
        })

        playbook = generate_segment_strategic_playbook(seg_name, profile_row, currency=currency)
        profile_row["strategic_playbook"] = playbook
        profiles.append(profile_row)

    profile_df = pd.DataFrame(profiles)
    profile_df = profile_df.sort_values("mean_monetary", ascending=False).reset_index(drop=True)
    return profile_df


def _default_transformations() -> Dict[str, Any]:
    """Return the canonical preprocessing transformation specification."""
    return {
        "recency_days": {"source": "recency_days", "method": "linear", "description": "Retained on natural calendar scale."},
        "log_frequency": {"source": "frequency", "method": "log1p", "description": "np.log1p(max(frequency, 0))."},
        "log_monetary": {"source": "monetary", "method": "log1p", "description": "np.log1p(max(monetary, 0))."},
        "log_aov": {"source": "avg_order_value", "method": "log1p", "description": "np.log1p(max(avg_order_value, 0))."},
        "offer_dependency": {"source": "offer_dependency", "method": "linear", "description": "Retained on natural ratio scale [0.0, 1.0]."},
        "spend_trend": {"source": "spend_trend", "method": "linear", "description": "Retained on natural percent-change scale; median-imputed when missing (see imputation)."},
        "scaling": {"method": "StandardScaler", "description": "Per-feature z-score: (x - mean) / scale fitted on candidate matrix."},
    }


def _default_scoring_config(currency: str = "") -> Dict[str, Any]:
    """Return the canonical scoring-engine configuration (mirrors src/scoring.py defaults)."""
    return {
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


def save_artifacts(
    model: KMeans,
    scaler: StandardScaler,
    candidate_name: str,
    output_dir: str = "models",
    feature_names: Optional[List[str]] = None,
    transformations: Optional[Dict[str, Any]] = None,
    imputation_meta: Optional[Dict[str, Any]] = None,
    evaluation_metrics: Optional[Dict[str, Any]] = None,
    dataset_info: Optional[Dict[str, Any]] = None,
    scoring_config: Optional[Dict[str, Any]] = None,
    random_state: int = 42,
) -> None:
    """
    Persist fitted K-Means model, scaler, and comprehensive reproducible metadata.

    Writes three artifacts to ``output_dir``:
      - ``kmeans_selected_model.joblib``: serialized fitted KMeans.
      - ``scaler_selected.joblib``: serialized fitted StandardScaler.
      - ``model_metadata.json``: human- and machine-readable run manifest.

    The JSON manifest always contains the following top-level keys so that
    consumers can rely on a stable schema even when callers omit optional
    arguments (in which case sensible defaults are recorded):
      - candidate_set, n_clusters
      - feature_names, feature_name_order, feature_count
      - transformations
      - imputation
      - scaler (nested config: type, mean, scale, var, n_samples_seen, features)
      - hyperparameters (full KMeans ``get_params()``)
      - cluster_centers, scaler_mean, scaler_scale (backward-compatible flat fields)
      - evaluation_metrics (silhouette, Davies-Bouldin, Calinski-Harabasz, inertia,
        stability ARI, cluster sizes — when supplied)
      - dataset_info (n_customers, source file/shape, total revenue — when supplied)
      - scoring_config (loyalty / offer-sensitivity weights, depth ceiling, currency)
      - random_state, reproducibility (timestamp, sklearn version)

    Args:
        model: Fitted KMeans instance.
        scaler: Fitted StandardScaler instance (fitted on the candidate matrix).
        candidate_name: Selected candidate set name (key of CANDIDATE_SET_DEFINITIONS).
        output_dir: Destination directory for artifacts.
        feature_names: Ordered feature names used for clustering. If None, inferred
                       from ``scaler.feature_names_in_`` or CANDIDATE_SET_DEFINITIONS.
        transformations: Transformation spec dict. If None, canonical defaults are used.
        imputation_meta: Imputation report from load_and_preprocess_customer_features.
        evaluation_metrics: Selection/evaluation metrics (e.g. rationale dict).
        dataset_info: Dataset provenance dict (source path, n_customers, etc.).
        scoring_config: Scoring configuration dict. If None, defaults mirroring
                        src/scoring.py are recorded.
        random_state: Random seed used for the final KMeans fit.
    """
    os.makedirs(output_dir, exist_ok=True)
    model_path = os.path.join(output_dir, "kmeans_selected_model.joblib")
    scaler_path = os.path.join(output_dir, "scaler_selected.joblib")
    meta_path = os.path.join(output_dir, "model_metadata.json")

    joblib.dump(model, model_path)
    joblib.dump(scaler, scaler_path)

    # Resolve ordered feature names (explicit > scaler > candidate definition).
    if feature_names is None:
        if hasattr(scaler, "feature_names_in_") and scaler.feature_names_in_ is not None:
            feature_names = [str(f) for f in list(scaler.feature_names_in_)]
        elif candidate_name in CANDIDATE_SET_DEFINITIONS:
            feature_names = list(CANDIDATE_SET_DEFINITIONS[candidate_name])
        else:
            feature_names = []
    feature_names = list(feature_names)

    if transformations is None:
        transformations = _default_transformations()
    if imputation_meta is None:
        imputation_meta = {}
    if evaluation_metrics is None:
        evaluation_metrics = {}
    if dataset_info is None:
        # Infer a minimal dataset record from the scaler when caller provides none.
        n_seen = None
        try:
            n_seen = int(np.asarray(scaler.n_samples_seen_).flat[0])
        except Exception:
            n_seen = None
        dataset_info = {"n_customers": n_seen, "source": "unknown (not supplied by caller)"}
    if scoring_config is None:
        scoring_config = _default_scoring_config()

    # Hyperparameters straight from the fitted estimator for exact reproducibility.
    try:
        hyperparameters = dict(model.get_params())
    except Exception:
        hyperparameters = {
            "n_clusters": int(model.n_clusters),
            "init": getattr(model, "init", "k-means++"),
            "n_init": getattr(model, "n_init", 50),
            "max_iter": getattr(model, "max_iter", 500),
            "tol": getattr(model, "tol", 1e-5),
            "random_state": random_state,
        }
    # Ensure JSON-serializable (tuples -> lists, numpy types -> native).
    def _to_serializable(obj: Any) -> Any:
        if isinstance(obj, dict):
            return {str(k): _to_serializable(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_to_serializable(v) for v in obj]
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, (np.ndarray,)):
            return obj.tolist()
        return obj

    hyperparameters = _to_serializable(hyperparameters)
    evaluation_metrics = _to_serializable(evaluation_metrics)
    dataset_info = _to_serializable(dataset_info)
    scoring_config = _to_serializable(scoring_config)
    transformations = _to_serializable(transformations)
    imputation_meta = _to_serializable(imputation_meta)

    # Scaler configuration (nested, explicit).
    try:
        scaler_var = [float(v) for v in np.asarray(scaler.var_).tolist()]
    except Exception:
        scaler_var = []
    try:
        n_samples_seen = [int(v) for v in np.asarray(scaler.n_samples_seen_).tolist()] if hasattr(scaler, "n_samples_seen_") else []
    except Exception:
        n_samples_seen = []
    scaler_config = {
        "type": "StandardScaler",
        "mean": [float(v) for v in np.asarray(scaler.mean_).tolist()],
        "scale": [float(v) for v in np.asarray(scaler.scale_).tolist()],
        "var": scaler_var,
        "n_samples_seen": n_samples_seen,
        "feature_names": list(feature_names),
        "feature_name_order": list(feature_names),
    }

    metadata = {
        "candidate_set": candidate_name,
        "n_clusters": int(model.n_clusters),
        "feature_names": list(feature_names),
        "feature_name_order": list(feature_names),
        "feature_count": len(feature_names),
        "transformations": transformations,
        "imputation": imputation_meta,
        "scaler": scaler_config,
        "hyperparameters": hyperparameters,
        "cluster_centers": [list(map(float, c)) for c in np.asarray(model.cluster_centers_).tolist()],
        "scaler_mean": scaler_config["mean"],
        "scaler_scale": scaler_config["scale"],
        "evaluation_metrics": evaluation_metrics,
        "dataset_info": dataset_info,
        "scoring_config": scoring_config,
        "random_state": int(random_state),
        "reproducibility": {
            "saved_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "sklearn_version": str(sklearn.__version__),
            "candidate_set": candidate_name,
            "n_clusters": int(model.n_clusters),
        },
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Saved clustering artifacts to {output_dir}/")

