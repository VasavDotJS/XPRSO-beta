/**
 * Pure helper for Indian GST financial year and invoice serial number formatting.
 */

/**
 * Returns Indian Financial Year short string, e.g. "26-27" for Oct 2026.
 * Indian FY runs from April 1 to March 31.
 */
export function getFinancialYearShort(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: 0 = Jan, 3 = April

  let startYear: number;
  let endYear: number;

  if (month >= 3) {
    // April through December
    startYear = year;
    endYear = year + 1;
  } else {
    // January through March
    startYear = year - 1;
    endYear = year;
  }

  const startShort = String(startYear).slice(-2);
  const endShort = String(endYear).slice(-2);
  return `${startShort}-${endShort}`;
}

/**
 * Formats a consecutive invoice number.
 * e.g. prefix="ORD", fy="26-27", sequenceNumber=1 -> "ORD/26-27/000001"
 * Invariant: Max 16 characters for Indian GST compliance.
 */
export function formatInvoiceNumber(
  prefix: string,
  fy: string,
  sequenceNumber: number | bigint
): string {
  const safePrefix = prefix.slice(0, 3).toUpperCase();
  const padded = String(sequenceNumber).padStart(6, '0');
  const invoiceNo = `${safePrefix}/${fy}/${padded}`;
  return invoiceNo;
}
