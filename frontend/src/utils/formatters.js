/**
 * Utility formatters for Retail IQ Analytics
 * Adheres to generic currency configuration and standard number presentation.
 *
 * Currency is configured once from backend model metadata (scoring_config.currency).
 * An empty/unspecified value means currency-neutral: numbers are formatted without
 * a currency symbol rather than falsely assuming USD.
 */

let activeCurrency = '';

export function configureCurrency(currency) {
  activeCurrency = typeof currency === 'string' ? currency : '';
}

export function getCurrencyPrefix() {
  return activeCurrency;
}

export function formatCurrency(value, currency = activeCurrency) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const num = Number(value);
  const prefix = typeof currency === 'string' ? currency : '';
  return `${prefix}${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactCurrency(value, currency = activeCurrency) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  const num = Number(value);
  const prefix = typeof currency === 'string' ? currency : '';
  if (num >= 1000000) {
    return `${prefix}${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${prefix}${(num / 1000).toFixed(1)}k`;
  }
  return `${prefix}${num.toFixed(0)}`;
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
