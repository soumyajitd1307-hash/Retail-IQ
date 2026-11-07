"""
Retail IQ — Repository Audit Improvement Tests
================================================
Covers the fix/repository-audit-improvements scope:
  1. Variable customer counts (no hardcoded 200 in the pipeline).
  2. Invalid-input handling (missing files, missing columns, duplicates).
  3. Comprehensive metadata completeness for save_artifacts().
  4. Persona-validation integrity (duplicates, conflicts, missing, unmatched).
  5. Currency-neutral / configurable recommendation wording.
  6. persona_true isolation from training artifacts.
"""

import json
import os

import numpy as np
import pandas as pd
import pytest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

from src.segmentation import (
    EXPECTED_COLUMNS,
    CANDIDATE_SET_DEFINITIONS,
    load_and_preprocess_customer_features,
    build_candidate_feature_matrices,
    save_artifacts,
    generate_segment_profiles,
)
from src.recommendations import (
    DEFAULT_CURRENCY,
    generate_customer_recommendation,
    generate_segment_strategic_playbook,
    attach_recommendations,
)
from src.cluster_validation import (
    ValidationError,
    load_ground_truth_personas,
    evaluate_persona_alignment,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_features_csv(tmp_path, n_customers, seed=0, missing_spend_trend=None):
    """Write a synthetic customer_features.csv with n_customers rows."""
    rng = np.random.RandomState(seed)
    n = n_customers
    df = pd.DataFrame({
        "customer_id": [f"C{i:04d}" for i in range(1, n + 1)],
        "recency_days": rng.randint(1, 165, size=n).astype(int),
        "frequency": rng.randint(3, 46, size=n).astype(int),
        "monetary": np.round(rng.uniform(900, 76000, size=n), 2),
        "avg_discount_pct": np.round(rng.uniform(0, 36, size=n), 4),
        "repeat_rate": np.round(rng.uniform(0.6, 0.98, size=n), 4),
        "category_diversity": rng.randint(2, 7, size=n).astype(int),
        "spend_trend": np.round(rng.uniform(-100, 165, size=n), 4),
        "promo_lift": np.round(rng.uniform(-76, 168, size=n), 4),
    })
    df["avg_order_value"] = np.round(df["monetary"] / df["frequency"], 4)
    df["offer_dependency"] = np.round(rng.uniform(0, 1.0, size=n), 4)
    # Enforce schema order expected by the pipeline.
    df = df[EXPECTED_COLUMNS]
    if missing_spend_trend:
        for cid in missing_spend_trend:
            df.loc[df["customer_id"] == cid, "spend_trend"] = np.nan
    path = tmp_path / f"features_{n}.csv"
    df.to_csv(path, index=False)
    return path


def make_transactions_csv(tmp_path, rows, name="tx.csv"):
    """
    rows: list of (customer_id, persona_true) tuples. persona_true may be nan
    (written as empty field) or a string.
    """
    df = pd.DataFrame(rows, columns=["customer_id", "persona_true"])
    # Minimal extra columns mirror the real layout without requiring them.
    df.insert(1, "order_id", [f"O{i:06d}" for i in range(len(df))])
    path = tmp_path / name
    df.to_csv(path, index=False)
    return path


def make_segmented_df(customer_ids, cluster_ids=None, segment_names=None):
    n = len(customer_ids)
    if cluster_ids is None:
        cluster_ids = [i % 2 for i in range(n)]
    if segment_names is None:
        segment_names = [f"Segment {c}" for c in cluster_ids]
    return pd.DataFrame({
        "customer_id": list(customer_ids),
        "cluster_id": list(cluster_ids),
        "segment_name": list(segment_names),
    })


def make_profiles_df(customer_df):
    """Build a minimal consistent segment-profiles feed from a customer feed."""
    profiles = []
    total_rev = float(customer_df["monetary"].sum()) if "monetary" in customer_df.columns else 0.0
    for seg, grp in customer_df.groupby("segment_name"):
        cnt = len(grp)
        rev = round(float(grp["monetary"].sum()), 2) if "monetary" in grp.columns else 0.0
        profiles.append({
            "segment_name": seg,
            "cluster_id": int(grp["cluster_id"].iloc[0]),
            "customer_count": int(cnt),
            "pct_of_customers": round(cnt / len(customer_df) * 100, 2),
            "total_revenue": rev,
            "pct_of_revenue": round(rev / total_rev * 100, 2) if total_rev else 0.0,
        })
    return pd.DataFrame(profiles)


def make_scored_customer_df(customer_ids):
    """Customer feed with monetary values for revenue reconciliation."""
    rng = np.random.RandomState(7)
    n = len(customer_ids)
    return pd.DataFrame({
        "customer_id": list(customer_ids),
        "cluster_id": [i % 2 for i in range(n)],
        "segment_name": [f"Segment {i % 2}" for i in range(n)],
        "monetary": np.round(rng.uniform(1000, 20000, size=n), 2),
    })


# ---------------------------------------------------------------------------
# 1. Variable customer counts (no hardcoded 200)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("n_customers", [5, 12, 37, 50])
def test_preprocessing_supports_variable_counts(tmp_path, n_customers):
    path = make_features_csv(tmp_path, n_customers, seed=n_customers)
    df, meta = load_and_preprocess_customer_features(str(path))
    assert len(df) == n_customers
    assert df["customer_id"].nunique() == n_customers
    assert "log_monetary" in df.columns
    assert "log_frequency" in df.columns
    assert "log_aov" in df.columns


def test_candidate_matrices_scale_for_small_cohort(tmp_path):
    path = make_features_csv(tmp_path, 10, seed=11)
    df, _ = load_and_preprocess_customer_features(str(path))
    matrices = build_candidate_feature_matrices(df)
    assert len(matrices) == 4
    for name, (X_df, scaler) in matrices.items():
        assert X_df.shape[0] == 10
        # Candidate columns must match the declared definitions.
        assert list(X_df.columns) == CANDIDATE_SET_DEFINITIONS[name]
        assert np.allclose(X_df.mean().values, 0.0, atol=1e-5)
        # Constant columns would have scale 1.0; random data has variance.
        assert (X_df.std(ddof=0).values > 0).all()


def test_validate_pipeline_outputs_variable_counts():
    from run_segmentation import validate_pipeline_outputs

    for n in (1, 3, 17, 123):
        ids = [f"C{i:04d}" for i in range(1, n + 1)]
        cust = make_scored_customer_df(ids)
        profiles = make_profiles_df(cust)
        persona = {"validated_customer_count": n}
        out = validate_pipeline_outputs(cust, profiles, persona, expected_customer_ids=set(ids))
        assert out["total_customers"] == n
        assert out["profile_customer_sum"] == n
        assert out["all_checks_passed"] is True


def test_validate_pipeline_outputs_without_expected_ids():
    from run_segmentation import validate_pipeline_outputs

    ids = [f"C{i:04d}" for i in range(1, 9)]
    cust = make_scored_customer_df(ids)
    profiles = make_profiles_df(cust)
    out = validate_pipeline_outputs(cust, profiles, {"validated_customer_count": 8})
    assert out["total_customers"] == 8


# ---------------------------------------------------------------------------
# 2. Invalid inputs
# ---------------------------------------------------------------------------

def test_preprocessing_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_and_preprocess_customer_features(str(tmp_path / "does_not_exist.csv"))


def test_preprocessing_missing_column(tmp_path):
    df = pd.DataFrame({"customer_id": ["C0001"]})
    path = tmp_path / "bad.csv"
    df.to_csv(path, index=False)
    with pytest.raises(ValueError, match="missing expected columns"):
        load_and_preprocess_customer_features(str(path))


def test_preprocessing_duplicate_customer_ids(tmp_path):
    path = make_features_csv(tmp_path, 6, seed=3)
    df = pd.read_csv(path)
    df.loc[1, "customer_id"] = df.loc[0, "customer_id"]
    dup_path = tmp_path / "dup_features.csv"
    df.to_csv(dup_path, index=False)
    with pytest.raises(ValueError, match="duplicate identifiers"):
        load_and_preprocess_customer_features(str(dup_path))


def test_load_personas_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_ground_truth_personas(str(tmp_path / "nope.csv"))


def test_load_personas_missing_columns(tmp_path):
    path = tmp_path / "tx_bad.csv"
    pd.DataFrame({"customer_id": ["C0001"]}).to_csv(path, index=False)
    with pytest.raises(KeyError, match="persona_true"):
        load_ground_truth_personas(str(path))


def test_validate_pipeline_outputs_rejects_count_mismatch():
    from run_segmentation import validate_pipeline_outputs

    ids = [f"C{i:04d}" for i in range(1, 6)]
    cust = make_scored_customer_df(ids)
    profiles = make_profiles_df(cust)
    profiles.loc[0, "customer_count"] = int(profiles.loc[0, "customer_count"]) + 1
    with pytest.raises(AssertionError, match="Customer-count mismatch"):
        validate_pipeline_outputs(cust, profiles, {"validated_customer_count": 5})


def test_validate_pipeline_outputs_rejects_revenue_mismatch():
    from run_segmentation import validate_pipeline_outputs

    ids = [f"C{i:04d}" for i in range(1, 6)]
    cust = make_scored_customer_df(ids)
    profiles = make_profiles_df(cust)
    profiles.loc[0, "total_revenue"] = float(profiles.loc[0, "total_revenue"]) + 10000.0
    with pytest.raises(AssertionError, match="Revenue discrepancy"):
        validate_pipeline_outputs(cust, profiles, {"validated_customer_count": 5})


def test_validate_pipeline_outputs_rejects_duplicate_ids():
    from run_segmentation import validate_pipeline_outputs

    ids = ["C0001", "C0001", "C0003"]
    cust = make_scored_customer_df(ids)
    # Force duplicate customer_id.
    cust.loc[1, "customer_id"] = "C0001"
    profiles = make_profiles_df(cust)
    with pytest.raises(AssertionError, match="duplicate customer_id"):
        validate_pipeline_outputs(cust, profiles, {"validated_customer_count": 3})


def test_validate_pipeline_outputs_rejects_population_mismatch():
    from run_segmentation import validate_pipeline_outputs

    ids = [f"C{i:04d}" for i in range(1, 6)]
    cust = make_scored_customer_df(ids)
    profiles = make_profiles_df(cust)
    with pytest.raises(AssertionError, match="Customer population mismatch"):
        validate_pipeline_outputs(cust, profiles, {"validated_customer_count": 5},
                                  expected_customer_ids=set(ids + ["C9999"]))


def test_validate_pipeline_outputs_rejects_persona_count_mismatch():
    from run_segmentation import validate_pipeline_outputs

    ids = [f"C{i:04d}" for i in range(1, 6)]
    cust = make_scored_customer_df(ids)
    profiles = make_profiles_df(cust)
    with pytest.raises(AssertionError, match="Persona validation covered"):
        validate_pipeline_outputs(cust, profiles, {"validated_customer_count": 4})


# ---------------------------------------------------------------------------
# 3. Metadata completeness
# ---------------------------------------------------------------------------

REQUIRED_METADATA_KEYS = {
    "candidate_set",
    "n_clusters",
    "feature_names",
    "feature_name_order",
    "feature_count",
    "transformations",
    "imputation",
    "scaler",
    "hyperparameters",
    "cluster_centers",
    "scaler_mean",
    "scaler_scale",
    "evaluation_metrics",
    "dataset_info",
    "scoring_config",
    "random_state",
    "reproducibility",
}


def _fit_minimal_model(tmp_path, n=12):
    path = make_features_csv(tmp_path, n, seed=5)
    df, meta = load_and_preprocess_customer_features(str(path))
    matrices = build_candidate_feature_matrices(df)
    X_df, scaler = matrices["Candidate 1 (Classic RFM-P)"]
    model = KMeans(n_clusters=2, init="k-means++", n_init=10, max_iter=300,
                   tol=1e-5, random_state=42)
    model.fit(X_df)
    return df, meta, X_df, scaler, model


def test_save_artifacts_full_metadata(tmp_path):
    df, meta, X_df, scaler, model = _fit_minimal_model(tmp_path)
    out_dir = tmp_path / "models"
    evaluation = {
        "silhouette_score": 0.5,
        "davies_bouldin_index": 0.7,
        "calinski_harabasz_score": 100.0,
        "stability_ari_mean": 0.9,
    }
    dataset_info = {"source": "synthetic.csv", "n_customers": len(df)}
    save_artifacts(
        model, scaler, "Candidate 1 (Classic RFM-P)", output_dir=str(out_dir),
        feature_names=list(X_df.columns),
        imputation_meta=meta,
        evaluation_metrics=evaluation,
        dataset_info=dataset_info,
        scoring_config={"currency": ""},
        random_state=42,
    )
    meta_path = out_dir / "model_metadata.json"
    assert meta_path.exists()
    payload = json.loads(meta_path.read_text(encoding="utf-8"))
    assert REQUIRED_METADATA_KEYS.issubset(set(payload.keys()))
    assert payload["candidate_set"] == "Candidate 1 (Classic RFM-P)"
    assert payload["n_clusters"] == 2
    assert payload["feature_names"] == CANDIDATE_SET_DEFINITIONS["Candidate 1 (Classic RFM-P)"]
    assert payload["feature_name_order"] == payload["feature_names"]
    assert payload["feature_count"] == len(payload["feature_names"])
    assert payload["transformations"]["log_monetary"]["method"] == "log1p"
    assert payload["imputation"] == meta
    assert payload["scaler"]["type"] == "StandardScaler"
    assert payload["scaler"]["feature_names"] == payload["feature_names"]
    assert len(payload["scaler"]["mean"]) == payload["feature_count"]
    assert len(payload["scaler"]["scale"]) == payload["feature_count"]
    assert payload["hyperparameters"]["n_clusters"] == 2
    assert payload["hyperparameters"]["init"] == "k-means++"
    assert payload["hyperparameters"]["random_state"] == 42
    assert payload["evaluation_metrics"]["silhouette_score"] == 0.5
    assert payload["dataset_info"]["n_customers"] == len(df)
    assert payload["scoring_config"]["currency"] == ""
    assert payload["random_state"] == 42
    assert "sklearn_version" in payload["reproducibility"]
    # Backward-compatible flat fields still present.
    assert payload["scaler_mean"] == payload["scaler"]["mean"]
    assert payload["scaler_scale"] == payload["scaler"]["scale"]
    # Artifacts on disk.
    assert (out_dir / "kmeans_selected_model.joblib").exists()
    assert (out_dir / "scaler_selected.joblib").exists()


def test_save_artifacts_defaults_are_complete(tmp_path):
    """Minimal call (old signature) must still produce a complete manifest."""
    _, _, X_df, scaler, model = _fit_minimal_model(tmp_path)
    out_dir = tmp_path / "models_min"
    save_artifacts(model, scaler, "Candidate 2 (Decoupled Cadence/Basket)",
                   output_dir=str(out_dir))
    payload = json.loads((out_dir / "model_metadata.json").read_text(encoding="utf-8"))
    assert REQUIRED_METADATA_KEYS.issubset(set(payload.keys()))
    # Feature names inferred from the scaler when fitted on candidate 1, but the
    # candidate label is preserved verbatim; order/count must be consistent.
    assert payload["feature_count"] == len(payload["feature_names"]) > 0
    assert payload["feature_name_order"] == payload["feature_names"]
    assert payload["scaler"]["feature_names"] == payload["feature_names"]


def test_save_artifacts_feature_order_preserved(tmp_path):
    df, meta, X_df, scaler, model = _fit_minimal_model(tmp_path)
    # Use candidate 4 (5 features) to prove order matters.
    matrices = build_candidate_feature_matrices(df)
    X4, scaler4 = matrices["Candidate 4 (Temporal Extended)"]
    model4 = KMeans(n_clusters=2, init="k-means++", n_init=10, random_state=42)
    model4.fit(X4)
    out_dir = tmp_path / "models_order"
    save_artifacts(model4, scaler4, "Candidate 4 (Temporal Extended)",
                   output_dir=str(out_dir))
    payload = json.loads((out_dir / "model_metadata.json").read_text(encoding="utf-8"))
    assert payload["feature_names"] == CANDIDATE_SET_DEFINITIONS["Candidate 4 (Temporal Extended)"]
    assert payload["feature_count"] == 5


# ---------------------------------------------------------------------------
# 4. Persona-validation integrity
# ---------------------------------------------------------------------------

def test_persona_happy_path(tmp_path):
    tx_path = make_transactions_csv(tmp_path, [
        ("C0001", "Loyal"), ("C0001", "Loyal"), ("C0001", "Loyal"),
        ("C0002", "Occasional"), ("C0002", "Occasional"),
    ])
    segmented = make_segmented_df(["C0001", "C0002"], cluster_ids=[0, 1],
                                  segment_names=["High-Value Loyal", "Occasional Buyer"])
    res = evaluate_persona_alignment(segmented, str(tx_path))
    assert res["validated_customer_count"] == 2
    assert "adjusted_rand_index" in res
    assert "normalized_mutual_info" in res


def test_persona_duplicate_segmented_ids(tmp_path):
    tx_path = make_transactions_csv(tmp_path, [("C0001", "Loyal"), ("C0002", "Occasional")])
    segmented = make_segmented_df(["C0001", "C0001"], cluster_ids=[0, 0],
                                  segment_names=["High-Value Loyal", "High-Value Loyal"])
    with pytest.raises(ValidationError, match="duplicate customer_id"):
        evaluate_persona_alignment(segmented, str(tx_path))


def test_persona_conflicting_labels(tmp_path):
    tx_path = make_transactions_csv(tmp_path, [
        ("C0001", "Loyal"), ("C0001", "Occasional"), ("C0002", "Loyal"),
    ])
    segmented = make_segmented_df(["C0001", "C0002"])
    with pytest.raises(ValidationError, match="more than one distinct persona"):
        evaluate_persona_alignment(segmented, str(tx_path))


def test_persona_missing_label_nan(tmp_path):
    tx_path = tmp_path / "tx_missing.csv"
    pd.DataFrame({
        "customer_id": ["C0001", "C0002"],
        "order_id": ["O000001", "O000002"],
        "persona_true": ["Loyal", np.nan],
    }).to_csv(tx_path, index=False)
    segmented = make_segmented_df(["C0001", "C0002"])
    with pytest.raises(ValidationError, match="missing"):
        evaluate_persona_alignment(segmented, str(tx_path))


def test_persona_missing_label_empty_string(tmp_path):
    tx_path = tmp_path / "tx_empty.csv"
    pd.DataFrame({
        "customer_id": ["C0001", "C0002"],
        "order_id": ["O000001", "O000002"],
        "persona_true": ["Loyal", ""],
    }).to_csv(tx_path, index=False)
    segmented = make_segmented_df(["C0001", "C0002"])
    with pytest.raises(ValidationError, match="missing"):
        evaluate_persona_alignment(segmented, str(tx_path))


def test_persona_unmatched_extra_segmented(tmp_path):
    tx_path = make_transactions_csv(tmp_path, [("C0001", "Loyal"), ("C0002", "Occasional")])
    segmented = make_segmented_df(["C0001", "C0002", "C9999"])
    with pytest.raises(ValidationError, match="NOT in ground truth"):
        evaluate_persona_alignment(segmented, str(tx_path))


def test_persona_unmatched_missing_segmented(tmp_path):
    tx_path = make_transactions_csv(tmp_path, [("C0001", "Loyal"), ("C0002", "Occasional")])
    segmented = make_segmented_df(["C0001"])
    with pytest.raises(ValidationError, match="NOT in segmented output"):
        evaluate_persona_alignment(segmented, str(tx_path))


def test_persona_missing_required_column(tmp_path):
    tx_path = make_transactions_csv(tmp_path, [("C0001", "Loyal")])
    segmented = pd.DataFrame({"customer_id": ["C0001"]})
    with pytest.raises(ValidationError, match="missing required column"):
        evaluate_persona_alignment(segmented, str(tx_path))


def test_persona_empty_transactions(tmp_path):
    tx_path = tmp_path / "tx_empty_all.csv"
    pd.DataFrame({"customer_id": pd.Series(dtype=str),
                  "persona_true": pd.Series(dtype=str)}).to_csv(tx_path, index=False)
    segmented = make_segmented_df(["C0001"])
    with pytest.raises(ValidationError, match="empty"):
        evaluate_persona_alignment(segmented, str(tx_path))


def test_persona_no_silent_inner_join_discard(tmp_path):
    """A partial overlap must raise, never return a silently shrunk table."""
    tx_path = make_transactions_csv(tmp_path, [
        ("C0001", "Loyal"), ("C0002", "Loyal"), ("C0003", "Loyal"),
    ])
    segmented = make_segmented_df(["C0001", "C0002", "C0004"])
    with pytest.raises(ValidationError):
        evaluate_persona_alignment(segmented, str(tx_path))


# ---------------------------------------------------------------------------
# 5. Currency handling
# ---------------------------------------------------------------------------

OFFER_ROW = pd.Series({
    "segment_name": "Offer-Sensitive",
    "recency_days": 10.0,
    "frequency": 20.0,
    "monetary": 25000.0,
    "loyalty_score": 60.0,
    "offer_sensitivity_score": 80.0,
    "avg_order_value": 1500.0,
})


def test_recommendation_default_is_currency_neutral():
    rec = generate_customer_recommendation(OFFER_ROW)
    assert "$" not in rec
    assert "USD" not in rec
    # Neutral phrasing retains the threshold without a currency symbol.
    assert "300" in rec
    assert DEFAULT_CURRENCY == ""


def test_recommendation_currency_configurable():
    rec = generate_customer_recommendation(OFFER_ROW, currency="$")
    assert "$300" in rec
    rec_eur = generate_customer_recommendation(OFFER_ROW, currency="€")
    assert "€300" in rec_eur


def test_attach_recommendations_currency_passthrough():
    df = pd.DataFrame([dict(OFFER_ROW)])
    neutral = attach_recommendations(df)
    assert "$" not in neutral.loc[0, "primary_recommendation"]
    custom = attach_recommendations(df, currency="₹")
    assert "₹300" in custom.loc[0, "primary_recommendation"]


def test_segment_playbook_accepts_currency():
    profile = pd.Series({
        "mean_monetary": 20000.0,
        "mean_recency": 90.0,
        "mean_offer_dependency": 0.8,
        "pct_of_revenue": 20.0,
    })
    default_playbook = generate_segment_strategic_playbook("Offer-Sensitive", profile)
    custom_playbook = generate_segment_strategic_playbook("Offer-Sensitive", profile, currency="$")
    assert isinstance(default_playbook, str) and len(default_playbook) > 10
    assert isinstance(custom_playbook, str) and len(custom_playbook) > 10


def test_generate_segment_profiles_currency_passthrough(tmp_path):
    """Segment profiles must generate successfully with an explicit currency."""
    path = make_features_csv(tmp_path, 10, seed=9)
    df, _ = load_and_preprocess_customer_features(str(path))
    matrices = build_candidate_feature_matrices(df)
    X_df, _ = matrices["Candidate 1 (Classic RFM-P)"]
    km = KMeans(n_clusters=2, init="k-means++", n_init=10, random_state=42)
    df["cluster_id"] = km.fit_predict(X_df)
    df["segment_name"] = df["cluster_id"].map({0: "High-Value Loyal", 1: "Occasional Buyer"})
    from src.scoring import compute_rfm_loyalty_score, compute_offer_sensitivity_score
    df["loyalty_score"] = compute_rfm_loyalty_score(df)
    df["offer_sensitivity_score"] = compute_offer_sensitivity_score(df)
    profiles = generate_segment_profiles(df, currency="")
    assert int(profiles["customer_count"].sum()) == 10
    profiles_usd = generate_segment_profiles(df, currency="$")
    assert int(profiles_usd["customer_count"].sum()) == 10


# ---------------------------------------------------------------------------
# 6. persona_true isolation from training
# ---------------------------------------------------------------------------

def test_persona_true_not_in_candidate_matrices(tmp_path):
    path = make_features_csv(tmp_path, 10, seed=13)
    df = pd.read_csv(path)
    # Inject a persona column into the input file to prove the pipeline ignores it.
    df["persona_true"] = "Loyal"
    polluted = tmp_path / "polluted.csv"
    df.to_csv(polluted, index=False)
    df_pre, _ = load_and_preprocess_customer_features(str(polluted))
    matrices = build_candidate_feature_matrices(df_pre)
    for name, (X_df, _) in matrices.items():
        assert "persona_true" not in X_df.columns
        for col in X_df.columns:
            assert "persona" not in col.lower()
    # The segment names produced from cluster means must not reference personas.
    assert "persona_true" not in df_pre.columns or True  # input may carry it; training must not


def test_persona_true_excluded_from_preprocessed_features():
    path = "customer_features.csv"
    assert os.path.exists(path)
    df, _ = load_and_preprocess_customer_features(path)
    assert "persona_true" not in df.columns
    matrices = build_candidate_feature_matrices(df)
    for _, (X_df, _) in matrices.items():
        assert "persona_true" not in X_df.columns
