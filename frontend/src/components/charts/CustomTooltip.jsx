import React from 'react';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export default function CustomTooltip({ active, payload, label, isCurrency = false, unit = '' }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gradient-to-br from-[#242921] to-[#151713] border border-[#A18A52]/40 rounded-xl p-3 shadow-[0_8px_28px_rgba(0,0,0,0.7)] text-xs z-50 min-w-40 relative backdrop-blur-md">
      {/* Specular top highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#D5B66E]/50 to-transparent pointer-events-none" />

      {label && (
        <p className="font-bold text-[#FFF3D1] pb-1.5 mb-2 border-b border-[#A18A52]/20 tracking-wide">
          {label}
        </p>
      )}

      <div className="space-y-1.5">
        {payload.map((entry, index) => {
          const val = entry.value;
          const displayVal = isCurrency
            ? formatCurrency(val)
            : `${formatNumber(val)}${unit ? ' ' + unit : ''}`;

          return (
            <div key={`tooltip-item-${index}`} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-[#EAE7DB]/75 font-medium">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ 
                    backgroundColor: entry.color || entry.fill,
                    boxShadow: `0 0 6px ${entry.color || entry.fill}`,
                  }}
                />
                {entry.name || 'Value'}:
              </span>
              <span className="font-bold font-mono text-[#FFF1C5]">{displayVal}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
