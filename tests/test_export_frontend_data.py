"""
Retail IQ — Unit & Integration Tests for Frontend Data Export
=============================================================
Author: Role C (Analytics, Validation & ML Lead)

Tests cover:
  1. Successful end-to-end synchronization to target directory.
  2. All four JSON deliverables created with exact expected schema and counts.
  3. Revenue and customer count reconciliation.
  4. Conversion of float NaN/Inf to JSON null (e.g. promo_lift).
  5. Atomic file writing and preservation of existing files on failure.
  6. Detection and rejection of missing source files.
  7. Detection and rejection of missing required columns.
  8. Detection and rejection of duplicate customer IDs.
  9. Detection and rejection of customer count and revenue mismatches.
  10. Enforcement of the customer (repeat_rate/promo_lift) and model metadata
      evaluation_metrics contracts, including champion validity.
  11. Preservation of existing frontend JSON when validation fails.
"""

import os
import json
from pathlib import Path
import pytest
import pandas as pd
import numpy as np

from scripts.export_frontend_data import (
    export_backend_to_frontend,
    validate_source_files,
    validate_exported_json,
    df_to_clean_records,
    atomic_write_json,
    ExportValidationError,
    REQUIRED_CUSTOMER_COLUMNS,
    REQUIRED_PROFILE_COLUMNS,
    REQUIRED_METRICS_COLUMNS,
    REQUIRED_EVALUATION_METRIC_FIELDS,
)


@pytest.fixture
def temp_export_dir(tmp_path):
    """Provide an isolated temporary directory for frontend export testing."""
    target = tmp_path / "frontend_data"
    target.mkdir()
    return str(target)


