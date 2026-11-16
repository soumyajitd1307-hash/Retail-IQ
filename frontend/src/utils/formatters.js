/**
 * Utility formatters for Retail IQ Analytics
 * Adheres to generic currency configuration and standard number presentation.
 */

export function formatCurrency(value, currency = '$') {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const num = Number(value);
  return `${currency}${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactCurrency(value, currency = '$') {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const num = Number(value);
  if (num >= 1000000) {
    return `${currency}${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${currency}${(num / 1000).toFixed(1)}k`;
  }
  return `${currency}${num.toFixed(0)}`;
}

export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const num = Number(value);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const num = Number(value);
  return `${num.toFixed(decimals)}%`;
}

export function formatDays(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const num = Math.round(Number(value));
  return `${num} ${num === 1 ? 'day' : 'days'}`;
}

export function formatScore(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return Number(value).toFixed(1);
}
