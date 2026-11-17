import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import dataService from '../services/dataService';
import KpiCard from '../components/common/KpiCard';
import {
  formatCurrency,
  formatCompactCurrency,
  formatNumber,
} from '../utils/formatters';
import { getSegmentStyle } from '../utils/theme';

// Distinct, vibrant segment colors tailored for the contrasting champagne analytics panels
const SEGMENT_CHART_COLORS = {
  'High-Value Loyal': {
    primary: '#059669', // Luminous Emerald
    rich: '#047857',
    light: '#34D399',
    goldAccent: '#D5B66E',
    gradId: 'loyalGrad',
  },
  'Offer-Sensitive': {
    primary: '#D97706', // Warm Amber Gold
    rich: '#B45309',
    light: '#FBBF24',
    goldAccent: '#B99A55',
    gradId: 'offerGrad',
  },
  'At-Risk Dormant': {
    primary: '#E11D48', // Rich Coral / Ruby
    rich: '#BE123C',
    light: '#FB7185',
    goldAccent: '#FFA085',
    gradId: 'atRiskGrad',
  },
  'Occasional Buyer': {
    primary: '#0D9488', // Sage Teal Green
    rich: '#0F766E',
    light: '#5EEAD4',
    goldAccent: '#81966B',
    gradId: 'occasionalGrad',
  },
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState(null);
  const [segmentData, setSegmentData] = useState([]);
  const [activeTab, setActiveTab] = useState('revenue');
  const [hoveredSegment, setHoveredSegment] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const overview = await dataService.getOverviewStats();
        const profiles = await dataService.getSegmentProfiles();
        setStats(overview);
        setSegmentData(profiles);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setStats(null);
        setSegmentData([]);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#D5B66E] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#EAE7DB]/70">Loading Executive Analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-semibold text-[#EAE7DB]/70">Analytics data is currently unavailable.</p>
        </div>
      </div>
    );
  }

  // Formatting chart data with vibrant distinct colors
  const pieChartData = segmentData.map((s) => {
    const config = SEGMENT_CHART_COLORS[s.segment_name] || {
      primary: '#A5B86A',
      light: '#D4E897',
      rich: '#303629',
    };
    return {
      name: s.segment_name,
      value: s.customer_count,
      percentage: s.pct_of_customers,
      revenue: s.total_revenue,
      revenuePct: s.pct_of_revenue,
      color: config.primary,
      lightColor: config.light,
      richColor: config.rich,
    };
  });

  const revenueComparisonData = segmentData.map((s) => {
    const config = SEGMENT_CHART_COLORS[s.segment_name] || {
      primary: '#A5B86A',
      light: '#D4E897',
      rich: '#303629',
    };
    return {
      name: s.segment_name,
      shortName: s.segment_name.replace(' Buyer', '').replace(' Dormant', ''),
      revenue: s.total_revenue,
      customerCount: s.customer_count,
      aov: s.mean_aov,
      revenuePct: s.pct_of_revenue,
      customerPct: s.pct_of_customers,
      color: config.primary,
      lightColor: config.light,
      richColor: config.rich,
    };
  });

  // Persona-specific KPI: intentionally tied to the At-Risk Dormant label.
  const atRiskProfile = segmentData.find((s) => s.segment_name === 'At-Risk Dormant');

  return (
    <div className="space-y-6">
      {/* Top Banner: Synthetic Cohort Context */}
      <div className="bg-gradient-to-r from-[#171a13] via-[#22251e] to-[#10120F] rounded-2xl p-6 sm:p-7 text-[#EAE7DB] shadow-[0_10px_30px_rgba(0,0,0,0.6)] border border-[#A18A52]/25 relative overflow-hidden">
        {/* Ambient Top-Right Radial Glow */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#D5B66E] via-[#303629] to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            {/* Priority Alert Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8785A]/15 text-[#FFA085] text-xs font-black border border-[#E8785A]/35 backdrop-blur-xs shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#E8785A] animate-ping" />
              <span>★ CRITICAL PORTFOLIO ALERT: {formatCurrency(stats.atRiskRevenue).toUpperCase()} IN {stats.atRiskCustomers ?? '—'} ACCOUNTS AT DIRECT CHURN HORIZON</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#EAE7DB]">
              Customer Portfolio & <span className="text-gradient-gold">Revenue Intelligence</span>
            </h2>

            <p className="text-xs sm:text-sm text-[#EAE7DB]/75 leading-relaxed font-medium">
              Enterprise behavioral analytics across {stats.totalCustomers} customer accounts. <strong className="text-[#D5B66E]">{stats.topSegment?.pct_of_revenue ?? '—'}% of cumulative revenue</strong> is anchored in {stats.topSegment?.customer_count ?? '—'} {stats.topSegment?.segment_name || '—'} accounts, while <strong className="text-[#FFA085]">{atRiskProfile?.pct_of_customers ?? '—'}% of cohort</strong> requires urgent win-back activation.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/explorer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl btn-gold text-xs font-bold transition-all shadow-lg shadow-black/40"
            >
              Explore {stats.totalCustomers} Customers
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Customers"
          value={formatNumber(stats.totalCustomers)}
          subtitle="Fixed snapshot cohort"
          icon={Users}
          variant="gold"
          trend="Cohort Snapshot"
          trendPositive={true}
          trendLabel={`${stats.totalCustomers} accounts`}
        />

        <KpiCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          subtitle="Exact monetary reconciliation"
          icon={DollarSign}
          variant="emerald"
          trend={`+${stats.topSegment?.pct_of_revenue ?? '—'}% Share`}
          trendPositive={true}
          trendLabel="Anchor spend"
        />

        <KpiCard
          title="Avg Customer Value"
          value={formatCurrency(stats.avgCustomerValue)}
          subtitle="Cohort mean lifetime spend"
          icon={TrendingUp}
          variant="indigo"
          trend={`Mean AOV: ${formatCurrency(stats.avgOrderValue)}`}
          trendPositive={true}
          trendLabel=""
        />

        <KpiCard
          title="At-Risk Revenue"
          value={formatCurrency(stats.atRiskRevenue)}
          subtitle={`${stats.atRiskCustomers ?? '—'} dormant customers (>90d)`}
          icon={AlertTriangle}
          variant="rose"
          trend={`${atRiskProfile?.mean_spend_trend?.toFixed(1) ?? '—'}% Spend Trend`}
          trendPositive={false}
          trendLabel="Immediate win-back"
        />
      </div>

      {/* ===================================================================== */}
      {/*  CONTRASTING LUXURY ANALYTICS PANELS (Champagne / Pearl Ivory)        */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Customer & Revenue Distribution Donut Chart */}
        <div className="lg:col-span-5 panel-champagne-lux panel-champagne-glow rounded-2xl p-5 sm:p-6 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#B99A55]/25">
            <div>
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-[#8A6F27]" />
                <h3 className="text-sm font-black text-[#1A1D16] tracking-tight uppercase">
                  Segment Distribution
                </h3>
              </div>
              <p className="text-xs text-[#303629] font-medium mt-0.5">
                Share of customers vs. share of total turnover
              </p>
            </div>

            {/* Metric Switcher Tab */}
            <div className="flex items-center p-0.5 bg-[#E8DFCA] rounded-xl text-xs font-bold text-[#303629] border border-[#B99A55]/30 shadow-inner">
              <button
                onClick={() => setActiveTab('customers')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'customers'
                    ? 'bg-[#FFFFFF] text-[#1A1D16] shadow-sm font-extrabold border border-[#B99A55]/40'
                    : 'hover:text-[#1A1D16]'
                }`}
              >
                Count
              </button>
              <button
                onClick={() => setActiveTab('revenue')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'revenue'
                    ? 'bg-[#FFFFFF] text-[#1A1D16] shadow-sm font-extrabold border border-[#B99A55]/40'
                    : 'hover:text-[#1A1D16]'
                }`}
              >
                Revenue
              </button>
            </div>
          </div>

          {/* Donut Chart Visual */}
          <div className="h-68 my-3 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {/* High-Value Loyal: Luminous Emerald & Olive */}
                  <linearGradient id="loyalGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="60%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                  {/* Offer-Sensitive: Warm Amber & Golden Orange */}
                  <linearGradient id="offerGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FBBF24" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>
                  {/* At-Risk Dormant: Rich Coral Ruby */}
                  <linearGradient id="atRiskGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FB7185" />
                    <stop offset="50%" stopColor="#F43F5E" />
                    <stop offset="100%" stopColor="#BE123C" />
                  </linearGradient>
                  {/* Occasional Buyer: Sage Teal Green */}
                  <linearGradient id="occasionalGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#5EEAD4" />
                    <stop offset="50%" stopColor="#14B8A6" />
                    <stop offset="100%" stopColor="#0F766E" />
                  </linearGradient>
                </defs>

                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey={activeTab === 'revenue' ? 'revenue' : 'value'}
                  isAnimationActive={true}
                  animationBegin={100}
                  animationDuration={1100}
                  animationEasing="ease-out"
                  onMouseEnter={(_, index) => setHoveredSegment(pieChartData[index].name)}
                  onMouseLeave={() => setHoveredSegment(null)}
                >
                  {pieChartData.map((entry) => {
                    const isHovered = hoveredSegment === entry.name;
                    const config = SEGMENT_CHART_COLORS[entry.name];
                    return (
                      <Cell
                        key={entry.name}
                        fill={`url(#${config?.gradId || 'loyalGrad'})`}
                        stroke={isHovered ? '#1A1D16' : '#FFFFFF'}
                        strokeWidth={isHovered ? 2.5 : 1.5}
                        style={{
                          filter: isHovered
                            ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))'
                            : 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                </Pie>

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#FFFFFF] border-2 border-[#B99A55] rounded-xl p-3 shadow-xl text-xs min-w-44">
                        <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-[#E8DFCA]">
                          <span
                            className="w-2.5 h-2.5 rounded-full shadow-xs"
                            style={{ backgroundColor: data.color }}
                          />
                          <p className="font-black text-[#1A1D16]">{data.name}</p>
                        </div>
                        <div className="space-y-1 font-semibold text-[#303629]">
                          <p className="flex justify-between">
                            <span>Customers:</span>
                            <span className="font-mono text-[#1A1D16]">{data.value} ({data.percentage}%)</span>
                          </p>
                          <p className="flex justify-between">
                            <span>Revenue:</span>
                            <span className="font-mono font-bold text-[#8A6F27]">{formatCurrency(data.revenue)} ({data.revenuePct}%)</span>
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Central Animated Total-Spend / Cohort Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="text-[10px] font-extrabold text-[#8A6F27] uppercase tracking-widest">
                {activeTab === 'revenue' ? 'Total Cohort Turnover' : 'Cohort Account Size'}
              </span>
              <motion.span
                key={activeTab}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-xl sm:text-2xl font-black text-[#1A1D16] tracking-tight font-mono drop-shadow-xs"
              >
                {activeTab === 'revenue'
                  ? formatCompactCurrency(stats.totalRevenue)
                  : `${stats.totalCustomers} Accounts`}
              </motion.span>
              <span className="text-[10px] font-bold text-[#303629]/70 uppercase tracking-wider">
                {activeTab === 'revenue' ? '100% Reconciled' : stats.modelManifest?.candidateSet || '—'}
              </span>
            </div>
          </div>

          {/* Segment Breakdown Legend List (High Contrast & Clear) */}
          <div className="space-y-2 mt-auto pt-3.5 border-t border-[#B99A55]/25">
            {pieChartData.map((item) => {
              const isHovered = hoveredSegment === item.name;
              return (
                <div
                  key={item.name}
                  onMouseEnter={() => setHoveredSegment(item.name)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                    isHovered ? 'bg-[#FFFFFF] shadow-sm border border-[#B99A55]/40' : 'hover:bg-[#FFFFFF]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs transition-transform"
                      style={{ 
                        backgroundColor: item.color,
                        boxShadow: `0 0 8px ${item.color}50`,
                        transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                      }}
                    />
                    <span className="font-extrabold text-[#1A1D16]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#303629] font-mono font-bold">
                      {item.value} cust ({item.percentage}%)
                    </span>
                    <span className="font-black text-[#8A6F27] font-mono w-24 text-right">
                      {formatCompactCurrency(item.revenue)} ({item.revenuePct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Revenue vs Customer Share (Pareto Analysis) Bar Chart */}
        <div className="lg:col-span-7 panel-champagne-lux panel-champagne-glow rounded-2xl p-5 sm:p-6 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#B99A55]/25">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#8A6F27]" />
                <h3 className="text-sm font-black text-[#1A1D16] tracking-tight uppercase">
                  Revenue vs Customer Share (Pareto Analysis)
                </h3>
              </div>
              <p className="text-xs text-[#303629] font-medium mt-0.5">
                Comparison of revenue share % against cohort customer %
              </p>
            </div>
            <Link
              to="/segmentation"
              className="text-xs font-bold text-[#8A6F27] hover:text-[#1A1D16] flex items-center gap-1 group bg-[#FFFFFF]/70 px-2.5 py-1 rounded-lg border border-[#B99A55]/30 hover:border-[#B99A55] transition-all shadow-2xs"
            >
              <span>Segment profiles</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Bar Chart Visual */}
          <div className="h-72 my-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenueComparisonData}
                margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
              >
                <defs>
                  {/* Distinct Segment Color Pairs for Revenue vs Customer share */}
                  <linearGradient id="barRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                  <linearGradient id="barCustGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(185, 154, 85, 0.22)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#1A1D16', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(185, 154, 85, 0.45)' }}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#303629', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(185, 154, 85, 0.45)' }}
                  unit="%"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(185, 154, 85, 0.12)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const segmentConfig = SEGMENT_CHART_COLORS[label];
                    return (
                      <div className="bg-[#FFFFFF] border-2 border-[#B99A55] rounded-xl p-3.5 shadow-2xl text-xs min-w-48">
                        <div className="flex items-center gap-2 mb-2 pb-1 border-b border-[#E8DFCA]">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: segmentConfig?.primary || '#8A6F27' }}
                          />
                          <p className="font-black text-[#1A1D16]">{label}</p>
                        </div>
                        <div className="space-y-1.5">
                          <p className="flex justify-between items-center text-[#047857] font-bold">
                            <span>Revenue Share:</span>
                            <span className="font-mono text-sm">{payload[0]?.value}%</span>
                          </p>
                          <p className="flex justify-between items-center text-[#B45309] font-bold">
                            <span>Customer Share:</span>
                            <span className="font-mono text-sm">{payload[1]?.value}%</span>
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  formatter={(value) => <span className="font-extrabold text-[#1A1D16]">{value}</span>}
                />

                <Bar
                  dataKey="revenuePct"
                  name="Revenue Share (%)"
                  fill="url(#barRevGrad)"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={1200}
                >
                  {revenueComparisonData.map((entry) => (
                    <Cell 
                      key={`rev-cell-${entry.name}`} 
                      fill={entry.primary || '#059669'} 
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="customerPct"
                  name="Customer Share (%)"
                  fill="url(#barCustGrad)"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={1400}
                >
                  {revenueComparisonData.map((entry) => (
                    <Cell 
                      key={`cust-cell-${entry.name}`} 
                      fill={entry.lightColor || '#D5B66E'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pareto Insight Callout */}
          <div className="p-3.5 bg-gradient-to-r from-[#FFFFFF] to-[#F8F3E6] border border-[#B99A55]/40 rounded-xl mt-auto text-xs flex items-start gap-3 shadow-xs">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#D5B66E] to-[#8A6F27] text-[#10120F] shrink-0 shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-[#303629] space-y-0.5">
              <div className="text-[#8A6F27] font-black text-xs uppercase tracking-wide flex items-center gap-1.5">
                <span>★ CRITICAL PARETO DIRECTIVE:</span>
                <span className="underline decoration-[#B99A55] underline-offset-2">
                  {stats.topSegment?.pct_of_revenue ?? '—'}% of Revenue Anchored in {stats.topSegment?.customer_count ?? '—'} Accounts
                </span>
              </div>
              <p className="text-[11px] font-semibold text-[#1A1D16] leading-relaxed">
                {stats.topSegment?.segment_name || '—'} accounts represent{' '}
                <strong>{stats.topSegment?.pct_of_customers ?? '—'}%</strong> of customers but generate{' '}
                <strong>{stats.topSegment?.pct_of_revenue ?? '—'}%</strong> of total company spend (
                {formatCurrency(stats.topSegment?.total_revenue)}
                ).{' '}
                <span className="text-[#BE123C] font-black">Strictly guard gross margins against discount erosion</span>{' '}
                on full-price buyers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Segment Quick Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#EAE7DB]">
              The Four Behavioral Segments
            </h3>
            <p className="text-xs text-[#D5B66E] font-bold">
              ★ CLUSTERING GROUND-TRUTH: K-Means {stats.modelManifest?.candidateSet || '—'} at K = {stats.modelManifest?.clusters ?? '—'} (Silhouette: {stats.modelManifest?.selectedSilhouette != null ? Number(stats.modelManifest.selectedSilhouette).toFixed(3) : '—'}, Stability ARI: {stats.modelManifest?.stabilityAri != null ? Number(stats.modelManifest.stabilityAri).toFixed(2) : '—'})
            </p>
          </div>
          <Link
            to="/segmentation"
            className="text-xs font-bold text-[#D5B66E] hover:text-[#FFF1C5] flex items-center gap-1 group"
          >
            <span>View Strategic Playbooks</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {segmentData.map((seg) => {
            const style = getSegmentStyle(seg.segment_name);
            const isAtRisk = seg.segment_name === 'At-Risk Dormant';

            // Distinct top accent border
            let topBorder = 'border-t-2 border-t-[#A5B86A]';
            if (seg.segment_name === 'Offer-Sensitive') {
              topBorder = 'border-t-2 border-t-[#D5B66E]';
            } else if (isAtRisk) {
              topBorder = 'border-t-2 border-t-[#E8785A]';
            } else if (seg.segment_name === 'Occasional Buyer') {
              topBorder = 'border-t-2 border-t-[#81966B]';
            }

            return (
              <div
                key={seg.segment_name}
                className={`glossy-card glossy-card-hover rounded-2xl p-5 flex flex-col justify-between ${topBorder} ${
                  isAtRisk ? 'surface-alert' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="w-3 h-3 rounded-full shadow-xs"
                      style={{ backgroundColor: style.color, boxShadow: `0 0 10px ${style.color}` }}
                    />
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-[#22251F] text-[#D5B66E] border border-[#A18A52]/20">
                      Cluster {seg.cluster_id}
                    </span>
                  </div>

                  <h4 className={`text-base font-extrabold mb-1 ${isAtRisk ? 'text-[#FFA085] font-black' : 'text-[#EAE7DB]'}`}>
                    {seg.segment_name}
                  </h4>

                  <p className={`text-xs line-clamp-2 mb-4 font-medium ${isAtRisk ? 'text-[#FFA085]/90' : 'text-[#EAE7DB]/60'}`}>
                    {seg.strategic_playbook.split(':')[0]}
                  </p>

                  <div className="space-y-2 pt-3 border-t border-[#A18A52]/15 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#EAE7DB]/60 font-medium">Customer Count</span>
                      <span className="font-extrabold text-[#EAE7DB] font-mono">
                        {seg.customer_count} ({seg.pct_of_customers}%)
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#EAE7DB]/60 font-medium">Total Revenue</span>
                      <span className={`font-extrabold font-mono ${isAtRisk ? 'text-[#FFA085] font-black' : 'text-[#D5B66E]'}`}>
                        {formatCurrency(seg.total_revenue)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#EAE7DB]/60 font-medium">Mean Order Value</span>
                      <span className="font-semibold text-[#EAE7DB] font-mono">
                        {formatCurrency(seg.mean_aov)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#EAE7DB]/60 font-medium">Mean Recency</span>
                      <span className={`font-semibold font-mono ${isAtRisk ? 'text-[#FFA085]' : 'text-[#EAE7DB]'}`}>
                        {seg.mean_recency} days
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#A18A52]/15">
                  <Link
                    to={`/explorer?segment=${encodeURIComponent(seg.segment_name)}`}
                    className={`text-xs font-bold flex items-center justify-between group ${
                      isAtRisk ? 'text-[#FFA085] hover:text-[#FFF1C5]' : 'text-[#D5B66E] hover:text-[#FFF1C5]'
                    }`}
                  >
                    <span>View customers</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
