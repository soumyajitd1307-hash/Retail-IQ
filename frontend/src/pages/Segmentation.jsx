import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart as PieChartIcon,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Crown,
  TrendingUp,
  DollarSign,
  Users,
  Award,
  Zap,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import dataService from '../services/dataService';
import {
  formatCurrency,
  formatCompactCurrency,
  formatNumber,
  getCurrencyPrefix,
} from '../utils/formatters';
import { getSegmentStyle } from '../utils/theme';

// Cosmetic series colours for the dynamic radar chart (preserves the existing palette).
const RADAR_SERIES_COLORS = {
  'High-Value Loyal': '#059669',
  'Offer-Sensitive': '#D97706',
  'At-Risk Dormant': '#E11D48',
  'Occasional Buyer': '#0D9488',
};
const RADAR_FALLBACK_COLORS = ['#059669', '#D97706', '#E11D48', '#0D9488'];

export default function Segmentation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialSegment = searchParams.get('segment') || 'High-Value Loyal';

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(initialSegment);
  const [metricsData, setMetricsData] = useState(null);
  const [allCustomers, setAllCustomers] = useState([]);
  const [activeView, setActiveView] = useState('profiles'); // 'profiles' | 'model_evaluation'
  const [hoveredMetric, setHoveredMetric] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const segProfiles = await dataService.getSegmentProfiles();
        const metrics = await dataService.getSegmentationMetrics();
        const customers = await dataService.getAllCustomers();

        setProfiles(segProfiles);
        setMetricsData(metrics);
        setAllCustomers(customers);

        // Ensure valid segment selected
        if (segProfiles.some((s) => s.segment_name === initialSegment)) {
          setSelectedSegment(initialSegment);
        } else if (segProfiles.length > 0) {
          setSelectedSegment(segProfiles[0].segment_name);
        }
      } catch (err) {
        console.error('Failed to load segmentation data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [initialSegment]);

  const handleSelectSegment = (name) => {
    setSelectedSegment(name);
    setSearchParams({ segment: name });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#D5B66E] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#EAE7DB]/70">Loading Segmentation Intelligence...</p>
        </div>
      </div>
    );
  }

  // Empty-data state: never access currentProfile when no backend profiles were loaded.
  if (!profiles.length) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-semibold text-[#EAE7DB]/70">
            No segment profiles are available from the backend data export.
          </p>
        </div>
      </div>
    );
  }

  const currentProfile = profiles.find((p) => p.segment_name === selectedSegment) || profiles[0];
  const currentStyle = getSegmentStyle(selectedSegment);
  const isHighValue = currentProfile.segment_name === 'High-Value Loyal';
  const currencyPrefix = getCurrencyPrefix();

  // ─── Cohort-level aggregates (computed once from live customer data) ────────
  const cohortAvgMonetary   = allCustomers.length
    ? allCustomers.reduce((s, c) => s + (c.monetary || 0), 0) / allCustomers.length
    : 0;
  const cohortAvgFrequency  = allCustomers.length
    ? allCustomers.reduce((s, c) => s + (c.frequency || 0), 0) / allCustomers.length
    : 0;
  const cohortAvgRecency    = allCustomers.length
    ? allCustomers.reduce((s, c) => s + (c.recency_days || 0), 0) / allCustomers.length
    : 0;

  // ─── Dynamic radar chart ──────────────────────────────────────────────────
  // Each axis is normalized 0-100 so segments can be visually compared.
  // Normalization reference: max value across all segments for each axis.
  //   Loyalty Score      → mean_loyalty_score   (scale 0-100 natively)
  //   Monetary ($)       → mean_monetary        (normalized to [0,100])
  //   Frequency (Orders) → mean_frequency       (normalized to [0,100])
  //   Recency (Freshness)→ INVERTED recency: 100 − norm(mean_recency)
  //                        (lower recency_days = fresher = higher score)
  //   Margin Integrity   → (1 − mean_offer_dependency) × 100
  //   Spend Trajectory   → normalized mean_spend_trend shifted to [0,100]
  const buildRadarData = (segs) => {
    if (!segs || segs.length === 0) return [];
    const maxMonetary  = Math.max(...segs.map(s => s.mean_monetary  || 0)) || 1;
    const maxFrequency = Math.max(...segs.map(s => s.mean_frequency || 0)) || 1;
    const maxRecency   = Math.max(...segs.map(s => s.mean_recency   || 0)) || 1;
    // spend_trend can be negative; shift to positive range before normalizing
    const trends = segs.map(s => s.mean_spend_trend ?? 0);
    const minTrend = Math.min(...trends);
    const shiftedTrends = trends.map(t => t - minTrend);
    const maxShifted = Math.max(...shiftedTrends) || 1;

    return [
      {
        metric: 'Loyalty Score',
        ...Object.fromEntries(segs.map(s => [s.segment_name, Math.round(s.mean_loyalty_score ?? 0)])),
      },
      {
        metric: currencyPrefix ? `Monetary (${currencyPrefix})` : 'Monetary',
        ...Object.fromEntries(segs.map(s => [s.segment_name, Math.round(((s.mean_monetary || 0) / maxMonetary) * 100)])),
      },
      {
        metric: 'Frequency (Orders)',
        ...Object.fromEntries(segs.map(s => [s.segment_name, Math.round(((s.mean_frequency || 0) / maxFrequency) * 100)])),
      },
      {
        metric: 'Recency (Freshness)',
        // Invert: low recency_days = very recent = good (score near 100)
        ...Object.fromEntries(segs.map(s => [s.segment_name, Math.round((1 - (s.mean_recency || 0) / maxRecency) * 100)])),
      },
      {
        metric: 'Margin Integrity',
        ...Object.fromEntries(segs.map(s => [s.segment_name, Math.round((1 - (s.mean_offer_dependency ?? 0)) * 100)])),
      },
      {
        metric: 'Spend Trajectory',
        ...Object.fromEntries(segs.map((s, i) => [s.segment_name, Math.round((shiftedTrends[i] / maxShifted) * 100)])),
      },
    ];
  };

  const radarData = buildRadarData(profiles);

  // ─── Benchmark metrics for the selected segment ──────────────────────────
  // Baselines (cohort averages) are computed live from customers.json.
  // Index strings and score bars reflect the CURRENT segment vs the cohort mean.
  const offerSegProfile = profiles.find(s => s.segment_name === 'Offer-Sensitive');
  const cohortMonetaryStr  = formatCompactCurrency(cohortAvgMonetary);
  const cohortFreqStr      = cohortAvgFrequency.toFixed(1);
  const cohortRecencyStr   = cohortAvgRecency.toFixed(1);
  const offerDepPct        = offerSegProfile?.mean_offer_dependency != null
    ? (offerSegProfile.mean_offer_dependency * 100).toFixed(0)
    : '—';
  // Revenue multiplier vs cohort mean spend
  const monetaryMultiplier = cohortAvgMonetary > 0
    ? (currentProfile.mean_monetary / cohortAvgMonetary).toFixed(2)
    : '—';
  const monetaryIndexPct   = cohortAvgMonetary > 0
    ? Math.round(((currentProfile.mean_monetary - cohortAvgMonetary) / cohortAvgMonetary) * 100)
    : 0;
  const freqIndexPct       = cohortAvgFrequency > 0
    ? Math.round(((currentProfile.mean_frequency - cohortAvgFrequency) / cohortAvgFrequency) * 100)
    : 0;
  const recencyIndexPct    = cohortAvgRecency > 0
    ? Math.round(((cohortAvgRecency - currentProfile.mean_recency) / cohortAvgRecency) * 100)
    : 0;

  const highValueMetrics = [
    {
      dimension: 'Revenue Dominance',
      rawVal: formatCompactCurrency(currentProfile.total_revenue),
      score: Math.min(100, Math.round(currentProfile.pct_of_revenue ?? 0) * 1.5),
      index: `${currentProfile.pct_of_revenue ?? '—'}% of Turnover`,
      baseline: `${monetaryMultiplier}x Multiplier`,
      color: '#059669',
      grad: 'from-[#059669] to-[#10B981]',
      desc: 'Share of enterprise cohort turnover anchored in this segment',
    },
    {
      dimension: 'Monetary Power',
      rawVal: formatCurrency(currentProfile.mean_monetary),
      score: Math.min(100, Math.max(0, 50 + monetaryIndexPct / 4)),
      index: `${monetaryIndexPct >= 0 ? '+' : ''}${monetaryIndexPct}% vs Cohort Mean`,
      baseline: `Cohort: ${cohortMonetaryStr}`,
      color: '#0D9488',
      grad: 'from-[#0D9488] to-[#14B8A6]',
      desc: 'Cumulative average customer spend compared to the full cohort baseline',
    },
    {
      dimension: 'Purchase Frequency',
      rawVal: `${currentProfile.mean_frequency.toFixed(1)} Orders`,
      score: Math.min(100, Math.max(0, 50 + freqIndexPct / 4)),
      index: `${freqIndexPct >= 0 ? '+' : ''}${freqIndexPct}% vs Cohort Mean`,
      baseline: `Cohort: ${cohortFreqStr} Orders`,
      color: '#D97706',
      grad: 'from-[#D97706] to-[#F59E0B]',
      desc: 'Buying cadence compared to cohort average transaction frequency',
    },
    {
      dimension: 'Recency Freshness',
      rawVal: `${currentProfile.mean_recency.toFixed(1)} Days Ago`,
      score: Math.min(100, Math.max(0, 50 + recencyIndexPct / 2)),
      index: `${recencyIndexPct >= 0 ? '+' : ''}${recencyIndexPct}% Fresher than Mean`,
      baseline: `Cohort: ${cohortRecencyStr} Days`,
      color: '#B99A55',
      grad: 'from-[#8A723D] to-[#D5B66E]',
      desc: 'Days since last purchase — lower is better (more recent activity)',
    },
    {
      dimension: 'Full-Price Margin Integrity',
      rawVal: `${((1 - currentProfile.mean_offer_dependency) * 100).toFixed(1)}% Full Price`,
      score: Math.round((1 - currentProfile.mean_offer_dependency) * 100),
      index: `Only ${(currentProfile.mean_offer_dependency * 100).toFixed(1)}% Offer Reliance`,
      baseline: `Offer Segment: ${offerDepPct}%`,
      color: '#A5B86A',
      grad: 'from-[#81966B] to-[#A5B86A]',
      desc: 'Full-price purchase discipline — protects gross margin profitability',
    },
  ];

  // Scatter data: Recency vs Monetary with customer points
  const scatterData = allCustomers.map((c) => ({
    id: c.customer_id,
    x: c.recency_days,
    y: c.monetary,
    z: c.frequency,
    segment: c.segment_name,
    color: getSegmentStyle(c.segment_name).color,
  }));

  // Group metrics for the currently selected champion candidate (evaluation tab).
  const championMetrics = metricsData?.grid?.filter(
    (m) => m.candidate_set === metricsData?.champion?.candidateSet
  ) || [];

  // Radar separation labels: neutral when backend values are absent.
  const hvlLoyalty = profiles.find((p) => p.segment_name === 'High-Value Loyal')?.mean_loyalty_score;
  const occasionalLoyalty = profiles.find((p) => p.segment_name === 'Occasional Buyer')?.mean_loyalty_score;

  return (
    <div className="space-y-6">
      {/* Page Header & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#A18A52]/20">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#EAE7DB] tracking-tight">
            Customer <span className="text-gradient-gold">Behavioral Segmentation</span>
          </h2>
          <p className="text-xs text-[#EAE7DB]/60 mt-0.5">
            Unsupervised behavioral clustering on {allCustomers.length || '—'} customer profiles using{' '}
            {metricsData?.champion?.candidateSet || '—'}.
          </p>
        </div>

        <div className="flex items-center p-1 bg-[#1A1D16] rounded-xl text-xs font-bold border border-[#A18A52]/25 shadow-inner self-start sm:self-auto">
          <button
            onClick={() => setActiveView('profiles')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'profiles'
                ? 'bg-gradient-to-r from-[#D5B66E] to-[#B99A55] text-[#10120F] shadow-md font-black'
                : 'text-[#EAE7DB]/70 hover:text-[#FFF1C5]'
            }`}
          >
            <PieChartIcon className="w-3.5 h-3.5" />
            <span>Segment Profiles & Playbooks</span>
          </button>
          <button
            onClick={() => setActiveView('model_evaluation')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'model_evaluation'
                ? 'bg-gradient-to-r from-[#D5B66E] to-[#B99A55] text-[#10120F] shadow-md font-black'
                : 'text-[#EAE7DB]/70 hover:text-[#FFF1C5]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>ML Model Evaluation Grid</span>
          </button>
        </div>
      </div>

      {activeView === 'profiles' ? (
        <>
          {/* 4 Segment Navigation Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {profiles.map((seg) => {
              const isSelected = seg.segment_name === selectedSegment;
              const style = getSegmentStyle(seg.segment_name);
              const isAtRisk = seg.segment_name === 'At-Risk Dormant';

              let borderTopColor = 'border-t-2 border-t-[#A5B86A]';
              if (seg.segment_name === 'Offer-Sensitive') borderTopColor = 'border-t-2 border-t-[#D5B66E]';
              else if (isAtRisk) borderTopColor = 'border-t-2 border-t-[#E8785A]';
              else if (seg.segment_name === 'Occasional Buyer') borderTopColor = 'border-t-2 border-t-[#81966B]';

              return (
                <button
                  key={seg.segment_name}
                  onClick={() => handleSelectSegment(seg.segment_name)}
                  className={`p-4 rounded-2xl text-left border transition-all duration-200 cursor-pointer relative ${borderTopColor} ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#2a3023] via-[#22251e] to-[#171a13] border-[#D5B66E]/50 ring-2 ring-[#D5B66E]/40 shadow-[0_8px_24px_rgba(0,0,0,0.6)] scale-[1.02]'
                      : 'glossy-card glossy-card-hover border-[#A18A52]/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="w-3 h-3 rounded-full shadow-xs"
                      style={{ backgroundColor: style.color, boxShadow: `0 0 10px ${style.color}` }}
                    />
                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-[#10120F] text-[#D5B66E] border border-[#A18A52]/20">
                      Cluster {seg.cluster_id}
                    </span>
                  </div>

                  <h3 className={`text-sm font-black leading-snug ${isAtRisk ? 'text-[#FFA085]' : 'text-[#EAE7DB]'}`}>
                    {seg.segment_name}
                  </h3>

                  <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-[#A18A52]/15">
                    <span className="font-semibold text-[#EAE7DB]/60">
                      {seg.customer_count} cust ({seg.pct_of_customers}%)
                    </span>
                    <span className="font-extrabold text-[#D5B66E] font-mono">
                      {formatCompactCurrency(seg.total_revenue)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ================================================================= */}
          {/*  FEATURED HIGH-VALUE LOYAL SHOWCASE CHART (Champagne Ivory Panel)  */}
          {/* ================================================================= */}
          <motion.div
            key={selectedSegment}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="panel-champagne-lux panel-champagne-glow rounded-3xl p-6 sm:p-8 relative overflow-hidden"
          >
            {/* Specular golden top edge reflection */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#D5B66E]/80 via-white/90 to-transparent pointer-events-none" />

            {/* Showcase Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#B99A55]/30">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#059669] via-[#047857] to-[#10B981] flex items-center justify-center text-[#FFF1C5] shadow-md ring-1 ring-[#D5B66E]/50">
                    <Crown className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl sm:text-2xl font-black text-[#1A1D16] tracking-tight">
                        {currentProfile.segment_name} — Behavioral Benchmark
                      </h3>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#FFFFFF] border border-[#B99A55]/40 text-[#8A6F27] shadow-2xs">
                        Cluster #{currentProfile.cluster_id}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-[#303629] font-medium max-w-2xl leading-relaxed">
                  {currentStyle.description}
                </p>
              </div>

              {/* Action Button: Customer Explorer */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => navigate(`/explorer?segment=${encodeURIComponent(currentProfile.segment_name)}`)}
                  title="Explore accounts in Customer Explorer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-gold text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <span>Explore {currentProfile.customer_count} Accounts</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Strategic Directive Alert Bar */}
            <div className="my-5 p-4 rounded-2xl bg-gradient-to-r from-[#FFFFFF] via-[#FAF6EC] to-[#F5EED9] border border-[#B99A55]/40 flex items-start gap-3.5 shadow-sm">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#8A6F27] to-[#D5B66E] text-[#10120F] shrink-0 shadow-md">
                <Award className="w-4 h-4" />
              </div>
              <div className="text-[#303629] space-y-0.5">
                <div className="flex items-center gap-2 text-[#8A6F27] font-black text-xs uppercase tracking-wide">
                  <span>★ STRATEGIC MANDATE:</span>
                  <span className="font-extrabold underline decoration-[#B99A55] underline-offset-2">
                    {currentProfile.strategic_playbook.split(':')[0]}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#1A1D16] leading-relaxed">
                  {currentProfile.strategic_playbook.split(':').slice(1).join(':')}
                </p>
              </div>
            </div>

            {/* Two-Column Showcase: Left Key Numbers & Right Interactive Dimension Gauge Bars */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              {/* Left Column: Segment Power Cards (Customer Count, Share, Revenue, AOV) */}
              <div className="lg:col-span-4 space-y-3.5 flex flex-col justify-between">
                {/* Revenue Dominance Highlight Box */}
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border-2 border-[#059669]/30 shadow-md relative overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#047857]">
                      Revenue Contribution
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#059669]/15 text-[#047857] border border-[#059669]/30 font-mono">
                      {currentProfile.pct_of_revenue}% SHARE
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[#1A1D16] font-mono tracking-tight">
                    {formatCurrency(currentProfile.total_revenue)}
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#E8DFCA] flex justify-between text-xs text-[#303629]">
                    <span>Cohort Share:</span>
                    <strong className="text-[#047857] font-mono font-bold">
                      {isHighValue ? `${currentProfile.pct_of_revenue}% of all sales` : `${currentProfile.pct_of_revenue}%`}
                    </strong>
                  </div>
                </div>

                {/* Account Volume Box */}
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#B99A55]/30 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A6F27]">
                      Cohort Accounts
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#8A6F27]/15 text-[#8A6F27] border border-[#B99A55]/30 font-mono">
                      {currentProfile.pct_of_customers}% COHORT
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[#1A1D16] font-mono">
                    {currentProfile.customer_count} Customers
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#E8DFCA] flex justify-between text-xs text-[#303629]">
                    <span>Average Spend:</span>
                    <strong className="text-[#1A1D16] font-mono font-bold">
                      {formatCurrency(currentProfile.mean_monetary)}
                    </strong>
                  </div>
                </div>

                {/* Order Dynamics Box */}
                <div className="p-4 rounded-2xl bg-[#FFFFFF] border border-[#B99A55]/30 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8A6F27]">
                      Average Order Value
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#8A6F27]/15 text-[#8A6F27] border border-[#B99A55]/30 font-mono">
                      AOV
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[#1A1D16] font-mono">
                    {formatCurrency(currentProfile.mean_aov)}
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#E8DFCA] flex justify-between text-xs text-[#303629]">
                    <span>Mean Frequency:</span>
                    <strong className="text-[#1A1D16] font-mono font-bold">
                      {currentProfile.mean_frequency} orders / customer
                    </strong>
                  </div>
                </div>
              </div>

              {/* Right Column: High-Contrast Visual Metric Benchmark Bars */}
              <div className="lg:col-span-8 p-5 sm:p-6 bg-[#FFFFFF] rounded-2xl border-2 border-[#B99A55]/35 shadow-md flex flex-col justify-between">
                <div className="flex items-center justify-between pb-3 border-b border-[#B99A55]/20">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#059669]" />
                    <h4 className="text-xs font-black text-[#1A1D16] uppercase tracking-wider">
                      {currentProfile.segment_name} — Normalized Behavioral Profile
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-[#8A6F27] bg-[#FAF6EC] px-2 py-0.5 rounded-md border border-[#B99A55]/30">
                    RFM-P Centroid Benchmarks
                  </span>
                </div>

                {/* Interactive Animated Metric Bars */}
                <div className="space-y-4 my-3">
                  {highValueMetrics.map((item, idx) => {
                    const isHovered = hoveredMetric === item.dimension;
                    return (
                      <div
                        key={item.dimension}
                        onMouseEnter={() => setHoveredMetric(item.dimension)}
                        onMouseLeave={() => setHoveredMetric(null)}
                        className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                          isHovered
                            ? 'bg-[#FAF6EC] border border-[#B99A55]/40 shadow-sm transform -translate-y-0.5'
                            : 'hover:bg-[#FAF6EC]/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shadow-xs"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-extrabold text-[#1A1D16]">
                              {item.dimension}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-semibold text-[#303629]/80 hidden sm:inline">
                              {item.baseline}
                            </span>
                            <span className="font-black font-mono text-[#047857] text-xs">
                              {item.index}
                            </span>
                            <span className="font-mono font-extrabold text-[#1A1D16] text-xs w-24 text-right">
                              {item.rawVal}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar with Gradient & Smooth Animation */}
                        <div className="w-full h-3 bg-[#E8DFCA]/60 rounded-full overflow-hidden p-0.5 border border-[#B99A55]/25">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.score}%` }}
                            transition={{ duration: 0.9, delay: idx * 0.1, ease: 'easeOut' }}
                            className={`h-full rounded-full bg-gradient-to-r ${item.grad} shadow-xs relative`}
                          >
                            {/* Shiny reflective sweep */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                          </motion.div>
                        </div>

                        <p className="text-[10px] text-[#303629] font-medium mt-1">
                          {item.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Insight in Light Panel */}
                <div className="pt-3 border-t border-[#B99A55]/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#303629]">
                  <span className="font-semibold">
                    Composite RFM Loyalty Score: <strong className="text-[#047857]">{currentProfile.mean_loyalty_score.toFixed(1)} / 100</strong>
                  </span>
                  <span className="text-[11px] text-[#8A6F27] font-bold">
                    ★ Dominant Cohort Spend Multiplier: {monetaryMultiplier !== '—' ? `${monetaryMultiplier}x average` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ================================================================= */}
          {/*  CROSS-SEGMENT RADAR & SCATTER (Champagne Ivory Panels)           */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Multi-Segment Radar Chart Panel */}
            <div className="lg:col-span-6 panel-champagne-lux panel-champagne-glow rounded-3xl p-6 flex flex-col">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#B99A55]/25">
                <div>
                  <h3 className="text-sm font-black text-[#1A1D16] uppercase tracking-tight">
                    Normalized Dimension Comparison
                  </h3>
                  <p className="text-xs text-[#047857] font-extrabold mt-0.5">
                    ★ RADAR SEPARATION: High-Value Loyal ({hvlLoyalty != null ? Math.round(hvlLoyalty) : '—'} Loyalty) vs Occasional Buyer ({occasionalLoyalty != null ? Math.round(occasionalLoyalty) : '—'} Loyalty)
                  </p>
                </div>
              </div>

              <div className="h-76 my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(185, 154, 85, 0.35)" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: '#1A1D16', fontSize: 11, fontWeight: 700 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#303629' }} />
                    {profiles.map((seg, idx) => {
                      const color = RADAR_SERIES_COLORS[seg.segment_name]
                        || RADAR_FALLBACK_COLORS[idx % RADAR_FALLBACK_COLORS.length];
                      return (
                        <Radar
                          key={seg.segment_name}
                          name={seg.segment_name}
                          dataKey={seg.segment_name}
                          stroke={color}
                          fill={color}
                          fillOpacity={idx === 0 ? 0.35 : 0.25}
                          strokeWidth={idx === 0 ? 2 : 1.5}
                        />
                      );
                    })}
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#1A1D16', fontWeight: 'bold' }} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        return (
                          <div className="bg-[#FFFFFF] border-2 border-[#B99A55] rounded-xl p-3 shadow-xl text-xs">
                            <p className="font-black text-[#1A1D16] mb-1.5 pb-1 border-b border-[#E8DFCA]">{label}</p>
                            <div className="space-y-1">
                              {payload.map((p) => (
                                <p key={p.name} className="flex justify-between gap-3 text-xs" style={{ color: p.color }}>
                                  <span className="font-bold">{p.name}:</span>
                                  <span className="font-mono font-black">{p.value} / 100</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recency vs Monetary Scatter Plot Panel */}
            <div className="lg:col-span-6 panel-champagne-lux panel-champagne-glow rounded-3xl p-6 flex flex-col">
              <div className="flex items-center justify-between pb-3.5 border-b border-[#B99A55]/25">
                <div>
                  <h3 className="text-sm font-black text-[#1A1D16] uppercase tracking-tight">
                    Customer Cluster Distribution
                  </h3>
                  <p className="text-xs text-[#BE123C] font-extrabold mt-0.5">
                    ★ CRITICAL CHURN ZONE: Accounts on far right (&gt;90d recency) require immediate win-back
                  </p>
                </div>
              </div>

              <div className="h-76 my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 15, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(185, 154, 85, 0.22)" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Recency"
                      unit="d"
                      label={{ value: 'Recency (Days)', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#1A1D16', fontWeight: 700 }}
                      tick={{ fontSize: 11, fill: '#303629', fontWeight: 600 }}
                      axisLine={{ stroke: 'rgba(185, 154, 85, 0.45)' }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Monetary"
                      tickFormatter={(val) => `${currencyPrefix}${(val / 1000).toFixed(0)}k`}
                      label={{ value: currencyPrefix ? `Monetary (${currencyPrefix})` : 'Monetary', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#1A1D16', fontWeight: 700 }}
                      tick={{ fontSize: 11, fill: '#303629', fontWeight: 600 }}
                      axisLine={{ stroke: 'rgba(185, 154, 85, 0.45)' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-[#FFFFFF] border-2 border-[#B99A55] rounded-xl p-3 shadow-xl text-xs">
                            <p className="font-black text-[#1A1D16]">{data.id}</p>
                            <p className="text-[#303629]">Segment: <strong className="text-[#1A1D16]">{data.segment}</strong></p>
                            <p className="text-[#303629]">Recency: <strong className="text-[#1A1D16]">{data.x} days</strong></p>
                            <p className="text-[#303629]">Spend: <strong className="text-[#047857]">{formatCurrency(data.y)}</strong></p>
                            <p className="text-[#303629]">Orders: <strong className="text-[#1A1D16]">{data.z} orders</strong></p>
                          </div>
                        );
                      }}
                    />
                    {profiles.map((seg) => {
                      const segPoints = scatterData.filter((c) => c.segment === seg.segment_name);
                      const config = {
                        'High-Value Loyal': '#059669',
                        'Offer-Sensitive': '#D97706',
                        'At-Risk Dormant': '#E11D48',
                        'Occasional Buyer': '#0D9488',
                      };
                      return (
                        <Scatter
                          key={seg.segment_name}
                          name={seg.segment_name}
                          data={segPoints}
                          fill={config[seg.segment_name] || '#8A6F27'}
                        />
                      );
                    })}
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#1A1D16', fontWeight: 'bold' }} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Model Evaluation Grid View */
        <div className="space-y-6">
          <div className="glossy-card rounded-2xl border border-[#A18A52]/25 p-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#A18A52]/15">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A5B86A]/15 text-[#D4E897] text-xs font-bold border border-[#A5B86A]/35">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Selected Champion Configuration
                </div>
                <h3 className="text-lg font-black text-[#EAE7DB]">
                  {metricsData?.champion?.candidateSet || '—'} at K = {metricsData?.champion?.k ?? '—'}
                </h3>
                <p className="text-xs text-[#EAE7DB]/60">
                  Evaluated across a {metricsData?.grid?.length ?? '—'}-configuration grid ({new Set((metricsData?.grid || []).map((m) => m.candidate_set)).size} candidate feature matrices × K ∈ [2, 8])
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#1A1D16] rounded-xl border border-[#A18A52]/20">
                  <div className="text-[10px] uppercase font-bold text-[#A18A52]">Silhouette</div>
                  <div className="text-base font-black text-[#D5B66E]">
                    {metricsData?.champion?.silhouetteScore != null ? Number(metricsData.champion.silhouetteScore).toFixed(4) : '—'}
                  </div>
                </div>
                <div className="p-3 bg-[#1A1D16] rounded-xl border border-[#A18A52]/20">
                  <div className="text-[10px] uppercase font-bold text-[#A18A52]">Davies-Bouldin</div>
                  <div className="text-base font-black text-[#A5B86A]">
                    {metricsData?.champion?.daviesBouldin != null ? Number(metricsData.champion.daviesBouldin).toFixed(4) : '—'}
                  </div>
                </div>
                <div className="p-3 bg-[#1A1D16] rounded-xl border border-[#A18A52]/20">
                  <div className="text-[10px] uppercase font-bold text-[#A18A52]">Calinski-Harabasz</div>
                  <div className="text-base font-black text-[#EAE7DB]">
                    {metricsData?.champion?.calinskiHarabasz != null ? Number(metricsData.champion.calinskiHarabasz).toFixed(2) : '—'}
                  </div>
                </div>
                <div className="p-3 bg-[#1A1D16] rounded-xl border border-[#A18A52]/20">
                  {/* Stability ARI = cross-seed K-Means stability mean ARI.
                      This is DISTINCT from post-hoc external persona validation ARI. */}
                  <div className="text-[10px] uppercase font-bold text-[#A18A52]">Stability ARI</div>
                  <div className="text-base font-black text-[#A5B86A]">
                    {metricsData?.champion?.stabilityAri != null ? Number(metricsData.champion.stabilityAri).toFixed(4) : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Line Chart */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-[#A18A52] uppercase tracking-wider mb-2">
                {metricsData?.champion?.candidateSet || '—'}: Silhouette Score & Davies-Bouldin vs Cluster Count (K)
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={championMetrics} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(161, 138, 82, 0.15)" />
                    <XAxis
                      dataKey="k"
                      tick={{ fontSize: 11, fill: '#EAE7DB' }}
                      label={{ value: 'Cluster Count (K)', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#A18A52' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#EAE7DB' }}
                      domain={[0.3, 1.1]}
                    />
                    <Tooltip contentStyle={{ backgroundColor: '#1A1D16', border: '1px solid #A18A52', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="silhouette_score"
                      name="Silhouette Score (higher is better)"
                      stroke="#D5B66E"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: '#D5B66E' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="davies_bouldin_index"
                      name="Davies-Bouldin Index (lower is better)"
                      stroke="#E8785A"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#E8785A' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Grid Table */}
            <div className="mt-8">
              <h4 className="text-xs font-bold text-[#A18A52] uppercase tracking-wider mb-3">
                Full {metricsData?.grid?.length ?? '—'}-Configuration Evaluation Grid (data/segmentation_metrics.csv)
              </h4>
              <div className="overflow-x-auto max-h-96 border border-[#A18A52]/20 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#171a13] sticky top-0 border-b border-[#A18A52]/25 text-[#A18A52] font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Candidate Feature Set</th>
                      <th className="py-2.5 px-3">K</th>
                      <th className="py-2.5 px-3">Silhouette</th>
                      <th className="py-2.5 px-3">Davies-Bouldin</th>
                      <th className="py-2.5 px-3">Calinski-Harabasz</th>
                      <th className="py-2.5 px-3">Cluster Sizes</th>
                      <th className="py-2.5 px-3">Min Size %</th>
                      <th className="py-2.5 px-3">Stability ARI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#A18A52]/10 text-[#EAE7DB]">
                    {metricsData?.grid?.map((row, idx) => {
                      const isChampion =
                        row.candidate_set === metricsData?.champion?.candidateSet &&
                        row.k === metricsData?.champion?.k;
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-[#303629]/30 transition-colors ${
                            isChampion ? 'bg-[#303629]/50 font-bold text-[#FFF1C5]' : ''
                          }`}
                        >
                          <td className="py-2 px-3">
                            {row.candidate_set}
                            {isChampion && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#D5B66E] text-[#10120F] font-black">
                                CHAMPION
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono">{row.k}</td>
                          <td className="py-2 px-3 font-mono font-bold text-[#D5B66E]">
                            {row.silhouette_score.toFixed(4)}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {row.davies_bouldin_index.toFixed(4)}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {row.calinski_harabasz_score.toFixed(1)}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[#EAE7DB]/60">
                            {row.cluster_sizes}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {row.min_cluster_pct.toFixed(1)}%
                          </td>
                          <td className="py-2 px-3 font-mono text-[#A5B86A]">
                            {row.stability_ari_mean.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
