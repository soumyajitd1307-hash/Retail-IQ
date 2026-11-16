import React from 'react';
import {
  X,
  User,
  ShoppingBag,
  Clock,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { SegmentBadge } from './Badge';
import ScoreGauge from './ScoreGauge';
import {
  formatCurrency,
  formatDays,
  formatNumber,
  formatPercent,
} from '../../utils/formatters';
import { getSegmentStyle } from '../../utils/theme';

export default function CustomerDrawer({ customer, onClose }) {
  if (!customer) return null;

  const segmentStyle = getSegmentStyle(customer.segment_name);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-gradient-to-b from-[#1b1e17] via-[#161813] to-[#121410] shadow-[0_0_50px_rgba(0,0,0,0.9)] border-l border-[#A18A52]/30 flex flex-col animate-in slide-in-from-right duration-300 relative">
          {/* Specular border strip on left edge */}
          <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-[#D5B66E]/40 via-[#A5B86A]/25 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="p-5 border-b border-[#A18A52]/20 bg-gradient-to-r from-[#242921]/90 to-[#191c15]/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-md ring-1 ring-[#D5B66E]/30"
                style={{
                  backgroundColor: segmentStyle.lightColor,
                  color: segmentStyle.color,
                }}
              >
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-[#EAE7DB]">
                    {customer.customer_id}
                  </h2>
                  <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-[#22251F] text-[#D5B66E] border border-[#A18A52]/25">
                    Cluster {customer.cluster_id}
                  </span>
                </div>
                <div className="mt-1">
                  <SegmentBadge segmentName={customer.segment_name} />
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#EAE7DB]/60 hover:text-[#FFF3D1] hover:bg-[#303629]/50 border border-transparent hover:border-[#A18A52]/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Prescriptive Recommendation */}
            <div className="p-4 rounded-xl surface-olive relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2 text-[#D5B66E] font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-[#D5B66E]" />
                Primary Recommendation
              </div>
              <p className="text-xs text-[#EAE7DB] font-medium leading-relaxed">
                {customer.primary_recommendation ||
                  'Maintain regular engagement and track purchase intervals.'}
              </p>
            </div>

            {/* Behavioral Scores */}
            <div className="glossy-card rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-[#A18A52] uppercase tracking-wider">
                Behavioral Scores (0 - 100)
              </h3>
              <div>
                <ScoreGauge
                  score={customer.loyalty_score}
                  label="RFM Loyalty Score"
                  size="md"
                />
                <p className="text-[11px] text-[#EAE7DB]/50 mt-1">
                  Composite of recency, frequency & monetary spend calibrated against cohort distribution.
                </p>
              </div>

              <div className="pt-3 border-t border-[#A18A52]/15">
                <ScoreGauge
                  score={customer.offer_sensitivity_score}
                  label="Offer Sensitivity Score"
                  size="md"
                />
                <p className="text-[11px] text-[#EAE7DB]/50 mt-1">
                  Promotional dependency & discount depth weighting (0 = full price buyer).
                </p>
              </div>
            </div>

            {/* RFM Core Metrics */}
            <div>
              <h3 className="text-xs font-bold text-[#A18A52] uppercase tracking-wider mb-3">
                RFM Dimensions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#1e221a] rounded-xl border border-[#A18A52]/20 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs text-[#A18A52] mb-1 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    Recency
                  </div>
                  <div className="text-lg font-black text-[#EAE7DB]">
                    {formatDays(customer.recency_days)}
                  </div>
                  <span className="text-[11px] text-[#EAE7DB]/45">Since last order</span>
                </div>

                <div className="p-3 bg-[#1e221a] rounded-xl border border-[#A18A52]/20 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs text-[#A18A52] mb-1 font-semibold">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Frequency
                  </div>
                  <div className="text-lg font-black text-[#EAE7DB]">
                    {formatNumber(customer.frequency)} orders
                  </div>
                  <span className="text-[11px] text-[#EAE7DB]/45">Total orders</span>
                </div>

                <div className="p-3 bg-[#1e221a] rounded-xl border border-[#A18A52]/20 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs text-[#A18A52] mb-1 font-semibold">
                    <DollarSign className="w-3.5 h-3.5" />
                    Total Monetary
                  </div>
                  <div className="text-lg font-black text-[#FFF1C5]">
                    {formatCurrency(customer.monetary)}
                  </div>
                  <span className="text-[11px] text-[#EAE7DB]/45">Lifetime spend</span>
                </div>

                <div className="p-3 bg-[#1e221a] rounded-xl border border-[#A18A52]/20 shadow-xs">
                  <div className="flex items-center gap-1.5 text-xs text-[#A18A52] mb-1 font-semibold">
                    <DollarSign className="w-3.5 h-3.5" />
                    Avg Order Value
                  </div>
                  <div className="text-lg font-black text-[#FFF1C5]">
                    {formatCurrency(customer.avg_order_value)}
                  </div>
                  <span className="text-[11px] text-[#EAE7DB]/45">Per purchase</span>
                </div>
              </div>
            </div>

            {/* Additional Behavioral Signals */}
            <div>
              <h3 className="text-xs font-bold text-[#A18A52] uppercase tracking-wider mb-3">
                Behavioral Breakdown
              </h3>
              <div className="glossy-card rounded-xl divide-y divide-[#A18A52]/15 text-xs">
                <div className="p-3 flex items-center justify-between">
                  <span className="text-[#EAE7DB]/70 font-medium">Offer Dependency</span>
                  <span className="font-bold text-[#D5B66E] font-mono">
                    {formatPercent(customer.offer_dependency * 100)} of orders
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-[#EAE7DB]/70 font-medium">Avg Discount Depth</span>
                  <span className="font-bold text-[#D5B66E] font-mono">
                    {formatPercent(customer.avg_discount_pct)}
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-[#EAE7DB]/70 font-medium">Spend Trend (P1 → P2)</span>
                  <span
                    className={`font-bold font-mono inline-flex items-center gap-1 ${
                      customer.spend_trend > 0
                        ? 'text-[#A5B86A]'
                        : customer.spend_trend < 0
                        ? 'text-[#FFA085]'
                        : 'text-[#EAE7DB]/60'
                    }`}
                  >
                    {customer.spend_trend > 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {customer.spend_trend !== null
                      ? `${customer.spend_trend.toFixed(1)}%`
                      : 'N/A (Joined P2)'}
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-[#EAE7DB]/70 font-medium">Category Diversity</span>
                  <span className="font-bold text-[#EAE7DB] font-mono">
                    {customer.category_diversity} categories
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-[#EAE7DB]/70 font-medium">Repeat Purchase Rate</span>
                  <span className="font-bold text-[#EAE7DB] font-mono">
                    {formatPercent(customer.repeat_rate * 100)}
                  </span>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-[#EAE7DB]/70 font-medium">Promo Lift vs Base</span>
                  <span className="font-bold text-[#EAE7DB] font-mono">
                    {customer.promo_lift !== null
                      ? `${customer.promo_lift > 0 ? '+' : ''}${customer.promo_lift.toFixed(1)}%`
                      : 'N/A (Single promo tier)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-[#141611] border-t border-[#A18A52]/20 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold btn-olive rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
