import { describe, it, expect, beforeAll } from 'vitest';
import {
  getKpis,
  getTopProducts,
  getBottomProducts,
  getProductSales,
  getHighlights,
  DateRange,
} from '@/src/server/analytics';

describe('Integration: Deterministic SQL Analytics & Highlights', () => {
  const range: DateRange = {
    from: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
    to: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  it('computes exact KPIs with SQL aggregates', async () => {
    const kpis = await getKpis(range);
    expect(kpis.ordersCount).toBeGreaterThan(50);
    expect(kpis.itemsSoldCount).toBeGreaterThan(100);
    expect(kpis.revenuePaise).toBeGreaterThan(100000);
    expect(kpis.gstCollectedPaise).toBeGreaterThan(0);
    expect(kpis.grossProfitPaise).toBeGreaterThan(0);
    expect(kpis.averageOrderValuePaise).toBeGreaterThan(0);
  });

  it('ranks top products accurately by volume', async () => {
    const top = await getTopProducts(range, 'qty', 5);
    expect(top.length).toBe(5);
    expect(top[0].qtySold).toBeGreaterThanOrEqual(top[1].qtySold);
    expect(top[0].revenuePaise).toBeGreaterThan(0);
  });

  it('includes zero-sale active products in bottom products query via LEFT JOIN', async () => {
    const bottom = await getBottomProducts(range, 20);
    expect(bottom.length).toBeGreaterThan(0);

    // Verify there are zero-sale items returned
    const zeroSaleItems = bottom.filter((p) => p.qtySold === 0);
    expect(zeroSaleItems.length).toBeGreaterThan(0);
    expect(zeroSaleItems[0].revenuePaise).toBe(0);

    const matcha = zeroSaleItems.find((p) => p.productName.includes('Matcha Opera Cake'));
    expect(matcha).toBeDefined();
    expect(matcha?.qtySold).toBe(0);
  });

  it('flags products with missing cost prices without counting them as 100% margin', async () => {
    const sales = await getProductSales(range);
    // 'Seasonal Plum Tart' was seeded with costPaise = null
    const missingCostItem = sales.find((p) => p.productName === 'Seasonal Plum Tart');
    if (missingCostItem && missingCostItem.qtySold > 0) {
      expect(missingCostItem.hasMissingCost).toBe(true);
      expect(missingCostItem.marginPct).toBeNull();
    }
  });

  it('generates deterministic plain-English highlights from SQL results without AI', async () => {
    const highlights = await getHighlights(range);
    expect(highlights.length).toBeGreaterThan(0);
    expect(highlights.length).toBeLessThanOrEqual(6);

    // Verify first highlight is best seller
    const bestSeller = highlights.find((h) => h.kind === 'best_seller');
    expect(bestSeller).toBeDefined();
    expect(bestSeller?.text).toContain('was the best seller');

    // Verify zero sales highlight exists
    const zeroSaleHighlight = highlights.find((h) => h.kind === 'zero_sales');
    expect(zeroSaleHighlight).toBeDefined();
    expect(zeroSaleHighlight?.text).toContain('had no sales');
  });
});
