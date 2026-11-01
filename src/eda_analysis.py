"""
Retail IQ — Role B: Exploratory Data Analysis & Visualization
=============================================================
Author: Role B (Features Lead)
Branch: Souvik

Generates professional publication-quality visual artifacts for customer features:
  - Spending distribution (monetary & AOV)
  - Frequency distribution
  - Recency distribution
  - Offer dependency & discount behavior
  - Category diversity distribution
  - Spending trend & promotional lift distributions
  - Feature correlation heatmap
  - Comprehensive feature distributions overview grid

Outputs are saved directly to the 'outputs/' directory.
"""

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Set visual styling
sns.set_theme(style="whitegrid", palette="muted")
plt.rcParams["font.sans-serif"] = "DejaVu Sans"
plt.rcParams["axes.edgecolor"] = "#cccccc"
plt.rcParams["axes.linewidth"] = 0.8

OUTPUT_DIR = "outputs"


def generate_all_eda_visualizations(
    features_csv: str = "customer_features.csv", output_dir: str = OUTPUT_DIR
) -> None:
    """Generate all required EDA plots and save to output_dir."""
    os.makedirs(output_dir, exist_ok=True)
    df = pd.read_csv(features_csv)

    print(f"Loaded features for {len(df)} customers from {features_csv}")

    # 1. Customer Spending Distribution (Monetary & AOV)
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    sns.histplot(df["monetary"], kde=True, ax=axes[0], color="#2b5c8f", bins=25)
    axes[0].set_title("Total Customer Spending (Monetary)", fontsize=13, weight="bold")
    axes[0].set_xlabel("Monetary Value (Currency Units)")
    axes[0].set_ylabel("Customer Count")
    median_monetary = df["monetary"].median()
    axes[0].axvline(median_monetary, color="#d95f02", linestyle="--", label=f"Median: {median_monetary:,.2f} units")
    axes[0].legend()

    sns.histplot(df["avg_order_value"], kde=True, ax=axes[1], color="#2ca02c", bins=25)
    axes[1].set_title("Average Order Value (AOV)", fontsize=13, weight="bold")
    axes[1].set_xlabel("Average Order Value (Currency Units)")
    axes[1].set_ylabel("Customer Count")
    median_aov = df["avg_order_value"].median()
    axes[1].axvline(median_aov, color="#d95f02", linestyle="--", label=f"Median: {median_aov:,.2f} units")
    axes[1].legend()

    plt.tight_layout()
    spending_path = os.path.join(output_dir, "customer_spending_distribution.png")
    plt.savefig(spending_path, dpi=300)
    plt.close()
    print(f"Saved {spending_path}")

    # 2. Frequency Distribution
    plt.figure(figsize=(8, 5))
    sns.histplot(df["frequency"], bins=20, kde=True, color="#1f77b4", edgecolor="black")
    plt.title("Order Frequency Distribution (Unique Orders)", fontsize=13, weight="bold")
    plt.xlabel("Number of Orders")
    plt.ylabel("Number of Customers")
    median_freq = df["frequency"].median()
    plt.axvline(median_freq, color="#e31a1c", linestyle="--", linewidth=2, label=f"Median: {median_freq:.0f} orders")
    plt.legend()
    plt.tight_layout()
    freq_path = os.path.join(output_dir, "frequency_distribution.png")
    plt.savefig(freq_path, dpi=300)
    plt.close()
    print(f"Saved {freq_path}")

    # 3. Recency Distribution
    plt.figure(figsize=(8, 5))
    sns.histplot(df["recency_days"], bins=25, kde=True, color="#ff7f0e", edgecolor="black")
    plt.title("Customer Recency Distribution (Days since Snapshot 2026-10-30)", fontsize=13, weight="bold")
    plt.xlabel("Recency (Days)")
    plt.ylabel("Number of Customers")
    median_rec = df["recency_days"].median()
    plt.axvline(median_rec, color="#1f78b4", linestyle="--", linewidth=2, label=f"Median: {median_rec:.0f} days")
    plt.legend()
    plt.tight_layout()
    rec_path = os.path.join(output_dir, "recency_distribution.png")
    plt.savefig(rec_path, dpi=300)
    plt.close()
    print(f"Saved {rec_path}")

    # 4. Offer Dependency & Discount Percentage
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    sns.histplot(df["offer_dependency"], bins=20, kde=True, ax=axes[0], color="#9467bd")
    axes[0].set_title("Offer Dependency Ratio Distribution", fontsize=13, weight="bold")
    axes[0].set_xlabel("Offer Dependency (Discounted Orders / Total Orders)")
    axes[0].set_ylabel("Customer Count")
    zero_offers = (df["offer_dependency"] == 0).sum()
    axes[0].annotate(f"{zero_offers} customers with 0% offers", xy=(0.02, zero_offers),
                     xytext=(0.15, zero_offers + 2),
                     arrowprops=dict(facecolor="black", shrink=0.05, width=1, headwidth=6))

    sns.histplot(df["avg_discount_pct"], bins=20, kde=True, ax=axes[1], color="#8c564b")
    axes[1].set_title("Average Customer Discount Percentage", fontsize=13, weight="bold")
    axes[1].set_xlabel("Average Discount Applied (%)")
    axes[1].set_ylabel("Customer Count")

    plt.tight_layout()
    disc_path = os.path.join(output_dir, "offer_dependency_distribution.png")
    plt.savefig(disc_path, dpi=300)
    plt.close()
    print(f"Saved {disc_path}")

    # 5. Category Diversity Distribution
    plt.figure(figsize=(8, 5))
    cat_counts = df["category_diversity"].value_counts().sort_index()
    bars = plt.bar(cat_counts.index, cat_counts.values, color="#17becf", edgecolor="black", width=0.6)
    plt.title("Customer Category Diversity Distribution", fontsize=13, weight="bold")
    plt.xlabel("Distinct Categories Purchased")
    plt.ylabel("Number of Customers")
    plt.xticks(cat_counts.index)
    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2.0, yval + 1, int(yval), ha="center", va="bottom", fontsize=10)
    plt.tight_layout()
    cat_path = os.path.join(output_dir, "category_diversity_distribution.png")
    plt.savefig(cat_path, dpi=300)
    plt.close()
    print(f"Saved {cat_path}")

    # 6. Spending Trend & Promotional Lift
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    valid_trend = df["spend_trend"].dropna()
    sns.histplot(valid_trend, bins=25, kde=True, ax=axes[0], color="#bcbd22")
    axes[0].axvline(0, color="red", linestyle="--", label="Zero Change")
    axes[0].set_title(f"Spending Trend (Trimester 2 vs 1) [N={len(valid_trend)}]", fontsize=13, weight="bold")
    axes[0].set_xlabel("Spending Change (%)")
    axes[0].set_ylabel("Customer Count")
    axes[0].legend()

    valid_lift = df["promo_lift"].dropna()
    sns.histplot(valid_lift, bins=25, kde=True, ax=axes[1], color="#e377c2")
    axes[1].axvline(0, color="red", linestyle="--", label="Zero Lift")
    axes[1].set_title(f"Promotional Response Lift (AOV Lift %) [N={len(valid_lift)}]", fontsize=13, weight="bold")
    axes[1].set_xlabel("Promo Lift (%)")
    axes[1].set_ylabel("Customer Count")
    axes[1].legend()

    plt.tight_layout()
    trend_lift_path = os.path.join(output_dir, "spend_trend_and_promo_lift.png")
    plt.savefig(trend_lift_path, dpi=300)
    plt.close()
    print(f"Saved {trend_lift_path}")

    # 7. Correlation Heatmap
    plt.figure(figsize=(10, 8))
    numeric_cols = [c for c in df.columns if c != "customer_id"]
    corr_matrix = df[numeric_cols].corr()
    mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
    sns.heatmap(
        corr_matrix,
        mask=mask,
        annot=True,
        fmt=".2f",
        cmap="coolwarm",
        vmin=-1,
        vmax=1,
        square=True,
        linewidths=0.5,
        cbar_kws={"shrink": 0.8},
    )
    plt.title("Correlation Heatmap of Customer Features", fontsize=14, weight="bold", pad=15)
    plt.tight_layout()
    corr_path = os.path.join(output_dir, "correlation_heatmap.png")
    plt.savefig(corr_path, dpi=300)
    plt.close()
    print(f"Saved {corr_path}")

    # 8. Multi-Feature Distribution Grid
    fig, axes = plt.subplots(3, 4, figsize=(18, 12))
    axes = axes.flatten()
    for idx, feature in enumerate(numeric_cols):
        ax = axes[idx]
        data = df[feature].dropna()
        sns.histplot(data, kde=True, ax=ax, color=sns.color_palette("muted")[idx % 10])
        ax.set_title(feature, fontsize=11, weight="bold")
        ax.set_xlabel("")
        ax.set_ylabel("Count")

    # Hide extra unused subplots if any
    for idx in range(len(numeric_cols), len(axes)):
        fig.delaxes(axes[idx])

    plt.suptitle("Retail IQ: Distribution Overview Across All 10 Customer Features", fontsize=16, weight="bold", y=0.99)
    plt.tight_layout()
    grid_path = os.path.join(output_dir, "feature_summary_grid.png")
    plt.savefig(grid_path, dpi=300)
    plt.close()
    print(f"Saved {grid_path}")


if __name__ == "__main__":
    generate_all_eda_visualizations()

