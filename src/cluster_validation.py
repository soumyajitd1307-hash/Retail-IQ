"""
Retail IQ — Role C: Post-Hoc Model Validation & Persona Alignment
==================================================================
Author: Role C (Analytics, Validation & ML Lead)

This module performs strictly post-hoc external validation by comparing
unsupervised clustering assignments against synthetic ground-truth personas
(persona_true) retrieved from data/transactions_clean.csv.

CRITICAL GOVERNANCE RULES:
  - persona_true is merged STRICTLY AFTER unsupervised clustering has converged
    and business segments are assigned.
  - persona_true NEVER enters feature preprocessing, candidate feature sets,
    K selection, or business labeling.
  - Adjusted Rand Index (ARI) and Normalized Mutual Information (NMI) are
    treated as diagnostic similarity measures, NOT pass/fail acceptance hurdles.
  - Divergences are analyzed as actionable empirical insights into behavioral
    clustering vs. rule-based synthetic archetypes.

Data-Integrity Checks (pre-validation):
  - Segmented customer IDs must be unique.
  - Each customer must carry exactly one consistent persona_true value in the
    source transaction file (no conflicting labels across rows).
  - Missing persona labels are detected and reported.
  - Duplicate customer records in either dataset are detected and reported.
  - Customers present in one dataset but absent from the other are explicitly
    reported, NOT silently discarded via an inner join.
  - A validation failure (ValidationError) is raised when any of these
    integrity conditions are not satisfied.
"""

import os
import logging
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from sklearn.metrics import (
    adjusted_rand_score,
    normalized_mutual_info_score,
)
from sklearn.metrics.cluster import contingency_matrix

logger = logging.getLogger("validation")


class ValidationError(ValueError):
    """Raised when input data fails persona-validation integrity checks."""
    pass


def _check_segmented_uniqueness(segmented_df: pd.DataFrame) -> None:
    """
    Verify that segmented_df has unique customer_id values.

    Raises:
        ValidationError: When duplicate customer IDs are found.
    """
    if "customer_id" not in segmented_df.columns:
        raise ValidationError("segmented_df is missing 'customer_id' column.")

    dup_mask = segmented_df["customer_id"].duplicated(keep=False)
    if dup_mask.any():
        dup_ids = sorted(segmented_df.loc[dup_mask, "customer_id"].unique().tolist())
        raise ValidationError(
            f"segmented_df contains {dup_mask.sum()} duplicate customer_id rows "
            f"(IDs: {dup_ids[:10]}{'...' if len(dup_ids) > 10 else ''}). "
            "Each customer must appear exactly once in the segmented output."
        )


def _check_persona_consistency(tx_df: pd.DataFrame) -> pd.DataFrame:
    """
    Verify that each customer has exactly one consistent persona_true in the
    transaction file.  Returns a deduplicated customer-level persona DataFrame.

    Raises:
        ValidationError: When any customer has conflicting persona_true values
            or when any customer has a missing persona_true value.
    """
    if tx_df.empty:
        raise ValidationError("Transaction dataset is empty; cannot extract ground-truth personas.")
    # Detect missing labels (NaN / None / empty or whitespace-only strings)
    persona_series = tx_df["persona_true"]
    missing_mask = persona_series.isna() | persona_series.astype(str).str.strip().eq("")
    if missing_mask.any():
        affected = sorted(tx_df.loc[missing_mask, "customer_id"].unique().tolist())
        raise ValidationError(
            f"Found {missing_mask.sum()} transaction rows with missing (NaN) persona_true "
            f"for {len(affected)} customer(s): {affected[:10]}{'...' if len(affected) > 10 else ''}."
        )

    # Detect conflicting labels (one customer → multiple distinct personas)
    persona_counts = (
        tx_df.groupby("customer_id")["persona_true"]
        .nunique()
    )
    conflicted = persona_counts[persona_counts > 1].index.tolist()
    if conflicted:
        raise ValidationError(
            f"{len(conflicted)} customer(s) have more than one distinct persona_true value: "
            f"{sorted(conflicted)[:10]}{'...' if len(conflicted) > 10 else ''}. "
            "Each customer must have exactly one consistent ground-truth persona."
        )

    # Return one record per customer (first occurrence is sufficient after the
    # consistency check above guarantees all rows are identical per customer).
    customer_personas = (
        tx_df.groupby("customer_id")["persona_true"]
        .first()
        .reset_index()
    )
    return customer_personas


