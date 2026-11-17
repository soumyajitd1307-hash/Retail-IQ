import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingBag,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import dataService from '../services/dataService';
import KpiCard from '../components/common/KpiCard';
import { formatCurrency, formatCompactCurrency, formatNumber, formatPercent, getCurrencyPrefix } from '../utils/formatters';
import { getSegmentStyle, COLORS, CHART_COLORS } from '../utils/theme';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

export default function RevenueBehaviour() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState(null);
  const [segmentData, setSegmentData] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const overview = await dataService.getOverviewStats();
        const profiles = await dataService.getSegmentProfiles();
        const customers = await dataService.getAllCustomers();
        setStats(overview);
        setSegmentData(profiles);
        setAllCustomers(customers);
      } catch (err) {
        console.error('Failed to load revenue data:', err);
        setStats(null);
        setSegmentData([]);
        setAllCustomers([]);
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
          <p className="text-xs font-semibold text-[#EAE7DB]/60">Loading Revenue Intelligence...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <p className="text-xs font-semibold text-[#EAE7DB]/60">Revenue analytics are currently unavailable.</p>
        </div>
      </div>
    );
  }

  // Revenue by segment for area chart 
  const revenueBySegment = segmentData.map(s => ({
    name: (s.segment_name || '—').split(' ').slice(0, 2).join(' '),
    fullName: s.segment_name || '—',
    revenue: s.total_revenue ?? 0,
    customers: s.customer_count ?? 0,
    avgSpend: s.customer_count > 0 ? (s.total_revenue ?? 0) / s.customer_count : null,
    aov: s.mean_aov,
    revenuePct: s.pct_of_revenue,
  }));

  // CLV distribution buckets (labels follow the configured currency, if any)
  const currencyPrefix = getCurrencyPrefix();
  const clvBuckets = [
    { name: `<${currencyPrefix}5k`, count: 0, totalRev: 0 },
    { name: `${currencyPrefix}5k-${currencyPrefix}15k`, count: 0, totalRev: 0 },
    { name: `${currencyPrefix}15k-${currencyPrefix}30k`, count: 0, totalRev: 0 },
    { name: `${currencyPrefix}30k-${currencyPrefix}50k`, count: 0, totalRev: 0 },
    { name: `>${currencyPrefix}50k`, count: 0, totalRev: 0 },
  ];
  allCustomers.forEach(c => {
    if (c.monetary < 5000) { clvBuckets[0].count++; clvBuckets[0].totalRev += c.monetary; }
    else if (c.monetary < 15000) { clvBuckets[1].count++; clvBuckets[1].totalRev += c.monetary; }
    else if (c.monetary < 30000) { clvBuckets[2].count++; clvBuckets[2].totalRev += c.monetary; }
    else if (c.monetary < 50000) { clvBuckets[3].count++; clvBuckets[3].totalRev += c.monetary; }
    else { clvBuckets[4].count++; clvBuckets[4].totalRev += c.monetary; }
  });

  // Spend trend distribution
  const trendGroups = [
    { name: 'Strong Growth (>20%)', count: 0, color: '#A5B86A' },
    { name: 'Moderate Growth (5-20%)', count: 0, color: '#81966B' },
    { name: 'Stable (-5 to 5%)', count: 0, color: '#D5B66E' },
    { name: 'Declining (-20 to -5%)', count: 0, color: '#B99A55' },
    { name: 'Sharp Decline (<-20%)', count: 0, color: '#E8785A' },
  ];
  allCustomers.forEach(c => {
    const t = c.spend_trend || 0;
    if (t > 20) trendGroups[0].count++;
    else if (t > 5) trendGroups[1].count++;
    else if (t > -5) trendGroups[2].count++;
    else if (t > -20) trendGroups[3].count++;
    else trendGroups[4].count++;
  });

  // AOV by segment
  const aovData = segmentData.map(s => ({
    name: (s.segment_name || '—').split(' ').slice(0, 2).join(' '),
    aov: s.mean_aov,
    medianAov: s.median_aov,
    color: getSegmentStyle(s.segment_name).color,
  }));

  // Top 10 customers by revenue
  const topCustomers = [...allCustomers]
    .sort((a, b) => b.monetary - a.monetary)
    .slice(0, 10);

  const totalRevenue = stats.totalRevenue;
  const avgLTV = stats.totalCustomers > 0 ? totalRevenue / stats.totalCustomers : null;
  // Revenue anchor is derived from the data, not a hardcoded segment name.
  const topSegment = segmentData.reduce(
    (best, s) => (!best || (s.pct_of_revenue || 0) > (best.pct_of_revenue || 0) ? s : best),
    null
  );
  const topSegmentRevPct = topSegment?.pct_of_revenue ?? '—';
  // Persona-specific KPI: intentionally tied to the At-Risk Dormant label.
  const atRiskProfile = segmentData.find(s => s.segment_name === 'At-Risk Dormant');

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="pb-2 border-b border-[#A18A52]/15">
        <h2 className="text-xl font-extrabold tracking-tight">
          <span className="text-[#EAE7DB]">Revenue & </span>
          <span className="text-gradient-gold">Customer Behaviour</span>
        </h2>
        <p className="text-xs text-[#EAE7DB]/50 mt-0.5">
          Comprehensive revenue analytics, customer lifetime value distributions, and spending pattern analysis across all segments.
        </p>
      </motion.div>

      {/* Revenue KPIs */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          subtitle="Cumulative cohort lifetime spend"
          icon={DollarSign}
          variant="gold"
          trend={`${topSegmentRevPct}% top segment`}
          trendPositive={true}
          trendLabel="Revenue anchor"
        />
        <KpiCard
          title="Avg Lifetime Value"
          value={formatCurrency(avgLTV)}
          subtitle="Mean per-customer revenue"
          icon={TrendingUp}
          variant="olive"
          trend={`AOV: ${formatCurrency(stats.avgOrderValue)}`}
          trendPositive={true}
        />
        <KpiCard
          title="Total Orders"
          value={formatNumber(stats.totalOrders)}
          subtitle="Aggregate transaction volume"
          icon={ShoppingBag}
          variant="sage"
          trend={`${stats.totalCustomers} customers`}
          trendPositive={true}
        />
        <KpiCard
          title="At-Risk Revenue"
          value={formatCurrency(stats.atRiskRevenue)}
          subtitle={`${stats.atRiskCustomers ?? '—'} dormant accounts`}
          icon={TrendingDown}
          variant="coral"
          trend={`${atRiskProfile?.mean_spend_trend != null ? atRiskProfile.mean_spend_trend.toFixed(1) : '—'}% Spend Trend`}
          trendPositive={false}
          trendLabel="Urgent"
        />
      </motion.div>

      {/* Revenue Distribution + CLV */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue by Segment Bar */}
        <div className="lg:col-span-7 glossy-card rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#A18A52]/10">
            <div>
              <h3 className="text-sm font-bold text-[#EAE7DB]">Revenue Contribution by Segment</h3>
              <p className="text-xs text-[#EAE7DB]/40">Total revenue and average order value per customer cluster</p>
            </div>
            <BarChart3 className="w-4 h-4 text-[#D5B66E]" />
          </div>
          <div className="h-72 my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueBySegment} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(161,138,82,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#EAE7DB80' }} tickLine={false} axisLine={{ stroke: 'rgba(161,138,82,0.15)' }} />
                <YAxis tick={{ fontSize: 11, fill: '#EAE7DB80' }} tickLine={false} axisLine={{ stroke: 'rgba(161,138,82,0.15)' }} tickFormatter={v => `${getCurrencyPrefix()}${(v/1000).toFixed(0)}k`} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="glossy-card rounded-xl p-3 text-xs min-w-44">
                      <p className="font-bold text-[#EAE7DB] mb-1.5 pb-1.5 border-b border-[#A18A52]/15">{d?.fullName}</p>
                      <div className="space-y-1 text-[#EAE7DB]/70">
                        <p>Revenue: <span className="font-bold text-[#D5B66E]">{formatCurrency(d?.revenue)}</span></p>
                        <p>Share: <span className="font-semibold text-[#EAE7DB]">{d?.revenuePct}%</span></p>
                        <p>Customers: <span className="font-semibold text-[#EAE7DB]">{d?.customers}</span></p>
                        <p>Avg Spend: <span className="font-semibold text-[#A5B86A]">{formatCurrency(d?.avgSpend)}</span></p>
                      </div>
                    </div>
                  );
                }} />
                <Bar dataKey="revenue" name="Revenue" fill="#D5B66E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CLV Distribution */}
        <div className="lg:col-span-5 glossy-card rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#A18A52]/10">
            <div>
              <h3 className="text-sm font-bold text-[#EAE7DB]">Customer Lifetime Value Distribution</h3>
              <p className="text-xs text-[#EAE7DB]/40">Spend tier bucketing across cohort</p>
            </div>
            <DollarSign className="w-4 h-4 text-[#A5B86A]" />
          </div>
          <div className="h-72 my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clvBuckets} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(161,138,82,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#EAE7DB80' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#EAE7DB80' }} tickLine={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="glossy-card rounded-xl p-2.5 text-xs">
                      <p className="font-bold text-[#EAE7DB] mb-1">{label}</p>
                      <p className="text-[#EAE7DB]/70">Customers: <span className="font-bold text-[#A5B86A]">{payload[0]?.value}</span></p>
                      <p className="text-[#EAE7DB]/70">Total: <span className="font-bold text-[#D5B66E]">{formatCurrency(payload[0]?.payload?.totalRev)}</span></p>
                    </div>
                  );
                }} />
                <Bar dataKey="count" fill="#A5B86A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Spend Trend + AOV Comparison */}
      <motion.div variants={fadeInUp} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Spend Trend Distribution */}
        <div className="lg:col-span-5 glossy-card rounded-2xl p-5 flex flex-col">
          <div className="pb-3 border-b border-[#A18A52]/10">
            <h3 className="text-sm font-bold text-[#EAE7DB]">Spend Trend Distribution</h3>
            <p className="text-xs text-[#EAE7DB]/40">Customer spending trajectory classification (P1 → P2)</p>
          </div>
          <div className="h-64 my-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={trendGroups} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="count">
                  {trendGroups.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="glossy-card rounded-xl p-2.5 text-xs">
                      <p className="font-bold text-[#EAE7DB] mb-1">{payload[0]?.name}</p>
                      <p className="text-[#EAE7DB]/70">Customers: <span className="font-bold text-[#D5B66E]">{payload[0]?.value}</span></p>
                    </div>
                  );
                }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-auto pt-3 border-t border-[#A18A52]/10">
            {trendGroups.map(g => (
              <div key={g.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="text-[#EAE7DB]/70">{g.name}</span>
                </div>
                <span className="font-bold font-mono text-[#EAE7DB]">{g.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AOV by Segment */}
        <div className="lg:col-span-7 glossy-card rounded-2xl p-5 flex flex-col">
          <div className="pb-3 border-b border-[#A18A52]/10">
            <h3 className="text-sm font-bold text-[#EAE7DB]">Average Order Value by Segment</h3>
            <p className="text-xs text-[#EAE7DB]/40">Mean vs median AOV comparison across behavioral clusters</p>
          </div>
          <div className="h-64 my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aovData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(161,138,82,0.08)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#EAE7DB80' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#EAE7DB80' }} tickLine={false} tickFormatter={v => `${getCurrencyPrefix()}${v.toFixed(0)}`} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="glossy-card rounded-xl p-2.5 text-xs">
                      <p className="font-bold text-[#EAE7DB] mb-1">{label}</p>
                      <p className="text-[#EAE7DB]/70">Mean AOV: <span className="font-bold text-[#D5B66E]">{formatCurrency(payload[0]?.value)}</span></p>
                      <p className="text-[#EAE7DB]/70">Median AOV: <span className="font-bold text-[#A5B86A]">{formatCurrency(payload[1]?.value)}</span></p>
                    </div>
                  );
                }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#EAE7DB' }} />
                <Bar dataKey="aov" name="Mean AOV" fill="#D5B66E" radius={[6, 6, 0, 0]} />
                <Bar dataKey="medianAov" name="Median AOV" fill="#81966B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Top 10 Revenue Customers */}
      <motion.div variants={fadeInUp} className="glossy-card rounded-2xl p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#A18A52]/10 mb-4">
          <div>
            <h3 className="text-sm font-bold text-[#EAE7DB]">
              Top 10 Revenue Contributors
            </h3>
            <p className="text-xs text-[#EAE7DB]/40">Highest lifetime value accounts across all segments</p>
          </div>
          <Users className="w-4 h-4 text-[#D5B66E]" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[#EAE7DB]/50 font-semibold border-b border-[#A18A52]/10">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Customer ID</th>
                <th className="py-2.5 px-3">Segment</th>
                <th className="py-2.5 px-3">Total Revenue</th>
                <th className="py-2.5 px-3">Orders</th>
                <th className="py-2.5 px-3">AOV</th>
                <th className="py-2.5 px-3">Loyalty Score</th>
                <th className="py-2.5 px-3">Spend Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#A18A52]/5">
              {topCustomers.map((c, i) => {
                const style = getSegmentStyle(c.segment_name);
                return (
                  <tr key={c.customer_id} className="hover:bg-[#303629]/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${style.color}20`, color: style.color }}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#EAE7DB]">{c.customer_id}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ backgroundColor: `${style.color}15`, color: style.color, border: `1px solid ${style.color}30` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.color }} />
                        {c.segment_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-extrabold text-[#D5B66E]">{formatCurrency(c.monetary)}</td>
                    <td className="py-2.5 px-3 font-mono text-[#EAE7DB]/70">{c.frequency}</td>
                    <td className="py-2.5 px-3 font-mono text-[#EAE7DB]/70">{formatCurrency(c.avg_order_value)}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold" style={{ color: c.loyalty_score >= 75 ? '#A5B86A' : c.loyalty_score >= 50 ? '#D5B66E' : '#E8785A' }}>
                        {c.loyalty_score != null ? c.loyalty_score.toFixed(1) : '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 font-semibold ${c.spend_trend > 0 ? 'text-[#A5B86A]' : 'text-[#E8785A]'}`}>
                        {c.spend_trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {c.spend_trend != null ? `${c.spend_trend.toFixed(1)}%` : 'N/A'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-[#A18A52]/10 text-xs text-[#EAE7DB]/40 italic">
          Demonstration data — {stats.totalCustomers ?? '—'} synthetic customer accounts. Revenue figures derived from ML segmentation pipeline output.
        </div>
      </motion.div>
    </motion.div>
  );
}