def test_export_happy_path(temp_export_dir):
    """Verify that export_backend_to_frontend succeeds with real project deliverables."""
    res = export_backend_to_frontend(
        data_dir="data",
        models_dir="models",
        frontend_dir=temp_export_dir,
    )
    assert res["status"] == "success"

    # Verify all four files exist
    cust_file = os.path.join(temp_export_dir, "customers.json")
    prof_file = os.path.join(temp_export_dir, "segmentProfiles.json")
    metrics_file = os.path.join(temp_export_dir, "segmentationMetrics.json")
    meta_file = os.path.join(temp_export_dir, "modelMetadata.json")

    for fpath in (cust_file, prof_file, metrics_file, meta_file):
        assert os.path.exists(fpath), f"Expected file not found: {fpath}"

    with open(cust_file, "r", encoding="utf-8") as f:
        customers = json.load(f)
    with open(prof_file, "r", encoding="utf-8") as f:
        profiles = json.load(f)
    with open(metrics_file, "r", encoding="utf-8") as f:
        metrics = json.load(f)
    with open(meta_file, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert len(customers) == 200
    assert len(profiles) == 4
    assert len(metrics) == 28
    assert isinstance(meta, dict)

    # Reconcile customer counts and revenue
    total_rev = round(sum(c["monetary"] for c in customers), 2)
    profile_rev = round(sum(p["total_revenue"] for p in profiles), 2)
    profile_cust_sum = sum(p["customer_count"] for p in profiles)

    assert profile_cust_sum == 200
    assert abs(total_rev - profile_rev) < 0.05
    assert total_rev == 4137071.75


def test_export_schema_compliance(temp_export_dir):
    """Verify that exported records satisfy all required fields expected by frontend."""
    export_backend_to_frontend(
        data_dir="data",
        models_dir="models",
        frontend_dir=temp_export_dir,
    )

    with open(os.path.join(temp_export_dir, "customers.json"), "r") as f:
        customers = json.load(f)
    with open(os.path.join(temp_export_dir, "segmentProfiles.json"), "r") as f:
        profiles = json.load(f)
    with open(os.path.join(temp_export_dir, "segmentationMetrics.json"), "r") as f:
        metrics = json.load(f)

    # Check customers
    for col in REQUIRED_CUSTOMER_COLUMNS:
        assert all(col in c for c in customers), f"Missing customer column: {col}"

    # Check profiles
    for col in REQUIRED_PROFILE_COLUMNS:
        assert all(col in p for p in profiles), f"Missing profile column: {col}"

    # Check metrics
    for col in REQUIRED_METRICS_COLUMNS:
        assert all(col in m for m in metrics), f"Missing metrics column: {col}"


def test_nan_conversion_to_null(temp_export_dir):
    """Verify that float NaNs (such as promo_lift) serialize cleanly to None/null."""
    export_backend_to_frontend(
        data_dir="data",
        models_dir="models",
        frontend_dir=temp_export_dir,
    )

    with open(os.path.join(temp_export_dir, "customers.json"), "r") as f:
        customers = json.load(f)

    # Customers C0002, C0006, etc. have no promo orders -> promo_lift must be None
    c0002 = next(c for c in customers if c["customer_id"] == "C0002")
    assert c0002["promo_lift"] is None
    assert c0002["offer_dependency"] == 0.0
    assert c0002["offer_sensitivity_score"] == 0.0


def test_atomic_write_preserves_on_failure(tmp_path):
    """Verify that if writing fails, existing target file is not overwritten or corrupted."""
    target = tmp_path / "test.json"
    target.write_text('{"original": "data"}', encoding="utf-8")

    # Object that cannot be JSON serialized
    bad_data = {"unserializable": object()}

    with pytest.raises(IOError):
        atomic_write_json(bad_data, str(target))

    # Original file must remain intact
    with open(str(target), "r", encoding="utf-8") as f:
        content = json.load(f)
    assert content == {"original": "data"}


def test_missing_source_file_rejected(tmp_path, temp_export_dir):
    """Verify that missing deliverable files raise ExportValidationError."""
    empty_data_dir = tmp_path / "empty_data"
    empty_data_dir.mkdir()

    with pytest.raises(ExportValidationError, match="Missing backend deliverable"):
        export_backend_to_frontend(
            data_dir=str(empty_data_dir),
            models_dir="models",
            frontend_dir=temp_export_dir,
        )


def test_duplicate_customer_ids_rejected(tmp_path, temp_export_dir):
    """Verify that duplicate customer_id rows in customer feed are rejected."""
    mock_data = tmp_path / "data"
    mock_data.mkdir()

    # Read real files and inject a duplicate
    real_cust = pd.read_csv("data/segmented_customers.csv")
    real_prof = pd.read_csv("data/segment_profiles.csv")
    real_metrics = pd.read_csv("data/segmentation_metrics.csv")

    dup_cust = pd.concat([real_cust, real_cust.iloc[0:1]], ignore_index=True)
    dup_cust.to_csv(mock_data / "segmented_customers.csv", index=False)
    real_prof.to_csv(mock_data / "segment_profiles.csv", index=False)
    real_metrics.to_csv(mock_data / "segmentation_metrics.csv", index=False)

    with pytest.raises(ExportValidationError, match="Duplicate customer_ids found"):
        export_backend_to_frontend(
            data_dir=str(mock_data),
            models_dir="models",
            frontend_dir=temp_export_dir,
        )


def test_revenue_mismatch_rejected(tmp_path, temp_export_dir):
    """Verify that revenue discrepancy between customers and profiles is rejected."""
    mock_data = tmp_path / "data"
    mock_data.mkdir()

    real_cust = pd.read_csv("data/segmented_customers.csv")
    real_prof = pd.read_csv("data/segment_profiles.csv").copy()
    real_metrics = pd.read_csv("data/segmentation_metrics.csv")

    # Tamper with profile revenue
    real_prof.loc[0, "total_revenue"] += 50000.0

    real_cust.to_csv(mock_data / "segmented_customers.csv", index=False)
    real_prof.to_csv(mock_data / "segment_profiles.csv", index=False)
    real_metrics.to_csv(mock_data / "segmentation_metrics.csv", index=False)

    with pytest.raises(ExportValidationError, match="Revenue discrepancy"):
        export_backend_to_frontend(
            data_dir=str(mock_data),
            models_dir="models",
            frontend_dir=temp_export_dir,
        )


def test_customer_count_mismatch_rejected(tmp_path, temp_export_dir):
    """Verify that count mismatch between customer rows and profile sum is rejected."""
    mock_data = tmp_path / "data"
    mock_data.mkdir()

    real_cust = pd.read_csv("data/segmented_customers.csv")
    real_prof = pd.read_csv("data/segment_profiles.csv").copy()
    real_metrics = pd.read_csv("data/segmentation_metrics.csv")

    # Drop 5 customers from customer table
    shrunk_cust = real_cust.iloc[:-5]

    shrunk_cust.to_csv(mock_data / "segmented_customers.csv", index=False)
    real_prof.to_csv(mock_data / "segment_profiles.csv", index=False)
    real_metrics.to_csv(mock_data / "segmentation_metrics.csv", index=False)

    with pytest.raises(ExportValidationError, match="Customer count mismatch"):
        export_backend_to_frontend(
            data_dir=str(mock_data),
            models_dir="models",
            frontend_dir=temp_export_dir,
        )


# ---------------------------------------------------------------------------
# Phase 4 — export contract hardening tests
# ---------------------------------------------------------------------------

FRONTEND_JSON_FILES = (
    "customers.json",
    "segmentProfiles.json",
    "segmentationMetrics.json",
    "modelMetadata.json",
)


def _apply_meta_mutation(meta, mutator):
    """Apply an in-place metadata mutation and return the same dict."""
    mutator(meta)
    return meta


def _prepare_mock_sources(
    tmp_path,
    case,
    drop_customer_columns=(),
    meta_mutator=None,
    extra_customer_columns=None,
    null_customer_fields=(),
):
    """Create isolated source dirs from real deliverables with targeted tampering."""
    data_dir = tmp_path / f"data_{case}"
    models_dir = tmp_path / f"models_{case}"
    data_dir.mkdir()
    models_dir.mkdir()

    customers = pd.read_csv("data/segmented_customers.csv")
    profiles = pd.read_csv("data/segment_profiles.csv")
    metrics = pd.read_csv("data/segmentation_metrics.csv")
    with open("models/model_metadata.json", "r", encoding="utf-8") as f:
        meta = json.load(f)

    if drop_customer_columns:
        customers = customers.drop(columns=list(drop_customer_columns))
    if extra_customer_columns:
        for column, value in extra_customer_columns.items():
            customers[column] = value
    if null_customer_fields:
        for column in null_customer_fields:
            customers.loc[customers.index[0], column] = np.nan
    if meta_mutator is not None:
        meta = meta_mutator(meta)

    customers.to_csv(data_dir / "segmented_customers.csv", index=False)
    profiles.to_csv(data_dir / "segment_profiles.csv", index=False)
    metrics.to_csv(data_dir / "segmentation_metrics.csv", index=False)
    with open(models_dir / "model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f)
    return str(data_dir), str(models_dir)


def _read_frontend_snapshot(directory):
    return {name: (Path(directory) / name).read_bytes() for name in FRONTEND_JSON_FILES}


def test_required_customer_contract_includes_drawer_fields():
    """CustomerDrawer.jsx fields must be part of the enforced schema."""
    assert "repeat_rate" in REQUIRED_CUSTOMER_COLUMNS
    assert "promo_lift" in REQUIRED_CUSTOMER_COLUMNS


def test_missing_repeat_rate_rejected(tmp_path, temp_export_dir):
    """Missing repeat_rate must fail before any frontend JSON is written."""
    data_dir, models_dir = _prepare_mock_sources(
        tmp_path, "missing_repeat_rate", drop_customer_columns=["repeat_rate"]
    )
    with pytest.raises(ExportValidationError, match="repeat_rate"):
        export_backend_to_frontend(
            data_dir=data_dir, models_dir=models_dir, frontend_dir=temp_export_dir
        )


def test_missing_promo_lift_rejected(tmp_path, temp_export_dir):
    """Missing promo_lift must fail before any frontend JSON is written."""
    data_dir, models_dir = _prepare_mock_sources(
        tmp_path, "missing_promo_lift", drop_customer_columns=["promo_lift"]
    )
    with pytest.raises(ExportValidationError, match="promo_lift"):
        export_backend_to_frontend(
            data_dir=data_dir, models_dir=models_dir, frontend_dir=temp_export_dir
        )


def test_missing_evaluation_metrics_rejected(tmp_path, temp_export_dir):
    """Missing evaluation_metrics must be rejected explicitly."""
    data_dir, models_dir = _prepare_mock_sources(
        tmp_path,
        "missing_eval_metrics",
        meta_mutator=lambda meta: _apply_meta_mutation(
            meta, lambda m: m.pop("evaluation_metrics")
        ),
    )
    with pytest.raises(ExportValidationError, match="evaluation_metrics"):
        export_backend_to_frontend(
            data_dir=data_dir, models_dir=models_dir, frontend_dir=temp_export_dir
        )


@pytest.mark.parametrize(
    "case,mutator,expected_message",
    [
        (
            "no_champion_name",
            lambda m: m["evaluation_metrics"].pop("selected_candidate_set"),
            "selected_candidate_set",
        ),
        (
            "empty_champion_name",
            lambda m: m["evaluation_metrics"].update({"selected_candidate_set": ""}),
            "non-empty string",
        ),
        (
            "unevaluated_k",
            lambda m: m["evaluation_metrics"].update({"selected_k": 999}),
            "not present",
        ),
        (
            "string_k",
            lambda m: m["evaluation_metrics"].update({"selected_k": "4"}),
            "positive integer",
        ),
        (
            "missing_metric_field",
            lambda m: m["evaluation_metrics"].pop("stability_ari_mean"),
            "stability_ari_mean",
        ),
        (
            "non_numeric_metric",
            lambda m: m["evaluation_metrics"].update({"silhouette_score": "high"}),
            "finite number",
        ),
        (
            "k_cluster_mismatch",
            lambda m: m.update({"n_clusters": 3}),
            "Inconsistent champion metadata",
        ),
    ],
)
def test_invalid_or_incomplete_champion_metadata_rejected(
    tmp_path, temp_export_dir, case, mutator, expected_message
):
    """Champion metadata must be complete, well-typed and present in the grid."""
    data_dir, models_dir = _prepare_mock_sources(
        tmp_path, f"champion_{case}", meta_mutator=lambda meta: _apply_meta_mutation(meta, mutator)
    )
    with pytest.raises(ExportValidationError, match=expected_message):
        export_backend_to_frontend(
            data_dir=data_dir, models_dir=models_dir, frontend_dir=temp_export_dir
        )


def test_evaluation_metric_contract_is_non_empty():
    """The required evaluation_metrics field list must cover frontend usage."""
    assert set(REQUIRED_EVALUATION_METRIC_FIELDS) == {
        "selected_candidate_set",
        "selected_k",
        "features",
        "silhouette_score",
        "davies_bouldin_index",
        "calinski_harabasz_score",
        "stability_ari_mean",
    }


def test_valid_export_with_optional_and_null_values(tmp_path, temp_export_dir):
    """Null values and extra optional columns must export successfully."""
    data_dir, models_dir = _prepare_mock_sources(
        tmp_path,
        "valid_optional_null",
        extra_customer_columns={"optional_note": "kept"},
        null_customer_fields=["repeat_rate", "promo_lift"],
    )
    result = export_backend_to_frontend(
        data_dir=data_dir, models_dir=models_dir, frontend_dir=temp_export_dir
    )
    assert result["status"] == "success"

    with open(os.path.join(temp_export_dir, "customers.json"), "r", encoding="utf-8") as f:
        customers = json.load(f)
    first = customers[0]
    assert first["repeat_rate"] is None
    assert first["promo_lift"] is None
    assert first["optional_note"] == "kept"


def test_existing_frontend_json_unchanged_on_validation_failure(tmp_path, temp_export_dir):
    """A failed validation must leave all four existing frontend files untouched."""
    assert export_backend_to_frontend(
        data_dir="data", models_dir="models", frontend_dir=temp_export_dir
    )["status"] == "success"
    before = _read_frontend_snapshot(temp_export_dir)

    data_dir, models_dir = _prepare_mock_sources(
        tmp_path, "failure_preserves", drop_customer_columns=["promo_lift"]
    )
    with pytest.raises(ExportValidationError, match="promo_lift"):
        export_backend_to_frontend(
            data_dir=data_dir, models_dir=models_dir, frontend_dir=temp_export_dir
        )

    assert _read_frontend_snapshot(temp_export_dir) == before
    assert not any(p.name.startswith(".retailiq-export-") for p in Path(temp_export_dir).iterdir())
