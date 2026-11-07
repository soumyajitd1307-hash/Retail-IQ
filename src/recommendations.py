"""
Retail IQ — Role C: Customer Recommendation Engine
===================================================
Author: Role C (Analytics, Validation & ML Lead)

This module implements a transparent, rule-based, evidence-driven customer
recommendation engine.

Recommendations are derived from:
  1. Customer Segment Assignment (Macro strategy)
  2. Recency Status (Churn risk vs. active momentum)
  3. Spend & Frequency Tier (High-ticket VIP vs. frequent micro-shopper vs. entry-level)
  4. Offer Sensitivity Score (Promotional dependency level)
  5. Loyalty Score (Retention strength)

Governance:
  - Every recommendation is explainable strictly from observed empirical data.
  - Avoids unsupported claims regarding unobserved customer motives.
  - Tailors prescriptive actions to protect retail margins and maximize customer lifetime value.
"""

import logging
from typing import Dict, Any, List
import pandas as pd

logger = logging.getLogger("recommendations")


def generate_customer_recommendation(row: pd.Series) -> str:
    """
    Generate an explainable, data-backed primary recommendation for a customer.

    Args:
        row: Series containing customer metrics and segment assignment:
             - segment_name
             - recency_days
             - frequency
             - monetary
             - loyalty_score
             - offer_sensitivity_score
             - avg_order_value

    Returns:
        str: Concise, actionable marketing recommendation.
    """
    segment = str(row.get("segment_name", "Unassigned")).lower()
    recency = float(row.get("recency_days", 0))
    frequency = float(row.get("frequency", 0))
    monetary = float(row.get("monetary", 0))
    loyalty = float(row.get("loyalty_score", 0))
    offer_sens = float(row.get("offer_sensitivity_score", 0))
    aov = float(row.get("avg_order_value", 0))

    # Segment 1: High-Value Loyal (VIP / Core Champions)
    if "loyal" in segment or "vip" in segment or "core" in segment:
        if offer_sens < 15.0:
            return (
                "Enroll in tier-1 VIP appreciation program; provide exclusive early product access "
                "and premium concierge service. Strictly avoid price discounting to protect healthy margins."
            )
        else:
            return (
                "Maintain relationship with high-value perks, non-price rewards, and cross-category "
                "exclusives. Cap promotional discounts to avoid training price sensitivity."
            )

    # Segment 2: Offer-Sensitive (Deal Seekers / Promotional Buyers)
    elif "offer" in segment or "deal" in segment or "promo" in segment:
        if aov > 1000.0:
            return (
                "Deploy tiered minimum-spend thresholds (e.g., save $50 on $300+) to capture high basket size "
                "while maintaining gross margin. Target category bundles rather than direct markdowns."
            )
        elif recency > 60:
            return (
                "Deploy a time-sensitive targeted promotion with an expiration window to reactivate interest, "
                "paired with personalized recommendations based on previous category purchases."
            )
        else:
            return (
                "Incentivize multi-unit purchases with personalized volume discounts and product bundles; "
                "suppress general site-wide promotions to prevent discount cannibalization."
            )

    # Segment 3: At-Risk / Dormant (Churn Risk / Lapsed High-Value)
    elif "risk" in segment or "dormant" in segment or "lapse" in segment or "churn" in segment:
        if monetary > 15000.0:
            return (
                "High-priority executive win-back campaign: send personalized re-engagement survey with an "
                "attractive return credit on historical favorite categories to reactivate premium buyer."
            )
        else:
            return (
                "Initiate automated multi-channel re-engagement sequence with a curated 'What's New' catalog "
                "and a modest reactivation incentive before customer crosses the 120-day churn horizon."
            )

    # Segment 4: Occasional Buyer (Low Engagement / Trialists)
    elif "occasional" in segment or "trial" in segment or "low" in segment:
        if frequency <= 5 and recency <= 45:
            return (
                "Accelerate second-purchase onboarding: provide personalized category discovery guides and "
                "a limited-time welcome completion incentive on complementary merchandise categories."
            )
        elif recency > 75:
            return (
                "Re-engage through low-friction product recommendations and entry-tier seasonal bestsellers "
                "to encourage catalog rediscovery."
            )
        else:
            return (
                "Encourage category expansion and repeat visit frequency with post-purchase cross-sell "
                "campaigns and low-threshold loyalty milestone incentives."
            )

    # Segment 5: High-Ticket / Specialized Shopper (if K expands)
    elif "ticket" in segment or "bulk" in segment:
        return (
            "Present premium tier collections, volume corporate purchase options, and dedicated account support "
            "to maximize revenue per transaction."
        )

    # Fallback / General Data-Driven Rule
    else:
        if loyalty >= 70.0:
            return "Deliver premium loyalty recognition and prioritize cross-category exploration."
        elif recency >= 75.0:
            return "Urgent reactivation campaign with win-back incentive tailored to past purchases."
        elif offer_sens >= 50.0:
            return "Margin-protective promotional bundles with minimum spend requirements."
        else:
            return "Standard catalog engagement and nurture campaign to build purchase frequency."


def generate_segment_strategic_playbook(segment_name: str, profile_row: pd.Series) -> str:
    """
    Generate an executive-level strategic playbook for a segment aggregate profile.

    Args:
        segment_name: Name of the business segment.
        profile_row: Aggregate metric Series for the segment.

    Returns:
        str: Strategic executive recommendation.
    """
    seg = segment_name.lower()
    mean_monetary = profile_row.get("mean_monetary", 0)
    mean_recency = profile_row.get("mean_recency", 0)
    mean_offer_dep = profile_row.get("mean_offer_dependency", 0)
    pct_rev = profile_row.get("pct_of_revenue", 0)

    if "loyal" in seg or "vip" in seg:
        return (
            f"Core Revenue Anchor ({pct_rev:.1f}% of total spend): Protect relationship through non-monetary "
            "VIP benefits, premium service, and early access. Guard gross margins by avoiding discount erosion."
        )
    elif "offer" in seg or "deal" in seg:
        return (
            f"Promotional Volume Driver (mean discount usage: {mean_offer_dep*100:.1f}%): Drive order value with "
            "gated thresholds, BOGO offers, and category bundles. Avoid unprompted blanket sales."
        )
    elif "risk" in seg or "dormant" in seg:
        return (
            f"Lapsed Revenue Opportunity (mean inactivity: {mean_recency:.0f} days): Deploy automated win-back "
            "triggers, personalized product rediscovery, and reactivation credits before total churn occurs."
        )
    elif "occasional" in seg or "trial" in seg:
        return (
            "Growth & Onboarding Pipeline: Convert single-category purchasers into habitual buyers via category "
            "cross-selling, entry-tier incentives, and loyalty milestone rewards."
        )
    else:
        return "Targeted customer engagement balancing retention incentives with margin preservation."


def attach_recommendations(df: pd.DataFrame) -> pd.DataFrame:
    """
    Attach primary_recommendation column to customer-level DataFrame.

    Args:
        df: Customer DataFrame containing segment_name and customer metrics.

    Returns:
        pd.DataFrame: DataFrame with 'primary_recommendation' column added.
    """
    logger.info("Generating customer-level data-backed recommendations...")
    df = df.copy()
    df["primary_recommendation"] = df.apply(generate_customer_recommendation, axis=1)
    return df

