/**
 * Shared utility functions for safe, null-safe numeric formatting.
 * Prevents runtime rendering crashes when backend fields return null/undefined/NaN.
 */

export const formatNumber = (
  val: number | null | undefined,
  decimals: number = 2,
  fallback: string = '--'
): string => {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return val.toFixed(decimals);
};

export const formatPrice = (
  val: number | null | undefined,
  fallback: string = '--'
): string => {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return '₹' + val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatPercentage = (
  val: number | null | undefined,
  decimals: number = 2,
  fallback: string = '--'
): string => {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return val.toFixed(decimals) + '%';
};

export const formatScore = (
  val: number | null | undefined,
  fallback: string = '--'
): string => {
  if (val === null || val === undefined || isNaN(val)) {
    return fallback;
  }
  return val.toFixed(0);
};
