"""
Retail IQ — Role C: Customer Scoring Engine
============================================
Author: Role C (Analytics, Validation & ML Lead)

This module implements two independent, statistically robust, bounded customer
behavioral scores:
  1. RFM Loyalty Score (0.0 to 100.0)
     - Behavioral engagement & retention index based on Recency, Frequency, and Monetary.
     - Recency (30%), Frequency (35%), Monetary (35%).
     - Log-transformed Frequency and Monetary to account for diminishing returns.
     - Strictly continuous, bounded, and handles zero-range / single-value edge cases.
     - Note: This measures observed behavioral loyalty, not emotional brand attachment.

  2. Offer Sensitivity Score (0.0 to 100.0)
     - Observational promotional reliance index.
     - Discount Incidence (70%): Fraction of orders utilizing a discount.
     - Conditional Discount Depth (30%): Average discount depth received when a discount was utilized.
     - Decouples incidence from conditional depth to prevent collinear double-counting.
     - Zero discount customers cleanly evaluate to 0.0.
     - Configurable benchmark discount depth ceiling (default: 50.0%).
     - Note: Measures observed promotional reliance, not causal campaign uplift or elasticity.
"""

import logging
from typing import Optional, Union, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger("scoring")

DEFAULT_DEPTH_CEILING = 50.0  # Configurable maximum benchmark discount depth percentage


def compute_rfm_loyalty_score(
    df: pd.DataFrame,
    recency_col: str = "recency_days",
    frequency_col: str = "frequency",
    monetary_col: str = "monetary",
    weights: Tuple[float, float, float] = (0.30, 0.35, 0.35),
) -> pd.Series:
    """
    Compute normalized RFM Loyalty Score on a [0.0, 100.0] scale.

    Formula:
      Loyalty Score = w_R * S_R + w_F * S_F + w_M * S_M

      Where:
        S_R = 100 * (max(R) - R) / (max(R) - min(R))  [Inverted: lower recency -> higher score]
        S_F = 100 * (log1p(F) - log1p(min(F))) / (log1p(max(F)) - log1p(min(F)))
        S_M = 100 * (log1p(M) - log1p(min(M))) / (log1p(max(M)) - log1p(min(M)))

    Args:
        df: DataFrame containing customer features.
        recency_col: Column name for recency in days.
        frequency_col: Column name for order frequency.
        monetary_col: Column name for total monetary spend.
        weights: Tuple of (weight_recency, weight_frequency, weight_monetary), summing to 1.0.

    Returns:
        pd.Series of loyalty scores rounded to 2 decimal places, indexed like df.
    """
    w_r, w_f, w_m = weights
    if not np.isclose(w_r + w_f + w_m, 1.0):
        raise ValueError(f"Loyalty score weights must sum to 1.0, got: {weights} (sum={w_r + w_f + w_m})")

    for col in [recency_col, frequency_col, monetary_col]:
        if col not in df.columns:
            raise KeyError(f"Required column '{col}' not found in DataFrame.")

    # 1. Recency Score (Inverted: lower recency = higher loyalty)
    r = pd.to_numeric(df[recency_col], errors="coerce")
    min_r, max_r = r.min(), r.max()
    if np.isclose(max_r, min_r) or np.isnan(min_r):
        s_r = pd.Series(50.0, index=df.index)
    else:
        s_r = 100.0 * (max_r - r) / (max_r - min_r)

    # 2. Frequency Score (Log-scaled)
    f = pd.to_numeric(df[frequency_col], errors="coerce")
    log_f = np.log1p(np.maximum(f, 0.0))
    min_log_f, max_log_f = log_f.min(), log_f.max()
    if np.isclose(max_log_f, min_log_f) or np.isnan(min_log_f):
        s_f = pd.Series(50.0, index=df.index)
    else:
        s_f = 100.0 * (log_f - min_log_f) / (max_log_f - min_log_f)

    # 3. Monetary Score (Log-scaled)
    m = pd.to_numeric(df[monetary_col], errors="coerce")
    log_m = np.log1p(np.maximum(m, 0.0))
    min_log_m, max_log_m = log_m.min(), log_m.max()
    if np.isclose(max_log_m, min_log_m) or np.isnan(min_log_m):
        s_m = pd.Series(50.0, index=df.index)
    else:
        s_m = 100.0 * (log_m - min_log_m) / (max_log_m - min_log_m)

    # Weighted combination
    loyalty_score = (w_r * s_r) + (w_f * s_f) + (w_m * s_m)

    # Strict boundary enforcement [0.0, 100.0] and rounding
    loyalty_score = loyalty_score.clip(lower=0.0, upper=100.0).round(2)
    return loyalty_score


