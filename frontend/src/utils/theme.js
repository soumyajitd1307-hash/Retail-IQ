/**
 * Retail IQ Visual Theme & Segment Mapping System
 * Dark Olive & Gold Luxury Theme
 * Color consistency across badges, charts, cards, and tables.
 */

export const COLORS = {
  obsidian: '#10120F',
  graphite: '#20241F',
  deepOlive: '#263326',
  emerald: '#176B45',
  radiantGreen: '#28A66A',
  luminousOlive: '#7DAB65',
  brass: '#A18A52',
  ivory: '#EAE7DB',
  champagne: '#C6AD70',
  metallicGold: '#B99A55',
  sage: '#81966B',
  warmCoral: '#E8785A',
};

export const CHART_COLORS = [
  '#D5B66E', // Champagne Gold
  '#A5B86A', // Luminous Olive
  '#B99A55', // Metallic Gold
  '#81966B', // Sage Green
  '#A18A52', // Antique Brass
  '#E8785A', // Warm Coral
];

export const SEGMENTS = {
  'High-Value Loyal': {
    name: 'High-Value Loyal',
    clusterId: 0,
    color: '#A5B86A', // Luminous Olive
    lightColor: 'rgba(165, 184, 106, 0.12)',
    borderColor: 'rgba(165, 184, 106, 0.35)',
    textColor: '#A5B86A',
    badgeClass: 'bg-[#A5B86A]/15 text-[#A5B86A] border-[#A5B86A]/30',
    barColor: '#A5B86A',
    glowColor: 'rgba(165, 184, 106, 0.25)',
    description: 'Frequent high-spend customers with minimal discounting. Core revenue anchor.',
  },
  'At-Risk Dormant': {
    name: 'At-Risk Dormant',
    clusterId: 2,
    color: '#E8785A', // Warm Coral
    lightColor: 'rgba(232, 120, 90, 0.12)',
    borderColor: 'rgba(232, 120, 90, 0.35)',
    textColor: '#E8785A',
    badgeClass: 'bg-[#E8785A]/15 text-[#E8785A] border-[#E8785A]/30',
    barColor: '#E8785A',
    glowColor: 'rgba(232, 120, 90, 0.25)',
    description: 'High historical value but lapsed recency (>90 days) and sharp negative spend trend.',
  },
  'Offer-Sensitive': {
    name: 'Offer-Sensitive',
    clusterId: 3,
    color: '#D5B66E', // Champagne Gold
    lightColor: 'rgba(213, 182, 110, 0.12)',
    borderColor: 'rgba(213, 182, 110, 0.35)',
    textColor: '#D5B66E',
    badgeClass: 'bg-[#D5B66E]/15 text-[#D5B66E] border-[#D5B66E]/30',
    barColor: '#D5B66E',
    glowColor: 'rgba(213, 182, 110, 0.25)',
    description: 'Promotional shoppers with high offer dependency (~79%) and medium frequency.',
  },
  'Occasional Buyer': {
    name: 'Occasional Buyer',
    clusterId: 1,
    color: '#81966B', // Soft Sage
    lightColor: 'rgba(129, 150, 107, 0.12)',
    borderColor: 'rgba(129, 150, 107, 0.35)',
    textColor: '#81966B',
    badgeClass: 'bg-[#81966B]/15 text-[#81966B] border-[#81966B]/30',
    barColor: '#81966B',
    glowColor: 'rgba(129, 150, 107, 0.25)',
    description: 'Infrequent, low-frequency buyers with low total monetary contribution.',
  },
};

export function getSegmentStyle(segmentName) {
  return SEGMENTS[segmentName] || {
    name: segmentName || 'Unknown',
    color: '#A18A52',
    lightColor: 'rgba(161, 138, 82, 0.12)',
    borderColor: 'rgba(161, 138, 82, 0.3)',
    textColor: '#A18A52',
    badgeClass: 'bg-[#A18A52]/15 text-[#A18A52] border-[#A18A52]/30',
    barColor: '#A18A52',
    glowColor: 'rgba(161, 138, 82, 0.2)',
    description: 'Unclassified segment',
  };
}

export function getScoreBadgeColor(score) {
  const val = Number(score);
  if (val >= 75) return 'text-[#A5B86A] bg-[#A5B86A]/15 border-[#A5B86A]/30';
  if (val >= 50) return 'text-[#D5B66E] bg-[#D5B66E]/15 border-[#D5B66E]/30';
  if (val >= 25) return 'text-[#B99A55] bg-[#B99A55]/15 border-[#B99A55]/30';
  return 'text-[#E8785A] bg-[#E8785A]/15 border-[#E8785A]/30';
}
