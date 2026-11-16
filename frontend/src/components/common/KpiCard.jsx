import React from 'react';

export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  trendPositive = true,
  variant = 'gold',
  className = '',
  onClick,
}) {
  // Luxury dark palette icon boxes with multi-layer gradients and luminous borders
  const iconVariants = {
    gold: 'bg-gradient-to-br from-[#D5B66E]/25 via-[#303629]/40 to-[#10120F] text-[#D5B66E] border-[#D5B66E]/40 shadow-[0_0_15px_rgba(213,182,110,0.2)]',
    emerald: 'bg-gradient-to-br from-[#A5B86A]/25 via-[#303629]/40 to-[#10120F] text-[#A5B86A] border-[#A5B86A]/40 shadow-[0_0_15px_rgba(165,184,106,0.2)]',
    blue: 'bg-gradient-to-br from-[#A5B86A]/25 via-[#303629]/40 to-[#10120F] text-[#A5B86A] border-[#A5B86A]/40 shadow-[0_0_15px_rgba(165,184,106,0.2)]',
    amber: 'bg-gradient-to-br from-[#D5B66E]/25 via-[#303629]/40 to-[#10120F] text-[#D5B66E] border-[#D5B66E]/40 shadow-[0_0_15px_rgba(213,182,110,0.2)]',
    indigo: 'bg-gradient-to-br from-[#81966B]/25 via-[#303629]/40 to-[#10120F] text-[#A5B86A] border-[#81966B]/40 shadow-[0_0_15px_rgba(129,150,107,0.2)]',
    rose: 'bg-gradient-to-br from-[#E8785A]/25 via-[#411916]/40 to-[#10120F] text-[#FFA085] border-[#E8785A]/40 shadow-[0_0_15px_rgba(232,120,90,0.25)]',
    coral: 'bg-gradient-to-br from-[#E8785A]/25 via-[#411916]/40 to-[#10120F] text-[#FFA085] border-[#E8785A]/40 shadow-[0_0_15px_rgba(232,120,90,0.25)]',
    slate: 'bg-gradient-to-br from-[#A18A52]/20 via-[#22251F]/60 to-[#10120F] text-[#EAE7DB] border-[#A18A52]/30',
  };

  // Illuminated top accent strip
  const topBorderAccents = {
    gold: 'border-t-2 border-t-[#D5B66E]/70',
    emerald: 'border-t-2 border-t-[#A5B86A]/70',
    blue: 'border-t-2 border-t-[#A5B86A]/70',
    amber: 'border-t-2 border-t-[#D5B66E]/70',
    indigo: 'border-t-2 border-t-[#81966B]/70',
    rose: 'border-t-2 border-t-[#E8785A]/80 bg-gradient-to-b from-[#3a1815]/30 to-transparent',
    coral: 'border-t-2 border-t-[#E8785A]/80 bg-gradient-to-b from-[#3a1815]/30 to-transparent',
    slate: 'border-t-2 border-t-[#A18A52]/40',
  };

  // Metric value colors
  const valueColor = variant === 'rose' || variant === 'coral' 
    ? 'text-[#FFA085] drop-shadow-[0_0_12px_rgba(232,120,90,0.3)]' 
    : 'text-[#FFF1C5] drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]';

  const isAlert = variant === 'rose' || variant === 'coral';
  const cardSurfaceClass = isAlert ? 'glass-card-kpi-alert' : 'glass-card-kpi';

  return (
    <div
      onClick={onClick}
      className={`${cardSurfaceClass} rounded-2xl p-5 relative overflow-hidden group ${
        topBorderAccents[variant] || topBorderAccents.gold
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* Specular sheen reflection gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-black/30 pointer-events-none" />

      <div className="flex items-start justify-between relative z-10">
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-[#A18A52] uppercase tracking-wider">
            {title}
          </p>
          <div className={`text-2xl sm:text-3xl font-black tracking-tight ${valueColor}`}>
            {value}
          </div>
        </div>
        {Icon && (
          <div
            className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${
              iconVariants[variant] || iconVariants.gold
            }`}
          >
            <Icon className="w-5 h-5 stroke-[2.3]" />
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-4 pt-3 border-t border-[#A18A52]/15 flex items-center justify-between text-xs text-[#EAE7DB]/60 relative z-10">
          {trend ? (
            <div className="flex items-center gap-1.5 font-medium">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border shadow-xs ${
                  trendPositive
                    ? 'bg-[#A5B86A]/15 text-[#D4E897] border-[#A5B86A]/35 shadow-[0_0_8px_rgba(165,184,106,0.15)]'
                    : 'bg-[#E8785A]/15 text-[#FFA085] border-[#E8785A]/40 shadow-[0_0_8px_rgba(232,120,90,0.2)]'
                }`}
              >
                {trend}
              </span>
              <span className={`text-[11px] font-semibold ${
                variant === 'rose' || variant === 'coral' ? 'text-[#FFA085]' : 'text-[#EAE7DB]/60'
              }`}>
                {trendLabel}
              </span>
            </div>
          ) : (
            <span className="font-medium text-[#EAE7DB]/70">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
