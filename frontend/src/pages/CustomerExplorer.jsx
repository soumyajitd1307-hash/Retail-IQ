import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User,
  Eye,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import dataService from '../services/dataService';
import { SegmentBadge, ScoreBadge } from '../components/common/Badge';
import CustomerDrawer from '../components/common/CustomerDrawer';
import {
  formatCurrency,
  formatDays,
} from '../utils/formatters';
import { SEGMENTS } from '../utils/theme';

export default function CustomerExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const segmentFromUrl = searchParams.get('segment') || 'All';

  // Filters & Sorting state
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState(segmentFromUrl);
  const [spendRange, setSpendRange] = useState('all');
  const [recencyRange, setRecencyRange] = useState('all');
  const [sortBy, setSortBy] = useState('monetary');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data state
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    let active = true;
    dataService.getCustomers({
      search,
      segment,
      spendRange,
      recencyRange,
      sortBy,
      sortOrder,
      page,
      pageSize,
    }).then((res) => {
      if (active) {
        setCustomers(res.customers);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [search, segment, spendRange, recencyRange, sortBy, sortOrder, page, pageSize]);

  // Handle URL sync
  useEffect(() => {
    const urlSeg = searchParams.get('segment');
    if (urlSeg && urlSeg !== segment) {
      setSegment(urlSeg);
      setPage(1);
    }
  }, [searchParams]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSegment('All');
    setSpendRange('all');
    setRecencyRange('all');
    setSortBy('monetary');
    setSortOrder('desc');
    setPage(1);
    setSearchParams({});
  };

  const handleExport = async () => {
    const all = await dataService.getAllCustomers();
    // Filter matching current state
    const filtered = all.filter((c) => {
      if (segment !== 'All' && c.segment_name !== segment) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesId = c.customer_id.toLowerCase().includes(q);
        const matchesSeg = c.segment_name.toLowerCase().includes(q);
        const matchesRec = (c.primary_recommendation || '').toLowerCase().includes(q);
        if (!matchesId && !matchesSeg && !matchesRec) return false;
      }
      return true;
    });
    dataService.exportToCsv(filtered, `retail_iq_customers_${segment.toLowerCase().replace(/ /g, '_')}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Header and Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#A18A52]/20">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#EAE7DB] tracking-tight">
            Customer Directory & <span className="text-gradient-gold">Segment Explorer</span>
          </h2>
          <p className="text-xs text-[#EAE7DB]/60 mt-0.5">
            Search, filter, and drill into individual customer records with explainable ML prescriptions.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold btn-olive self-start sm:self-auto cursor-pointer shadow-md"
        >
          <Download className="w-4 h-4 text-[#D5B66E]" />
          <span>Export ({total} records)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel-table rounded-2xl p-4 sm:p-5 shadow-md space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-[#A18A52] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Customer ID (e.g. C0012) or prescription..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-3.5 py-2 bg-[#171a13] border border-[#A18A52]/30 rounded-xl text-xs text-[#EAE7DB] placeholder:text-[#EAE7DB]/40 focus:outline-none focus:ring-2 focus:ring-[#D5B66E]/50 focus:border-[#D5B66E] transition-all"
            />
          </div>

          {/* Segment Filter */}
          <div>
            <select
              value={segment}
              onChange={(e) => {
                setSegment(e.target.value);
                setSearchParams(e.target.value === 'All' ? {} : { segment: e.target.value });
                setPage(1);
              }}
              className="w-full px-3.5 py-2 bg-[#171a13] border border-[#A18A52]/30 rounded-xl text-xs text-[#EAE7DB] font-semibold focus:outline-none focus:ring-2 focus:ring-[#D5B66E]/50"
            >
              <option value="All">All Segments (4)</option>
              {Object.keys(SEGMENTS).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Spend Tier Filter */}
          <div>
            <select
              value={spendRange}
              onChange={(e) => {
                setSpendRange(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2 bg-[#171a13] border border-[#A18A52]/30 rounded-xl text-xs text-[#EAE7DB] font-semibold focus:outline-none focus:ring-2 focus:ring-[#D5B66E]/50"
            >
              <option value="all">Spend: All Tiers</option>
              <option value="high">High Spend (&gt; $30,000)</option>
              <option value="medium">Mid Spend ($10k - $30k)</option>
              <option value="low">Entry Spend (&lt; $10,000)</option>
            </select>
          </div>

          {/* Recency Range Filter */}
          <div>
            <select
              value={recencyRange}
              onChange={(e) => {
                setRecencyRange(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2 bg-[#171a13] border border-[#A18A52]/30 rounded-xl text-xs text-[#EAE7DB] font-semibold focus:outline-none focus:ring-2 focus:ring-[#D5B66E]/50"
            >
              <option value="all">Recency: All Cadences</option>
              <option value="active">Active (&le; 30 days)</option>
              <option value="warm">Warm (31 - 60 days)</option>
              <option value="cooling">Cooling (61 - 90 days)</option>
              <option value="dormant">Dormant (&gt; 90 days)</option>
            </select>
          </div>
        </div>

        {/* Active Filters Summary & Reset */}
        {(search || segment !== 'All' || spendRange !== 'all' || recencyRange !== 'all') && (
          <div className="pt-2 flex items-center justify-between text-xs text-[#EAE7DB]/60 border-t border-[#A18A52]/15">
            <span>
              Showing <strong className="text-[#FFF1C5]">{total}</strong> matching customers
            </span>
            <button
              onClick={handleResetFilters}
              className="text-[#D5B66E] hover:text-[#FFF1C5] font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Critical Highlighted Tagline Banner */}
      <div className="p-3.5 rounded-2xl surface-alert border border-[#E8785A]/40 text-xs flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E8785A] animate-ping shrink-0" />
          <span className="text-[#FFA085] font-black tracking-wide uppercase">
            ★ CRITICAL RETENTION DIRECTIVE: RED ROWS REPRESENT 40 AT-RISK DORMANT ACCOUNTS (&gt;90d INACTIVE) — PRIORITIZE EXECUTIVE WIN-BACK!
          </span>
        </div>
        <span className="text-[11px] font-black text-[#FFA085] font-mono hidden md:inline shrink-0">
          $852k AT RISK
        </span>
      </div>

      {/* Segment Color Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-[#EAE7DB]/70">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-[#A18A52]">Row Coding:</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#059669]/20 text-[#A5B86A] font-bold border border-[#059669]/40">
            <span className="w-2 h-2 rounded-full bg-[#059669]" />
            Loyal Buyers (Emerald)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#D97706]/20 text-[#D5B66E] font-bold border border-[#D97706]/40">
            <span className="w-2 h-2 rounded-full bg-[#D97706]" />
            Offer-Sensitive (Amber)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#E11D48]/20 text-[#FFA085] font-bold border border-[#E11D48]/40">
            <span className="w-2 h-2 rounded-full bg-[#E11D48]" />
            At-Risk Dormant (Ruby Coral)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#22251F] text-[#81966B] font-medium border border-[#A18A52]/20">
            <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
            Occasional Buyers (Sage Teal)
          </span>
        </div>
        <span className="text-[11px] text-[#A18A52] italic font-medium">
          Click any customer row to inspect dimensional drill-down
        </span>
      </div>

      {/* Customers Data Table */}
      <div className="glass-panel-table rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto pb-2">
          <table className="w-full text-left text-xs border-separate border-spacing-y-2 px-3">
            <thead className="text-[#A18A52] font-extrabold uppercase tracking-wider select-none bg-[#10120F]/40 backdrop-blur-xs">
              <tr>
                <th
                  onClick={() => handleSort('customer_id')}
                  className="py-3 px-4 cursor-pointer hover:text-[#FFF1C5] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Customer ID
                    {sortBy === 'customer_id' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D5B66E]" /> : <ArrowDown className="w-3 h-3 text-[#D5B66E]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-[#A18A52]/60" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-3">Segment</th>
                <th
                  onClick={() => handleSort('loyalty_score')}
                  className="py-3 px-3 cursor-pointer hover:text-[#FFF1C5] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Loyalty Score
                    {sortBy === 'loyalty_score' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D5B66E]" /> : <ArrowDown className="w-3 h-3 text-[#D5B66E]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-[#A18A52]/60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('monetary')}
                  className="py-3 px-3 cursor-pointer hover:text-[#FFF1C5] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Total Spend
                    {sortBy === 'monetary' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D5B66E]" /> : <ArrowDown className="w-3 h-3 text-[#D5B66E]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-[#A18A52]/60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('frequency')}
                  className="py-3 px-3 cursor-pointer hover:text-[#FFF1C5] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Orders
                    {sortBy === 'frequency' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D5B66E]" /> : <ArrowDown className="w-3 h-3 text-[#D5B66E]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-[#A18A52]/60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('recency_days')}
                  className="py-3 px-3 cursor-pointer hover:text-[#FFF1C5] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Recency
                    {sortBy === 'recency_days' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D5B66E]" /> : <ArrowDown className="w-3 h-3 text-[#D5B66E]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-[#A18A52]/60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('offer_sensitivity_score')}
                  className="py-3 px-3 cursor-pointer hover:text-[#FFF1C5] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Offer Sensitivity
                    {sortBy === 'offer_sensitivity_score' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#D5B66E]" /> : <ArrowDown className="w-3 h-3 text-[#D5B66E]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-[#A18A52]/60" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-3">Primary Action</th>
                <th className="py-3 px-4 text-right">Profile</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#EAE7DB]/50">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#D5B66E] border-t-transparent rounded-full animate-spin" />
                      Loading customers...
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#EAE7DB]/50">
                    No customers match your filter criteria.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  let rowColorClass = 'bg-[#181d15]/50 backdrop-blur-xs text-[#EAE7DB] border-[#A18A52]/20 hover:bg-[#222a1e]/65 hover:border-[#A18A52]/50 hover:shadow-[0_0_15px_rgba(161,138,82,0.18)]';
                  let userIconBg = 'bg-[#22291e] text-[#A5B86A]';

                  if (c.segment_name === 'High-Value Loyal') {
                    // Attractive translucent emerald/green tint with luminous border
                    rowColorClass = 'bg-gradient-to-r from-[#059669]/22 via-[#059669]/14 to-[#10B981]/08 backdrop-blur-xs text-[#EAE7DB] border-[#059669]/40 hover:from-[#059669]/35 hover:to-[#10B981]/22 hover:border-[#10B981] hover:shadow-[0_0_18px_rgba(5,150,105,0.3)]';
                    userIconBg = 'bg-[#059669]/30 text-[#34D399]';
                  } else if (c.segment_name === 'Offer-Sensitive') {
                    // Distinctive translucent amber tint with warm golden hover glow
                    rowColorClass = 'bg-gradient-to-r from-[#D97706]/20 via-[#D97706]/14 to-[#F59E0B]/08 backdrop-blur-xs text-[#EAE7DB] border-[#D97706]/40 hover:from-[#D97706]/32 hover:to-[#F59E0B]/20 hover:border-[#FBBF24] hover:shadow-[0_0_18px_rgba(217,119,6,0.3)]';
                    userIconBg = 'bg-[#D97706]/30 text-[#FBBF24]';
                  } else if (c.segment_name === 'At-Risk Dormant') {
                    // Distinctive translucent red/coral tint with glowing alert border on hover
                    rowColorClass = 'bg-gradient-to-r from-[#E11D48]/24 via-[#BE123C]/16 to-[#9F1239]/08 backdrop-blur-xs text-[#FFA085] border-[#E11D48]/45 hover:from-[#E11D48]/36 hover:to-[#BE123C]/24 hover:border-[#FB7185] hover:shadow-[0_0_20px_rgba(225,29,72,0.35)]';
                    userIconBg = 'bg-[#E11D48]/30 text-[#FB7185]';
                  }

                  return (
                    <tr
                      key={c.customer_id}
                      onClick={() => setSelectedCustomer(c)}
                      className={`cursor-pointer transition-all duration-200 ease-out transform hover:scale-[1.01] hover:-translate-y-0.5 relative group rounded-xl ${rowColorClass}`}
                    >
                      <td className="py-3 px-4 font-mono font-bold first:rounded-l-xl border-y border-l border-current/25">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center font-sans text-xs transition-transform group-hover:scale-110 ${userIconBg}`}>
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-extrabold text-[#FFF1C5]">{c.customer_id}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 border-y border-current/25">
                        <SegmentBadge segmentName={c.segment_name} />
                      </td>
                      <td className="py-3 px-3 border-y border-current/25">
                        <ScoreBadge score={c.loyalty_score} />
                      </td>
                      <td className="py-3 px-3 font-extrabold font-mono text-[#D5B66E] border-y border-current/25">
                        {formatCurrency(c.monetary)}
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold border-y border-current/25">
                        {c.frequency} <span className="opacity-70 text-[11px] font-normal">orders</span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold border-y border-current/25">
                        {formatDays(c.recency_days)}
                      </td>
                      <td className="py-3 px-3 border-y border-current/25">
                        <ScoreBadge score={c.offer_sensitivity_score} />
                      </td>
                      <td
                        className="py-3 px-3 max-w-xs truncate opacity-85 text-[11px] font-medium border-y border-current/25"
                        title={c.primary_recommendation}
                      >
                        {c.primary_recommendation}
                      </td>
                      <td className="py-3 px-4 text-right last:rounded-r-xl border-y border-r border-current/25">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(c);
                          }}
                          className="p-1.5 rounded-lg text-[#D5B66E] opacity-75 group-hover:opacity-100 group-hover:scale-125 transition-all"
                          title="View detailed customer profile"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Page Size Footer */}
        <div className="p-4 border-t border-[#A18A52]/20 bg-[#141611] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#EAE7DB]/70">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 bg-[#1e221a] border border-[#A18A52]/30 rounded-lg text-xs font-bold text-[#EAE7DB] focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-[#A18A52] ml-2">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total records)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-[#A18A52]/30 text-[#EAE7DB] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#303629]/50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-mono font-bold text-[#D5B66E]">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-[#A18A52]/30 text-[#EAE7DB] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#303629]/50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Customer Detail Drawer Modal */}
      {selectedCustomer && (
        <CustomerDrawer
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}