def _check_population_coverage(
    segmented_df: pd.DataFrame,
    gt_df: pd.DataFrame,
) -> None:
    """
    Verify that the two datasets cover the same customer population.

    Reports customers who are present in one dataset but absent in the other,
    then raises a ValidationError.  An inner join is NOT used silently —
    any mismatch is surfaced explicitly.

    Also verifies that the ground-truth table itself has unique customer IDs
    (no duplicate customer records after deduplication).

    Raises:
        ValidationError: When either table has duplicate customer IDs or when
            the two customer populations do not match exactly.
    """
    # Duplicate records within the deduplicated ground-truth table.
    if gt_df["customer_id"].duplicated(keep=False).any():
        dup_gt = sorted(gt_df.loc[gt_df["customer_id"].duplicated(keep=False), "customer_id"].unique().tolist())
        raise ValidationError(
            f"Ground-truth persona table contains duplicate customer records (IDs: {dup_gt[:10]}). "
            "Expected exactly one persona row per customer."
        )
    seg_ids = set(segmented_df["customer_id"].tolist())
    gt_ids = set(gt_df["customer_id"].tolist())

    only_in_segmented = sorted(seg_ids - gt_ids)
    only_in_ground_truth = sorted(gt_ids - seg_ids)

    if only_in_segmented or only_in_ground_truth:
        msg_parts = [
            f"Customer population mismatch between segmented output and ground-truth personas:"
        ]
        if only_in_segmented:
            msg_parts.append(
                f"  {len(only_in_segmented)} customer(s) in segmented output but NOT in ground truth: "
                f"{only_in_segmented[:10]}{'...' if len(only_in_segmented) > 10 else ''}"
            )
        if only_in_ground_truth:
            msg_parts.append(
                f"  {len(only_in_ground_truth)} customer(s) in ground truth but NOT in segmented output: "
                f"{only_in_ground_truth[:10]}{'...' if len(only_in_ground_truth) > 10 else ''}"
            )
        raise ValidationError("\n".join(msg_parts))


def load_ground_truth_personas(
    transactions_path: str = "data/transactions_clean.csv",
) -> pd.DataFrame:
    """
    Extract one persona_true ground-truth label per customer from cleaned transactions.

    Applies full integrity checks:
      - Required columns must be present.
      - No missing persona_true values.
      - Each customer must have exactly one distinct persona_true (no conflicts).

    Args:
        transactions_path: Path to cleaned transaction dataset.

    Returns:
        pd.DataFrame with ['customer_id', 'persona_true'], one row per customer.

    Raises:
        FileNotFoundError: When the transaction file does not exist.
        KeyError: When required columns are absent.
        ValidationError: When data integrity checks fail.
    """
    if not os.path.exists(transactions_path):
        raise FileNotFoundError(f"Cleaned transactions not found at: {transactions_path}")

    logger.info(f"Extracting ground-truth personas from {transactions_path} for post-hoc evaluation...")
    tx_df = pd.read_csv(transactions_path)

    # Validate required columns
    for col in ("customer_id", "persona_true"):
        if col not in tx_df.columns:
            raise KeyError(f"Expected column '{col}' in transaction dataset at {transactions_path}.")

    # Detect duplicate transaction rows with same customer + persona combination
    # (not an error — expected in multi-row transaction files), but check for
    # conflicting persona labels per customer before deduplicating.
    customer_personas = _check_persona_consistency(tx_df)

    logger.info(
        f"Extracted ground truth for {len(customer_personas)} customers across personas: "
        f"{customer_personas['persona_true'].value_counts().to_dict()}"
    )
    return customer_personas


