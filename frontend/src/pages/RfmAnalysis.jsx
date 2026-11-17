import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShoppingBag,
  DollarSign,
  Sparkles,
  Layers,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';
import dataService from '../services/dataService';
import KpiCard from '../components/common/KpiCard';
import CustomerDrawer from '../components/common/CustomerDrawer';
import { formatCurrency, formatCompactCurrency, getCurrencyPrefix } from '../utils/formatters';
import { getSegmentStyle } from '../utils/theme';

export default function RfmAnalysis() {
  const [loading, setLoading] = useState(true);
  const [distributionData, setDistributionData] = useState(null);
  const [allCustomers, setAllCustomers] = useState([]);
  const [scatterMode, setScatterMode] = useState('recency_monetary'); // 'recency_monetary' | 'frequency_monetary' | 'recency_frequency' | 'loyalty_sensitivity'
  const [selectedSegmentFilter, setSelectedSegmentFilter] = useState('All');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [segmentNames, setSegmentNames] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const dist = await dataService.getRfmDistribution();
        const customers = await dataService.getAllCustomers();
        const profiles = await dataService.getSegmentProfiles();
        const names = (Array.isArray(profiles) ? profiles : [])
          .map((s) => s && s.segment_name)
          .filter((name) => typeof name === 'string' && name.length > 0);
        setDistributionData(dist);
        setAllCustomers(customers);
        setSegmentNames(names);
      } catch (err) {
        console.error('Failed to load RFM data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Keep the filter valid if backend segments change between runs.
  useEffect(() => {
    if (selectedSegmentFilter !== 'All' && !segmentNames.includes(selectedSegmentFilter)) {
      setSelectedSegmentFilter('All');
    }
  }, [segmentNames, selectedSegmentFilter]);

  if (loading || !distributionData) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#D5B66E] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#EAE7DB]/70">Calculating RFM Distributions...</p>
        </div>
      </div>
    );
  }

  const currencyPrefix = getCurrencyPrefix();
  const monetaryAxisLabel = currencyPrefix
    ? `Monetary Spend (${currencyPrefix})`
    : 'Monetary Spend';
  const monetarySelectLabel = currencyPrefix ? `Monetary (${currencyPrefix})` : 'Monetary';

  // Pre-process scatter plot coordinates based on selected axis mode
  const getScatterCoordinates = (customer) => {
    switch (scatterMode) {
      case 'frequency_monetary':
        return {
          x: customer.frequency,
          y: customer.monetary,
          xName: 'Frequency (Orders)',
          yName: monetaryAxisLabel,
          xUnit: ' orders',
          yFormat: (v) => formatCurrency(v),
        };
      case 'recency_frequency':
        return {
          x: customer.recency_days,
          y: customer.frequency,
          xName: 'Recency (Days)',
          yName: 'Frequency (Orders)',
          xUnit: 'd',
          yFormat: (v) => `${v} orders`,
        };
      case 'loyalty_sensitivity':
        return {
          x: customer.offer_sensitivity_score,
          y: customer.loyalty_score,
          xName: 'Offer Sensitivity Score',
          yName: 'RFM Loyalty Score',
          xUnit: '',
          yFormat: (v) => `${v.toFixed(1)}/100`,
        };
      case 'recency_monetary':
      default:
        return {
          x: customer.recency_days,
          y: customer.monetary,
          xName: 'Recency (Days)',
          yName: monetaryAxisLabel,
          xUnit: 'd',
          yFormat: (v) => formatCurrency(v),
        };
    }
  };

  const sampleCoord = getScatterCoordinates({
    recency_days: 10,
    monetary: 1000,
    frequency: 5,
    loyalty_score: 50,
    offer_sensitivity_score: 20,
  });

  const scatterPoints = allCustomers
    .filter((c) => selectedSegmentFilter === 'All' || c.segment_name === selectedSegmentFilter)
    .map((c) => {
      const coord = getScatterCoordinates(c);
      return {
        id: c.customer_id,
        x: coord.x,
        y: coord.y,
        segment: c.segment_name,
        rawCustomer: c,
        color: getSegmentStyle(c.segment_name).color,
      };
    });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#A18A52]/20">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#EAE7DB] tracking-tight">
            RFM Dimensional <span className="text-gradient-gold">Distributions & Matrix</span>
          </h2>
          <p className="text-xs text-[#EAE7DB]/60 mt-0.5">
            Recency, Frequency, and Monetary mathematical distributions and cross-dimensional behavioral matrices.
          </p>
        </div>
      </div>

      {/* RFM 3 Core Dimension KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Recency (Freshness)"
          value={`${Math.round(distributionData.stats.recency.avg)} days`}
          subtitle={`Range: ${distributionData.stats.recency.min}d to ${distributionData.stats.recency.max}d (Snapshot: 2026-10-30)`}
          icon={Clock}
          variant="gold"
          trend="Inactivity Threshold: 90d"
          trendPositive={true}
          trendLabel="At-Risk flag"
        />

        <KpiCard
          title="Frequency (Cadence)"
          value={`${distributionData.stats.frequency.avg.toFixed(1)} orders`}
          subtitle={`Range: ${distributionData.stats.frequency.min} to ${distributionData.stats.frequency.max} orders per account`}
          icon={ShoppingBag}
          variant="olive"
          trend="Log1p Transformed"
          trendPositive={true}
          trendLabel="K-Means normalized"
        />

        <KpiCard
          title="Monetary (Spend)"
          value={formatCurrency(distributionData.stats.monetary.avg)}
          subtitle={`Range: ${formatCurrency(distributionData.stats.monetary.min)} to ${formatCurrency(distributionData.stats.monetary.max)}`}
          icon={DollarSign}
          variant="emerald"
          trend={`Cohort Total: ${formatCompactCurrency(allCustomers.reduce((sum, c) => sum + (c.monetary || 0), 0))}`}
          trendPositive={true}
          trendLabel="Total turnover"
        />
      </div>

      {/* ===================================================================== */}
      {/*  CONTRASTING CHAMPAGNE PANELS: RFM Distribution Histograms Row        */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recency Bins */}
        <div className="panel-champagne-lux panel-champagne-glow rounded-3xl p-5 sm:p-6 flex flex-col">
          <div className="pb-3 border-b border-[#B99A55]/25 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-[#1A1D16] uppercase tracking-wider">
                Recency Cadence Bins
              </h3>
              <p className="text-[11px] text-[#303629] font-medium">Days since last checkout</p>
            </div>
            <Clock className="w-4 h-4 text-[#8A6F27]" />
          </div>

          <div className="h-56 my-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData.recencyBins}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(185, 154, 85, 0.22)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#1A1D16', fontWeight: 700 }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={45}
                />
                <YAxis tick={{ fontSize: 10, fill: '#303629' }} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="bg-[#FFFFFF] border-2 border-[#B99A55] rounded-xl p-2.5 shadow-xl text-xs">
                        <span className="font-black text-[#1A1D16]">{label}</span>: <strong className="text-[#8A6F27]">{payload[0]?.value} accounts</strong>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="#D5B66E" radius={[6, 6, 0, 0]} isAnimationActive={true} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-[#303629] pt-2 border-t border-[#B99A55]/20 flex justify-between">
            <span>&gt; 90 days indicates churn horizon</span>
            <span className="font-extrabold text-[#BE123C]">40 dormant accounts</span>
          </div>
        </div>

        {/* Frequency Bins */}
        <div className="panel-champagne-lux panel-champagne-glow rounded-3xl p-5 sm:p-6 flex flex-col">
          <div className="pb-3 border-b border-[#B99A55]/25 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-[#1A1D16] uppercase tracking-wider">
                Frequency Order Bins
              </h3>
              <p className="text-[11px] text-[#303629] font-medium">Unique order transactions</p>
            </div>
            <ShoppingBag className="w-4 h-4 text-[#059669]" />
          </div>

          <div className="h-56 my-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData.frequencyBins}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(185, 154, 85, 0.22)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#1A1D16', fontWeight: 700 }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={45}
                />
                <YAxis tick={{ fontSize: 10, fill: '#303629' }} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="bg-[#FFFFFF] border-2 border-[#B99A55] rounded-xl p-2.5 shadow-xl text-xs">
                        <span className="font-black text-[#1A1D16]">{label}</span>: <strong className="text-[#059669]">{payload[0]?.value} accounts</strong>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="#059669" radius={[6, 6, 0, 0]} isAnimationActive={true} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-[#303629] pt-2 border-t border-[#B99A55]/20 flex justify-between">
            <span>Repeat purchase cadence</span>
            <span className="font-extrabold text-[#059669]">61 Occasional (1-5)</span>
          </div>
        </div>

        {/* Monetary Bins */}
        <div className="panel-champagne-lux panel-champagne-glow rounded-3xl p-5 sm:p-6 flex flex-col">
          <div className="pb-3 border-b border-[#B99A55]/25 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-[#1A1D16] uppercase tracking-wider">
                Monetary Spend Bins
              </h3>
              <p className="text-[11px] text-[#303629] font-medium">Lifetime turnover per account</p>
            </div>
            <DollarSign className="w-4 h-4 text-[#B99A55]" />
          </div>

          <div className="h-56 my-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData.monetaryBins}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(185, 154, 85, 0.22)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#1A1D16', fontWeight: 700 }}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={45}
                />
                <YAxis tick={{ fontSize: 10, fill: '#303629' }} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="bg-[#FFFFFF] border-2 border-[#B99A55] rounded-xl p-2.5 shadow-xl text-xs">
                        <span className="font-black text-[#1A1D16]">{label}</span>: <strong className="text-[#8A6F27]">{payload[0]?.value} accounts</strong>
                        <p className="text-[10px] text-[#303629] mt-0.5 font-bold">
                          Turnover: {formatCurrency(payload[0]?.payload?.revenue)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="#A5B86A" radius={[6, 6, 0, 0]} isAnimationActive={true} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-[#303629] pt-2 border-t border-[#B99A55]/20 flex justify-between">
            <span>&gt; {currencyPrefix}30k High Spend tier</span>
            <span className="font-extrabold text-[#059669]">50 Loyalists</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/*  CONTRASTING CHAMPAGNE PANEL: Interactive Multi-Axis Scatter Plot    */}
      {/* ===================================================================== */}
      <div className="panel-champagne-lux panel-champagne-glow rounded-3xl p-6 sm:p-7 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#B99A55]/30">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#8A6F27]" />
              <h3 className="text-sm font-black text-[#1A1D16] uppercase tracking-wide">
                Interactive Cross-Dimensional Scatter Matrix
              </h3>
            </div>
            <p className="text-xs text-[#303629] font-medium mt-0.5">
              Select any two analytical dimensions to observe behavioral clustering separation
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Axis Dimension Selector */}
            <select
              value={scatterMode}
              onChange={(e) => setScatterMode(e.target.value)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FFFFFF] border-2 border-[#B99A55]/40 text-[#1A1D16] focus:outline-none focus:ring-2 focus:ring-[#B99A55]"
            >
              <option value="recency_monetary">Recency (Days) vs {monetarySelectLabel}</option>
              <option value="frequency_monetary">Frequency (Orders) vs {monetarySelectLabel}</option>
              <option value="recency_frequency">Recency (Days) vs Frequency (Orders)</option>
              <option value="loyalty_sensitivity">Offer Sensitivity vs Loyalty Score</option>
            </select>

            {/* Segment Filter */}
            <select
              value={selectedSegmentFilter}
              onChange={(e) => setSelectedSegmentFilter(e.target.value)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FFFFFF] border-2 border-[#B99A55]/40 text-[#1A1D16] focus:outline-none focus:ring-2 focus:ring-[#B99A55]"
            >
              <option value="All">All Segments ({segmentNames.length})</option>
              {segmentNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="h-80 my-4">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(185, 154, 85, 0.22)" />
              <XAxis
                type="number"
                dataKey="x"
                name={sampleCoord.xName}
                unit={sampleCoord.xUnit}
                label={{
                  value: sampleCoord.xName,
                  position: 'insideBottom',
                  offset: -10,
                  fontSize: 11,
                  fill: '#1A1D16',
                  fontWeight: 700,
                }}
                tick={{ fontSize: 11, fill: '#303629', fontWeight: 600 }}
                axisLine={{ stroke: 'rgba(185, 154, 85, 0.45)' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name={sampleCoord.yName}
                tickFormatter={(v) => (v >= 1000 ? `${currencyPrefix}${(v / 1000).toFixed(0)}k` : v)}
                label={{
                  value: sampleCoord.yName,
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 11,
                  fill: '#1A1D16',
                  fontWeight: 700,
                }}
                tick={{ fontSize: 11, fill: '#303629', fontWeight: 600 }}
                axisLine={{ stroke: 'rgba(185, 154, 85, 0.45)' }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#FFFFFF] border-2 border-[#B99A55] rounded-xl p-3 shadow-xl text-xs">
                      <p className="font-black text-[#1A1D16]">{d.id}</p>
                      <p className="text-[#303629]">Segment: <strong className="text-[#1A1D16]">{d.segment}</strong></p>
                      <p className="text-[#303629]">{sampleCoord.xName}: <strong className="text-[#1A1D16]">{d.x}</strong></p>
                      <p className="text-[#303629]">{sampleCoord.yName}: <strong className="text-[#059669]">{sampleCoord.yFormat(d.y)}</strong></p>
                    </div>
                  );
                }}
              />
              {segmentNames.map((segName) => {
                const segPoints = scatterPoints.filter((p) => p.segment === segName);
                const colorConfig = {
                  'High-Value Loyal': '#059669',
                  'Offer-Sensitive': '#D97706',
                  'At-Risk Dormant': '#E11D48',
                  'Occasional Buyer': '#0D9488',
                };
                return (
                  <Scatter
                    key={segName}
                    name={segName}
                    data={segPoints}
                    fill={colorConfig[segName] || getSegmentStyle(segName).color}
                    onClick={(entry) => setSelectedCustomer(entry.rawCustomer)}
                    cursor="pointer"
                  />
                );
              })}
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#1A1D16', fontWeight: 'bold' }} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Customer Drawer Modal */}
      {selectedCustomer && (
        <CustomerDrawer
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
