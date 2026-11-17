import React from 'react';
import { getSegmentStyle } from '../../utils/theme';

export function SegmentBadge({ segmentName, className = '' }) {
  const style = getSegmentStyle(segmentName);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-xs ${style.badgeClass} ${className}`}
      style={{
        boxShadow: `0 0 10px ${style.lightColor}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 shadow-xs"
        style={{ 
          backgroundColor: style.color,
          boxShadow: `0 0 6px ${style.color}`,
        }}
      />
      {style.name}
    </span>
  );
}

export function ScoreBadge({ score, label, className = '' }) {
  const num = Number(score);
  let colorClass = 'bg-[#E8785A]/15 text-[#FFA085] border-[#E8785A]/35';
  let glowColor = 'rgba(232, 120, 90, 0.15)';

  if (num >= 75) {
    colorClass = 'bg-[#A5B86A]/15 text-[#D4E897] border-[#A5B86A]/35';
    glowColor = 'rgba(165, 184, 106, 0.15)';
  } else if (num >= 50) {
    colorClass = 'bg-[#D5B66E]/15 text-[#FFF1C5] border-[#D5B66E]/35';
    glowColor = 'rgba(213, 182, 110, 0.15)';
  } else if (num >= 25) {
    colorClass = 'bg-[#B99A55]/15 text-[#EAE7DB] border-[#B99A55]/35';
    glowColor = 'rgba(185, 154, 85, 0.12)';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border backdrop-blur-xs ${colorClass} ${className}`}
      style={{ boxShadow: `0 0 8px ${glowColor}` }}
    >
      {label && <span className="opacity-75">{label}:</span>}
      <span className="font-bold font-mono">{num.toFixed(1)}</span>
    </span>
  );
}

export function MetricBadge({ children, variant = 'slate', className = '' }) {
  const variants = {
    slate: 'bg-[#22251F] text-[#EAE7DB] border-[#A18A52]/25',
    blue: 'bg-[#303629]/60 text-[#D4E897] border-[#A5B86A]/35 shadow-[0_0_8px_rgba(165,184,106,0.15)]',
    emerald: 'bg-[#303629]/60 text-[#D4E897] border-[#A5B86A]/35 shadow-[0_0_8px_rgba(165,184,106,0.15)]',
    amber: 'bg-[#2a251b]/70 text-[#FFF1C5] border-[#D5B66E]/35 shadow-[0_0_8px_rgba(213,182,110,0.15)]',
    rose: 'bg-[#3a1815]/70 text-[#FFA085] border-[#E8785A]/40 shadow-[0_0_8px_rgba(232,120,90,0.2)]',
    indigo: 'bg-[#262c20]/70 text-[#A2B989] border-[#81966B]/35 shadow-[0_0_8px_rgba(129,150,107,0.15)]',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
        variants[variant] || variants.slate
      } ${className}`}
    >
      {children}
    </span>
  );
}
