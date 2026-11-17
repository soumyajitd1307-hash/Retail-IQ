import React from 'react';

export default function ScoreGauge({
  score,
  label = 'Score',
  max = 100,
  size = 'md',
  showValue = true,
  className = '',
}) {
  const num = Math.min(Math.max(Number(score) || 0, 0), max);
  const percentage = (num / max) * 100;

  let color = 'bg-gradient-to-r from-[#C8563A] to-[#E8785A]';
  let textColor = 'text-[#FFA085]';
  let glowColor = 'rgba(232, 120, 90, 0.3)';

  if (percentage >= 75) {
    color = 'bg-gradient-to-r from-[#81966B] via-[#A5B86A] to-[#D4E897]';
    textColor = 'text-[#D4E897]';
    glowColor = 'rgba(165, 184, 106, 0.3)';
  } else if (percentage >= 50) {
    color = 'bg-gradient-to-r from-[#B99A55] to-[#D5B66E]';
    textColor = 'text-[#FFF1C5]';
    glowColor = 'rgba(213, 182, 110, 0.3)';
  } else if (percentage >= 25) {
    color = 'bg-gradient-to-r from-[#8A723D] to-[#B99A55]';
    textColor = 'text-[#EAE7DB]';
    glowColor = 'rgba(185, 154, 85, 0.2)';
  }

  const heightClass = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold text-[#A18A52]">{label}</span>
        {showValue && (
          <span className={`font-bold font-mono ${textColor}`}>
            {num.toFixed(1)} <span className="text-[#EAE7DB]/40 font-normal">/ {max}</span>
          </span>
        )}
      </div>
      <div className={`w-full bg-[#171914] rounded-full overflow-hidden border border-[#A18A52]/20 p-0.5 shadow-inner ${heightClass}`}>
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ 
            width: `${percentage}%`,
            boxShadow: `0 0 10px ${glowColor}`,
          }}
        />
      </div>
    </div>
  );
}