def compute_offer_sensitivity_score(
    df: pd.DataFrame,
    offer_dependency_col: str = "offer_dependency",
    avg_discount_pct_col: str = "avg_discount_pct",
    weights: Tuple[float, float] = (0.70, 0.30),
    depth_ceiling: float = DEFAULT_DEPTH_CEILING,
) -> pd.Series:
    """
    Compute Offer Sensitivity Score on a [0.0, 100.0] scale.

    Deconstructs promotional sensitivity into two independent components:
      1. Discount Incidence (w=0.70):
         Measures the proportion of customer orders placed with a discount.
         S_incidence = 100.0 * offer_dependency  [in 0.0 to 100.0]

      2. Conditional Discount Depth (w=0.30):
         Measures the average discount percentage received on discounted orders:
         conditional_depth = avg_discount_pct / offer_dependency  (when offer_dependency > 0)
         S_depth = 100.0 * min(1.0, conditional_depth / depth_ceiling)

      Zero Discount Rule:
         If offer_dependency == 0.0, score evaluates cleanly to 0.0.

    Args:
        df: DataFrame containing customer features.
        offer_dependency_col: Column name for discount order ratio [0.0, 1.0].
        avg_discount_pct_col: Column name for overall average discount percentage.
        weights: Tuple of (weight_incidence, weight_depth), summing to 1.0.
        depth_ceiling: Benchmark discount percentage representing maximum depth (default 50.0%).

    Returns:
        pd.Series of offer sensitivity scores rounded to 2 decimal places, indexed like df.
    """
    w_inc, w_depth = weights
    if not np.isclose(w_inc + w_depth, 1.0):
        raise ValueError(f"Offer sensitivity weights must sum to 1.0, got: {weights}")

    for col in [offer_dependency_col, avg_discount_pct_col]:
        if col not in df.columns:
            raise KeyError(f"Required column '{col}' not found in DataFrame.")

    offer_dep = pd.to_numeric(df[offer_dependency_col], errors="coerce").fillna(0.0).clip(lower=0.0, upper=1.0)
    avg_disc = pd.to_numeric(df[avg_discount_pct_col], errors="coerce").fillna(0.0).clip(lower=0.0, upper=100.0)

    # 1. Incidence Score
    s_incidence = 100.0 * offer_dep

    # 2. Conditional Depth Score
    # Because avg_discount_pct is calculated across all orders (including full-price orders with 0%),
    # conditional_depth = avg_discount_pct / offer_dependency for offer_dependency > 0.
    has_promo = offer_dep > 0.0
    conditional_depth = np.where(has_promo, avg_disc / offer_dep, 0.0)
    s_depth = 100.0 * np.clip(conditional_depth / depth_ceiling, 0.0, 1.0)
    s_depth = pd.Series(s_depth, index=df.index)

    # Weighted composite score
    sensitivity_score = (w_inc * s_incidence) + (w_depth * s_depth)

    # Absolute zero guarantee for customers with 0 discount orders
    sensitivity_score = np.where(offer_dep == 0.0, 0.0, sensitivity_score)

    sensitivity_score = pd.Series(sensitivity_score, index=df.index).clip(lower=0.0, upper=100.0).round(2)
    return sensitivity_score

