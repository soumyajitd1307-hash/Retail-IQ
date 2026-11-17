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
Open [http://localhost:5180/Retail-IQ/](http://localhost:5180/Retail-IQ/) in your browser. The dev server uses port **5180** with `strictPort: true`, and Vite is configured with `base: '/Retail-IQ/'` (matching the GitHub Pages deployment path).

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
- **Executive KPI Cards:** Total customers, total revenue, average customer value and at-risk revenue — all derived from the committed backend JSON.
- **Segment Distribution (Donut Chart):** Customer count vs. total turnover share with center metrics.
- **Pareto Revenue vs. Volume Analysis:** Side-by-side comparison of each segment's revenue share against its customer share.
- **Segment Snapshot Cards:** One summary card per backend segment, with direct links to exploration.

### 2. Customer Segmentation (`/segmentation`)
- **Behavioral Personas:** Segment tabs, counts and revenue shares are generated from `segmentProfiles.json`; segment colours fall back safely for newly introduced names.
- **Strategic Playbooks:** Prescriptive marketing & retention strategies verbatim from the exported segment profiles.
- **Centroid & Distribution Verification:** Statistical comparison of Mean vs. Median for Recency, Frequency, Monetary spend, AOV, and Offer Dependency.
- **Normalized Radar Comparison:** Six-axis behavioral radar chart generated from the live segment profiles.
- **Customer Cluster Scatter Plot:** Recency vs. Monetary spend across all customer accounts.
- **ML Evaluation Grid:** Full candidate × K grid from `segmentationMetrics.json`; the champion configuration and its metrics come from `modelMetadata.json → evaluation_metrics`.

### 3. Customer Explorer (`/explorer`)
- **Granular Customer Directory:** Interactive table of all customer accounts in `customers.json`.
- **Search & Multi-Filter:**
  - Real-time search across Customer ID, segment name, and recommendation text.
  - Segment filter dropdown.
  - Spend tier filter (High, Mid, Low thresholds in generic currency units; the displayed prefix follows backend currency metadata).
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

### Backend Integration (current)
This dashboard is **fully static**: it reads only the committed JSON artifacts in `src/data/`. No API server or backend process is needed to run `npm run dev`, `npm run build` or `npm run preview`.

From the repository root, `python run_segmentation.py` runs the ML pipeline and then calls `scripts/export_frontend_data.py`, which validates schemas/reconciliation/champion metadata and atomically refreshes:

- `customers.json` ← `data/segmented_customers.csv`
- `segmentProfiles.json` ← `data/segment_profiles.csv`
- `segmentationMetrics.json` ← `data/segmentation_metrics.csv`
- `modelMetadata.json` ← `models/model_metadata.json`

After a successful pipeline run, review the regenerated JSON in Git and commit it together with the related code changes. Static deployments also need `npm run build` so the updated JSON is included in the bundle.

`VITE_API_URL` is an unused placeholder for a possible future remote backend; setting it does not change current behaviour. `dataService.js` is the only module that touches backend data, so a future API switch would not require UI component changes.

Currency formatting is configured once from `modelMetadata.json → scoring_config.currency`. When that value is empty or missing, amounts render without a currency symbol (no USD assumption); numeric formatting is unchanged.
