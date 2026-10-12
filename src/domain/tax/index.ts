/**
 * Pure domain tax engine for order-plat.
 * Shared directly by browser (client instant feedback) and server (source of truth).
 * NEVER import framework or DB modules into this file.
 */

export type TaxMode = 'GST_INTRA' | 'GST_SINGLE_LINE' | 'NONE' | 'COMPOSITION';

export interface TaxConfig {
  tax_mode: TaxMode;
  tax_rate_bps: number; // e.g. 500 = 5.00%
  prices_include_tax: boolean;
  service_charge_enabled: boolean;
  service_charge_bps: number; // e.g. 500 = 5.00%
  round_grand_total: boolean;
}

export interface OrderLineInput {
  id?: string;
  product_id: string;
  product_name?: string;
  category_name?: string;
  unit_price_paise: number;
  unit_cost_paise?: number | null;
  tax_rate_bps_override?: number | null;
  qty: number;
  note?: string;
}

export interface ComputedOrderLine {
  id?: string;
  product_id: string;
  product_name?: string;
  category_name?: string;
  unit_price_paise: number;
  unit_cost_paise: number | null;
  tax_rate_bps: number;
  qty: number;
  note?: string;
  line_amount_paise: number; // unit_price * qty
  line_taxable_paise: number; // allocated taxable value
  line_tax_paise: number; // allocated tax
  line_cost_paise: number | null; // unit_cost * qty
  line_gross_profit_paise: number | null; // line_taxable - line_cost
}

export interface RateGroupSummary {
  rate_bps: number;
  effective_rate_bps: number;
  subtotal_paise: number;
  service_charge_paise: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_or_gst_paise: number;
  total_tax_paise: number;
}

export interface OrderTotals {
  subtotal_paise: number;
  service_charge_paise: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_or_gst_paise: number;
  total_tax_paise: number;
  round_off_paise: number;
  grand_total_paise: number;
  rate_groups: RateGroupSummary[];
  lines: ComputedOrderLine[];
  tax_mode: TaxMode;
  tax_rate_bps: number;
  prices_include_tax: boolean;
  service_charge_bps: number;
}

/**
 * Standard Half-Up rounding for integer arithmetic:
 * Returns round(numerator / denominator) using half-up tie breaking.
 */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round(numerator / denominator);
}

/**
 * Distribute an integer total across items proportionally to weights
 * using the largest-remainder method (Hamilton-Hare) so that the sum of parts
 * equals the total EXACTLY without losing or creating a single paise.
 */
export function allocateLargestRemainder(total: number, weights: number[]): number[] {
  const sumWeights = weights.reduce((acc, w) => acc + w, 0);
  if (sumWeights === 0 || weights.length === 0) {
    return weights.map(() => 0);
  }

  const exactShares = weights.map((w) => (w * total) / sumWeights);
  const baseShares = exactShares.map((s) => Math.floor(s));
  const allocatedBase = baseShares.reduce((acc, b) => acc + b, 0);
  let remainderToDistribute = total - allocatedBase;

  // Track original index and fractional part
  const fractions = exactShares.map((s, idx) => ({
    idx,
    fraction: s - baseShares[idx],
  }));

  // Sort descending by fractional remainder
  fractions.sort((a, b) => b.fraction - a.fraction);

  const result = [...baseShares];
  for (let i = 0; i < remainderToDistribute; i++) {
    const item = fractions[i % fractions.length];
    result[item.idx] += 1;
  }

  return result;
}

/**
 * Primary pure function: computes all totals, taxes, and line breakdowns.
 */
