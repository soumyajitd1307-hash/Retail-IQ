# Retail IQ — Frontend Dashboard

A modern, SaaS-style customer analytics and segmentation dashboard built with **React**, **Vite**, **Tailwind CSS**, **Recharts**, **React Router**, and **Lucide React**.

This frontend visualizes the outputs of the **Retail-IQ** Machine Learning pipeline (Role C deliverables), providing executive revenue metrics, behavioral cluster exploration, prescriptive playbooks, and multi-dimensional RFM analytics.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended, verified on v24)
- npm (v9+)

### Installation

1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development Server
Run the local Vite development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build & Preview
To create an optimized production build:
```bash
npm run build
```
To preview the production build locally:
```bash
npm run preview
```

### Linting
To run static code analysis:
```bash
npm run lint
```

---

## 🧭 Application Structure & Initial Pages

The dashboard consists of four primary analytical views:

### 1. Executive Dashboard (`/`)
- **Executive KPI Cards:** Total Customers (200 accounts), Total Revenue ($4,137,071.75), Average Customer Value ($20,685.36), and At-Risk Revenue ($852,261.62).
- **Segment Distribution (Donut Chart):** Customer count vs. total turnover share with center metrics.
- **Pareto Revenue vs. Volume Analysis:** Side-by-side comparison illustrating that High-Value Loyal accounts (25% of cohort) generate 59.7% of total revenue.
- **Segment Snapshot Cards:** Quick-summary cards for all 4 segments with direct links to exploration.

### 2. Customer Segmentation (`/segmentation`)
- **4 Behavioral Personas:**
  - **High-Value Loyal** (Cluster 0, 50 customers, 59.7% revenue)
  - **Offer-Sensitive** (Cluster 3, 49 customers, 14.5% revenue)
  - **At-Risk Dormant** (Cluster 2, 40 customers, 20.6% revenue)
  - **Occasional Buyer** (Cluster 1, 61 customers, 5.2% revenue)
- **Strategic Playbooks:** Prescriptive marketing & retention strategies verbatim from `data/segment_profiles.csv`.
- **Centroid & Distribution Verification:** Statistical comparison of Mean vs. Median for Recency, Frequency, Monetary spend, AOV, and Offer Dependency.
- **Normalized Radar Comparison:** 6-axis behavioral radar chart comparing all 4 segments simultaneously.
- **Customer Cluster Scatter Plot:** Recency vs. Monetary spend across all 200 accounts.
- **ML Evaluation Grid:** 28-configuration grid evaluation from `data/segmentation_metrics.csv` detailing why Candidate 1 (Classic RFM-P) at $K=4$ was selected (Silhouette 0.5814, Davies-Bouldin 0.6503, Stability ARI 1.00).

### 3. Customer Explorer (`/explorer`)
- **Granular Customer Directory:** Interactive table of all 200 customer accounts.
- **Search & Multi-Filter:**
  - Real-time search across Customer ID, segment name, and recommendation text.
  - Segment filter dropdown.
  - Spend tier filter (High >$30k, Mid $10k-$30k, Low <$10k).
  - Recency cadence filter (Active $\le$30d, Warm 31-60d, Cooling 61-90d, Dormant >90d).
- **Multi-Column Sorting:** Sort ascending or descending by Customer ID, Loyalty Score, Total Spend, Order Frequency, Recency, or Offer Sensitivity.
- **Pagination & Page Size:** Configurable 10, 25, or 50 records per page.
- **CSV Export:** Client-side export of current filtered customer list.
- **Customer Detail Drawer:** Sliding slide-over drawer displaying individual RFM metrics, behavioral breakdown, score gauges, and prescriptive recommendations.

### 4. RFM Analysis (`/rfm`)
- **Dimension Overview Cards:** Statistical ranges and medians for Recency, Frequency, and Monetary spend.
- **Distribution Histograms:** Binned distributions for Recency cadences, Order frequencies, and Monetary spend tiers.
- **Multi-Axis Scatter Plot Explorer:** Switchable 2D scatter matrix (Recency vs Spend, Frequency vs Spend, Recency vs Frequency, Loyalty vs Offer Sensitivity) with clickable nodes.
- **Behavioral Matrix (Loyalty vs Promotion):** 4-quadrant strategic matrix classifying Champions, Deal Drivers, Churn Alerts, and Pipeline Accounts.

---

## 🛠️ Architecture & Backend Decoupling

Data access is decoupled from UI components via `src/services/dataService.js`:

```
frontend/
├── src/
│   ├── components/
│   │   ├── charts/         # Recharts tooltips & custom renderers
│   │   ├── common/         # KpiCard, Badge, ScoreGauge, CustomerDrawer
│   │   └── layout/         # Sidebar, Navbar, Layout shell
│   ├── data/               # Parsed JSON extracts from Role C CSV outputs
│   │   ├── customers.json
│   │   ├── segmentProfiles.json
│   │   ├── segmentationMetrics.json
│   │   └── modelMetadata.json
│   ├── pages/              # Dashboard, Segmentation, CustomerExplorer, RfmAnalysis
│   ├── services/
│   │   └── dataService.js  # Abstracted data access interface
│   ├── utils/              # Currency, formatters, and theme definitions
│   ├── App.jsx             # React Router route definitions
│   ├── index.css           # Tailwind CSS v4 styling
│   └── main.jsx
├── package.json
└── vite.config.js
```

### Backend Integration
To integrate a live backend in the future:
1. Set the `VITE_API_URL` environment variable (e.g. `VITE_API_URL=http://localhost:8000/api` in `.env`).
2. Update `src/services/dataService.js` methods to fetch from the API endpoints instead of the local static dataset. The UI components will continue to work without modification.