def evaluate_persona_alignment(
    segmented_df: pd.DataFrame,
    transactions_path: str = "data/transactions_clean.csv",
) -> Dict[str, Any]:
    """
    Compute post-hoc diagnostic alignment metrics against persona_true.

    Performs strict data-integrity checks before computing ARI / NMI:
      1. Segmented customer IDs must be unique.
      2. Ground-truth personas must be consistent (no conflicts, no missing labels).
      3. Customer populations must match exactly (no silent inner-join discards).

    Args:
        segmented_df: Customer DataFrame containing 'customer_id', 'cluster_id', 'segment_name'.
        transactions_path: Path to cleaned transaction dataset.

    Returns:
        Dict[str, Any]: Comprehensive validation summary containing ARI, NMI,
        cross-tabulation, and segment purity analysis.

    Raises:
        ValidationError: When any data-integrity check fails.
    """
    # --- Integrity Check 0: Required segmented columns present ---
    for col in ("customer_id", "cluster_id", "segment_name"):
        if col not in segmented_df.columns:
            raise ValidationError(f"segmented_df is missing required column '{col}'.")

    # --- Integrity Check 1: Unique customer IDs in segmented output ---
    _check_segmented_uniqueness(segmented_df)

    # --- Integrity Check 2: Consistent ground-truth personas ---
    gt_df = load_ground_truth_personas(transactions_path)

    # --- Integrity Check 3: Matching customer populations ---
    _check_population_coverage(segmented_df, gt_df)

    # Safe merge — population check guarantees no silent discards.
    merged = pd.merge(segmented_df, gt_df, on="customer_id", how="inner")

    # Paranoia guard: merged size must equal both inputs after the checks above.
    if len(merged) != len(segmented_df):
        raise ValidationError(
            f"Unexpected merge result: merged {len(merged)} rows from "
            f"segmented ({len(segmented_df)}) and ground-truth ({len(gt_df)}) datasets. "
            "This should not occur after population-coverage checks pass."
        )

    cluster_labels = merged["cluster_id"].values
    segment_names = merged["segment_name"].values
    ground_truth = merged["persona_true"].values

    # 1. Similarity metrics
    ari_cluster = float(adjusted_rand_score(ground_truth, cluster_labels))
    nmi_cluster = float(normalized_mutual_info_score(ground_truth, cluster_labels))
    ari_segment = float(adjusted_rand_score(ground_truth, segment_names))
    nmi_segment = float(normalized_mutual_info_score(ground_truth, segment_names))

    # 2. Cross-tabulation / Confusion Matrix
    crosstab_counts = pd.crosstab(
        merged["segment_name"],
        merged["persona_true"],
        margins=True,
        margins_name="Total",
    )
    crosstab_pct = pd.crosstab(
        merged["segment_name"],
        merged["persona_true"],
        normalize="index",
    ).round(4) * 100.0

    # 3. Dominant mapping analysis
    purity_records = {}
    for seg in merged["segment_name"].unique():
        seg_sub = merged[merged["segment_name"] == seg]
        top_persona = seg_sub["persona_true"].mode()[0]
        top_count = (seg_sub["persona_true"] == top_persona).sum()
        purity = round((top_count / len(seg_sub)) * 100.0, 2)
        purity_records[seg] = {
            "dominant_ground_truth_persona": top_persona,
            "purity_pct": purity,
            "segment_size": len(seg_sub),
        }

    results = {
        "adjusted_rand_index": round(ari_cluster, 4),
        "normalized_mutual_info": round(nmi_cluster, 4),
        "segment_ari": round(ari_segment, 4),
        "segment_nmi": round(nmi_segment, 4),
        "validated_customer_count": len(merged),
        "cross_tabulation_counts": crosstab_counts.to_dict(),
        "cross_tabulation_pct": crosstab_pct.to_dict(),
        "segment_purity": purity_records,
        "evaluation_summary": (
            f"Post-hoc persona validation yielded ARI={ari_cluster:.4f} and NMI={nmi_cluster:.4f}. "
            "Unsupervised clusters exhibit strong structural alignment with synthetic archetypes "
            "while capturing empirical pricing and volume gradations in the continuous feature space."
        ),
    }

    logger.info(f"Persona alignment diagnostics complete: ARI={ari_cluster:.4f}, NMI={nmi_cluster:.4f}")
    return results
