import { describe, it, expect } from 'vitest';
import {
  computeOrderTotals,
  TaxConfig,
  OrderLineInput,
  allocateLargestRemainder,
} from '@/src/domain/tax';
import { formatINR, formatBps, rupeesToPaise, paiseToRupees } from '@/src/domain/money';

describe('Domain: Money Helpers', () => {
  it('converts rupees to paise and back accurately', () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(12.5)).toBe(1250);
    expect(rupeesToPaise('₹ 1,234.56')).toBe(123456);
    expect(paiseToRupees(123456)).toBe(1234.56);
  });

  it('formats INR with Indian digit grouping', () => {
    const formatted = formatINR(12345650);
    // Should contain ₹ and 1,23,456.50
    expect(formatted).toContain('1,23,456.50');
    expect(formatted).toContain('₹');
  });

  it('formats basis points accurately', () => {
    expect(formatBps(500)).toBe('5%');
    expect(formatBps(250)).toBe('2.5%');
    expect(formatBps(725)).toBe('7.25%');
    expect(formatBps(1800)).toBe('18%');
    expect(formatBps(0)).toBe('0%');
  });
});

describe('Domain: Tax Engine Table-Driven Tests', () => {
  const baseConfig: TaxConfig = {
    tax_mode: 'GST_INTRA',
    tax_rate_bps: 500, // 5%
    prices_include_tax: false,
    service_charge_enabled: false,
    service_charge_bps: 0,
    round_grand_total: false,
  };

  it('handles 0% GST rate', () => {
    const config: TaxConfig = { ...baseConfig, tax_rate_bps: 0 };
    const lines: OrderLineInput[] = [
      { product_id: 'p1', unit_price_paise: 20000, qty: 2 }, // 400.00
    ];
    const totals = computeOrderTotals(lines, config);
    expect(totals.subtotal_paise).toBe(40000);
    expect(totals.cgst_paise).toBe(0);
    expect(totals.sgst_paise).toBe(0);
    expect(totals.total_tax_paise).toBe(0);
    expect(totals.grand_total_paise).toBe(40000);
  });

  it('handles standard 5% tax-exclusive (2.5% CGST + 2.5% SGST)', () => {
    const lines: OrderLineInput[] = [
      { product_id: 'p1', unit_price_paise: 15000, qty: 2 }, // 300.00
    ];
    const totals = computeOrderTotals(lines, baseConfig);
    expect(totals.subtotal_paise).toBe(30000);
    expect(totals.taxable_paise).toBe(30000);
    // 5% of 30,000 = 1,500 paise -> CGST 750, SGST 750
    expect(totals.cgst_paise).toBe(750);
    expect(totals.sgst_paise).toBe(750);
    expect(totals.total_tax_paise).toBe(1500);
    expect(totals.grand_total_paise).toBe(31500);
  });

  it('handles 12% and 18% tax rates', () => {
    const config12: TaxConfig = { ...baseConfig, tax_rate_bps: 1200 };
    const totals12 = computeOrderTotals(
      [{ product_id: 'p1', unit_price_paise: 10000, qty: 1 }],
      config12
    );
    expect(totals12.cgst_paise).toBe(600);
    expect(totals12.sgst_paise).toBe(600);
    expect(totals12.grand_total_paise).toBe(11200);

    const config18: TaxConfig = { ...baseConfig, tax_rate_bps: 1800 };
    const totals18 = computeOrderTotals(
      [{ product_id: 'p1', unit_price_paise: 10000, qty: 1 }],
      config18
    );
    expect(totals18.cgst_paise).toBe(900);
    expect(totals18.sgst_paise).toBe(900);
    expect(totals18.grand_total_paise).toBe(11800);
  });

  it('handles odd tax rate like 7.25% (725 bps)', () => {
    const config: TaxConfig = { ...baseConfig, tax_rate_bps: 725 };
    const lines: OrderLineInput[] = [
      { product_id: 'p1', unit_price_paise: 10000, qty: 1 },
    ];
    const totals = computeOrderTotals(lines, config);
    // 7.25% / 2 = 3.625% -> 10000 * 362.5 / 10000 = 362.5 -> round to 363
    expect(totals.cgst_paise).toBe(363);
    expect(totals.sgst_paise).toBe(363);
    expect(totals.total_tax_paise).toBe(726);
    expect(totals.grand_total_paise).toBe(10726);
  });

  it('handles tax-inclusive pricing correctly', () => {
    const config: TaxConfig = { ...baseConfig, prices_include_tax: true, tax_rate_bps: 500 };
    // Product gross price is ₹105 (10,500 paise)
    const lines: OrderLineInput[] = [
      { product_id: 'p1', unit_price_paise: 10500, qty: 1 },
    ];
    const totals = computeOrderTotals(lines, config);
    // taxable = round(10500 * 10000 / 10500) = 10000 paise (₹100)
    // tax = 500 paise -> CGST 250, SGST 250
    expect(totals.taxable_paise).toBe(10000);
    expect(totals.total_tax_paise).toBe(500);
    expect(totals.cgst_paise).toBe(250);
    expect(totals.sgst_paise).toBe(250);
    expect(totals.grand_total_paise).toBe(10500);
  });

  it('handles service charge on and off', () => {
    const withService: TaxConfig = {
      ...baseConfig,
      service_charge_enabled: true,
      service_charge_bps: 500, // 5%
    };
    const lines: OrderLineInput[] = [
      { product_id: 'p1', unit_price_paise: 10000, qty: 1 }, // subtotal 10000
    ];
    const totals = computeOrderTotals(lines, withService);
    // Service charge = 5% of 10000 = 500
    // Taxable = 10000 + 500 = 10500
    // CGST = round(10500 * 2.5 / 100) = 263, SGST = 263
    expect(totals.service_charge_paise).toBe(500);
    expect(totals.taxable_paise).toBe(10500);
    expect(totals.cgst_paise).toBe(263);
    expect(totals.sgst_paise).toBe(263);
    expect(totals.grand_total_paise).toBe(10500 + 526);
  });

  it('handles grand total rounding on and off', () => {
    const configNoRound: TaxConfig = { ...baseConfig, round_grand_total: false };
    const lines: OrderLineInput[] = [
      { product_id: 'p1', unit_price_paise: 105, qty: 1 }, // 105 paise
    ];
    // Taxable = 105. CGST = round(105 * 2.5 / 100) = round(2.625) = 3. SGST = 3. Total tax = 6. Grand total = 111 paise.
    const totalsNoRound = computeOrderTotals(lines, configNoRound);
    expect(totalsNoRound.round_off_paise).toBe(0);
    expect(totalsNoRound.grand_total_paise).toBe(111);

    const configRound: TaxConfig = { ...baseConfig, round_grand_total: true };
    const totalsRound = computeOrderTotals(lines, configRound);
    // 111 paise rounds to nearest 100 paise = 100 paise -> round_off = -11 paise
    expect(totalsRound.round_off_paise).toBe(-11);
    expect(totalsRound.grand_total_paise).toBe(100);
  });

  it('handles single item of ₹1 (100 paise)', () => {
    const lines: OrderLineInput[] = [
      { product_id: 'p1', unit_price_paise: 100, qty: 1 },
    ];
    const totals = computeOrderTotals(lines, baseConfig);
    expect(totals.subtotal_paise).toBe(100);
    // CGST = round(100 * 0.025) = round(2.5) = 3
    expect(totals.cgst_paise).toBe(3);
    expect(totals.sgst_paise).toBe(3);
    expect(totals.grand_total_paise).toBe(106);
  });

  it('handles per-product tax override creating multiple rate groups', () => {
    const lines: OrderLineInput[] = [
      { product_id: 'coffee', unit_price_paise: 20000, qty: 1 }, // default 5%
      { product_id: 'pastry', unit_price_paise: 10000, qty: 1, tax_rate_bps_override: 1800 }, // 18%
    ];
    const totals = computeOrderTotals(lines, baseConfig);
    expect(totals.rate_groups.length).toBe(2);

    const group5 = totals.rate_groups.find((g) => g.rate_bps === 500)!;
    const group18 = totals.rate_groups.find((g) => g.rate_bps === 1800)!;

    expect(group5.subtotal_paise).toBe(20000);
    expect(group5.total_tax_paise).toBe(1000); // 5% of 20000

    expect(group18.subtotal_paise).toBe(10000);
    expect(group18.total_tax_paise).toBe(1800); // 18% of 10000

    expect(totals.total_tax_paise).toBe(2800);
    expect(totals.grand_total_paise).toBe(32800);
  });

  it('guarantees per-line allocations sum EXACTLY to group totals', () => {
    const lines: OrderLineInput[] = [
      { product_id: 'p1', unit_price_paise: 1234, qty: 3, unit_cost_paise: 500 },
      { product_id: 'p2', unit_price_paise: 5678, qty: 7, unit_cost_paise: 2500 },
      { product_id: 'p3', unit_price_paise: 9101, qty: 2, unit_cost_paise: 4000 },
    ];
    const totals = computeOrderTotals(lines, baseConfig);

    const sumLineTaxable = totals.lines.reduce((s, l) => s + l.line_taxable_paise, 0);
    const sumLineTax = totals.lines.reduce((s, l) => s + l.line_tax_paise, 0);

    expect(sumLineTaxable).toBe(totals.taxable_paise);
    expect(sumLineTax).toBe(totals.total_tax_paise);
    expect(totals.cgst_paise + totals.sgst_paise).toBe(totals.total_tax_paise);

    // Verify gross profit calculation: line_taxable - line_cost
    for (const line of totals.lines) {
      expect(line.line_cost_paise).toBe(line.unit_cost_paise! * line.qty);
      expect(line.line_gross_profit_paise).toBe(line.line_taxable_paise - line.line_cost_paise!);
    }
  });

  it('handles large order with 500 lines without error or drift', () => {
    const lines: OrderLineInput[] = Array.from({ length: 500 }).map((_, i) => ({
      product_id: `prod_${i}`,
      unit_price_paise: 1500 + (i % 50) * 100,
      qty: (i % 5) + 1,
      unit_cost_paise: 800,
    }));

    const totals = computeOrderTotals(lines, baseConfig);
    const sumLineTaxable = totals.lines.reduce((s, l) => s + l.line_taxable_paise, 0);
    const sumLineTax = totals.lines.reduce((s, l) => s + l.line_tax_paise, 0);

    expect(sumLineTaxable).toBe(totals.taxable_paise);
    expect(sumLineTax).toBe(totals.total_tax_paise);
    expect(totals.cgst_paise + totals.sgst_paise).toBe(totals.total_tax_paise);
  });

  it('property test: 1,000 randomized orders preserve exact parity and sum invariances', () => {
    for (let test = 0; test < 1000; test++) {
      const lineCount = Math.floor(Math.random() * 10) + 1;
      const rateBps = [0, 500, 1200, 1800, 2800, 725][test % 6];
      const includeTax = test % 2 === 0;
      const serviceEnabled = test % 3 === 0;
      const roundTotal = test % 2 === 1;

      const config: TaxConfig = {
        tax_mode: 'GST_INTRA',
        tax_rate_bps: rateBps,
        prices_include_tax: includeTax,
        service_charge_enabled: serviceEnabled,
        service_charge_bps: 500,
        round_grand_total: roundTotal,
      };

      const lines: OrderLineInput[] = Array.from({ length: lineCount }).map((_, idx) => ({
        product_id: `p_${idx}`,
        unit_price_paise: Math.floor(Math.random() * 50000) + 100,
        qty: Math.floor(Math.random() * 5) + 1,
        unit_cost_paise: Math.floor(Math.random() * 20000),
      }));

      const totals = computeOrderTotals(lines, config);

      const sumLineTaxable = totals.lines.reduce((s, l) => s + l.line_taxable_paise, 0);
      const sumLineTax = totals.lines.reduce((s, l) => s + l.line_tax_paise, 0);

      expect(sumLineTaxable).toBe(totals.taxable_paise);
      expect(sumLineTax).toBe(totals.total_tax_paise);
      expect(totals.cgst_paise + totals.sgst_paise).toBe(totals.total_tax_paise);
      expect(totals.grand_total_paise).toBe(
        totals.taxable_paise + totals.total_tax_paise + totals.round_off_paise
      );
    }
  });
});