export function computeOrderTotals(
  lines: OrderLineInput[],
  config: TaxConfig
): OrderTotals {
  const {
    tax_mode,
    tax_rate_bps: defaultTaxRateBps,
    prices_include_tax,
    service_charge_enabled,
    service_charge_bps,
    round_grand_total,
  } = config;

  // In NONE or COMPOSITION mode, tax collected from customer is 0
  const isZeroTaxMode = tax_mode === 'NONE' || tax_mode === 'COMPOSITION';

  // Group lines by effective tax rate
  const rateGroupsMap = new Map<number, { rate_bps: number; lines: OrderLineInput[] }>();

  for (const line of lines) {
    const effectiveRate = isZeroTaxMode
      ? 0
      : (typeof line.tax_rate_bps_override === 'number' && line.tax_rate_bps_override !== null
          ? line.tax_rate_bps_override
          : defaultTaxRateBps);

    const group = rateGroupsMap.get(effectiveRate) || { rate_bps: effectiveRate, lines: [] };
    group.lines.push(line);
    rateGroupsMap.set(effectiveRate, group);
  }

  const rateGroupSummaries: RateGroupSummary[] = [];
  const lineAllocationMap = new Map<OrderLineInput, { taxable: number; tax: number }>();

  let totalSubtotal = 0;
  let totalServiceCharge = 0;
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalGstOrIgst = 0;
  let totalTax = 0;

  for (const [rate_bps, group] of rateGroupsMap.entries()) {
    let subtotal_r = 0;
    const lineAmounts = group.lines.map((l) => {
      const amt = l.unit_price_paise * l.qty;
      subtotal_r += amt;
      return amt;
    });

    let service_r = 0;
    let taxable_r = 0;
    let cgst_r = 0;
    let sgst_r = 0;
    let gst_r = 0;
    let tax_r = 0;

    if (!prices_include_tax) {
      // Tax-exclusive pricing
      if (service_charge_enabled && service_charge_bps > 0) {
        service_r = roundHalfUp(subtotal_r * service_charge_bps, 10000);
      }
      taxable_r = subtotal_r + service_r;

      if (!isZeroTaxMode && rate_bps > 0) {
        if (tax_mode === 'GST_INTRA') {
          // Half rate to CGST and SGST
          cgst_r = roundHalfUp(taxable_r * (rate_bps / 2), 10000);
          sgst_r = cgst_r; // equal halves
          tax_r = cgst_r + sgst_r;
        } else if (tax_mode === 'GST_SINGLE_LINE') {
          gst_r = roundHalfUp(taxable_r * rate_bps, 10000);
          tax_r = gst_r;
        }
      }
    } else {
      // Tax-inclusive pricing
      let gross_r = subtotal_r;
      if (service_charge_enabled && service_charge_bps > 0) {
        service_r = roundHalfUp(subtotal_r * service_charge_bps, 10000);
        gross_r += service_r;
      }

      if (!isZeroTaxMode && rate_bps > 0) {
        taxable_r = roundHalfUp(gross_r * 10000, 10000 + rate_bps);
        tax_r = gross_r - taxable_r;

        if (tax_mode === 'GST_INTRA') {
          cgst_r = Math.floor(tax_r / 2);
          sgst_r = tax_r - cgst_r;
        } else if (tax_mode === 'GST_SINGLE_LINE') {
          gst_r = tax_r;
        }
      } else {
        taxable_r = gross_r;
        tax_r = 0;
      }
    }

    // Allocate group taxable and tax to lines
    const lineTaxables = allocateLargestRemainder(taxable_r, lineAmounts);
    const lineTaxes = allocateLargestRemainder(tax_r, lineAmounts);

    group.lines.forEach((l, idx) => {
      lineAllocationMap.set(l, {
        taxable: lineTaxables[idx] || 0,
        tax: lineTaxes[idx] || 0,
      });
    });

    rateGroupSummaries.push({
      rate_bps,
      effective_rate_bps: isZeroTaxMode ? 0 : rate_bps,
      subtotal_paise: subtotal_r,
      service_charge_paise: service_r,
      taxable_paise: taxable_r,
      cgst_paise: cgst_r,
      sgst_paise: sgst_r,
      igst_or_gst_paise: gst_r,
      total_tax_paise: tax_r,
    });

    totalSubtotal += subtotal_r;
    totalServiceCharge += service_r;
    totalTaxable += taxable_r;
    totalCgst += cgst_r;
    totalSgst += sgst_r;
    totalGstOrIgst += gst_r;
    totalTax += tax_r;
  }

  const grand_total_before_round = totalTaxable + totalTax;

  let round_off_paise = 0;
  if (round_grand_total) {
    const rounded = Math.round(grand_total_before_round / 100) * 100;
    round_off_paise = rounded - grand_total_before_round;
  }

  const grand_total_paise = grand_total_before_round + round_off_paise;

  // Build computed lines
  const computedLines: ComputedOrderLine[] = lines.map((l) => {
    const amt = l.unit_price_paise * l.qty;
    const allocated = lineAllocationMap.get(l) || { taxable: amt, tax: 0 };
    const cost =
      typeof l.unit_cost_paise === 'number' && l.unit_cost_paise !== null
        ? l.unit_cost_paise * l.qty
        : null;

    const grossProfit = cost !== null ? allocated.taxable - cost : null;
    const effectiveRate = isZeroTaxMode
      ? 0
      : (typeof l.tax_rate_bps_override === 'number' && l.tax_rate_bps_override !== null
          ? l.tax_rate_bps_override
          : defaultTaxRateBps);

    return {
      id: l.id,
      product_id: l.product_id,
      product_name: l.product_name,
      category_name: l.category_name,
      unit_price_paise: l.unit_price_paise,
      unit_cost_paise: l.unit_cost_paise ?? null,
      tax_rate_bps: effectiveRate,
      qty: l.qty,
      note: l.note,
      line_amount_paise: amt,
      line_taxable_paise: allocated.taxable,
      line_tax_paise: allocated.tax,
      line_cost_paise: cost,
      line_gross_profit_paise: grossProfit,
    };
  });

  return {
    subtotal_paise: totalSubtotal,
    service_charge_paise: totalServiceCharge,
    taxable_paise: totalTaxable,
    cgst_paise: totalCgst,
    sgst_paise: totalSgst,
    igst_or_gst_paise: totalGstOrIgst,
    total_tax_paise: totalTax,
    round_off_paise,
    grand_total_paise,
    rate_groups: rateGroupSummaries,
    lines: computedLines,
    tax_mode,
    tax_rate_bps: defaultTaxRateBps,
    prices_include_tax,
    service_charge_bps: service_charge_enabled ? service_charge_bps : 0,
  };
}
