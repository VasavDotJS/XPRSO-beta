/**
 * Domain module for Money operations.
 * Pure functions only — no framework or DB dependencies.
 * Rule: Money is NEVER a float. All amounts are integer paise (₹1 = 100 paise).
 */

export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const cleaned = rupees.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number | bigint): number {
  return Number(paise) / 100;
}

/**
 * Format paise into INR currency string with Indian digit grouping (e.g., ₹1,23,456.50).
 */
export function formatINR(paise: number | bigint, options: { showDecimals?: boolean } = {}): string {
  const amount = Number(paise) / 100;
  const hasDecimals = (Number(paise) % 100) !== 0;
  const showDecimals = options.showDecimals ?? hasDecimals;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format basis points into human readable percentage string.
 * e.g., 500 -> "5%", 250 -> "2.5%", 725 -> "7.25%", 1800 -> "18%"
 */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  // Trim trailing zeroes
  return `${parseFloat(pct.toFixed(2))}%`;
}
