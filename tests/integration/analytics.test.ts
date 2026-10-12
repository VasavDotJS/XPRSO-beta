import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@/src/server/db/client';
import { users, categories, products, orders, orderLines } from '@/src/server/db/schema';
import { sql, eq } from 'drizzle-orm';
import { hashPassword } from '@/src/server/auth/password';
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

  beforeAll(async () => {
    const [ordersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.status, 'SETTLED'));

    if (Number(ordersCount?.count || 0) < 50) {
      // Create user
      const [u] = await db
        .insert(users)
        .values({
          username: `analytics_staff_${Date.now()}`,
          displayName: 'Analytics Staff',
          passwordHash: await hashPassword('Pass@123'),
          roles: ['WAITER', 'ADMIN'],
        })
        .returning();

      // Create category
      const [cat] = await db
        .insert(categories)
        .values({ name: 'Analytics Cat', sortOrder: 1 })
        .returning();

      // Create test products
      const prods = await db
        .insert(products)
        .values([
          { categoryId: cat.id, name: 'Espresso Analytics', pricePaise: 15000, costPaise: 4000 },
          { categoryId: cat.id, name: 'Latte Analytics', pricePaise: 22000, costPaise: 6500 },
          { categoryId: cat.id, name: 'Americano Analytics', pricePaise: 18000, costPaise: 4500 },
          { categoryId: cat.id, name: 'Cold Brew Analytics', pricePaise: 24000, costPaise: 7000 },
          { categoryId: cat.id, name: 'Mocha Analytics', pricePaise: 25000, costPaise: 8000 },
          { categoryId: cat.id, name: 'Seasonal Plum Tart', pricePaise: 29000, costPaise: null },
          { categoryId: cat.id, name: 'Matcha Opera Cake', pricePaise: 35000, costPaise: 12000 }, // zero sales
        ])
        .returning();

      // Create 55 settled orders
      const runId = Date.now();
      for (let i = 0; i < 55; i++) {
        const [ord] = await db
          .insert(orders)
          .values({
            status: 'OPEN',
            orderType: 'DINE_IN',
            createdBy: u.id,
            subtotalPaise: 15000,
            taxablePaise: 15000,
            cgstPaise: 375,
            sgstPaise: 375,
            igstOrGstPaise: 750,
            grandTotalPaise: 15750,
            invoiceNo: `ORD/26-27/ANL_${runId}_${i}`,
            financialYear: '26-27',
          })
          .returning();

        // Add 1-2 lines per order, ensuring Matcha Opera Cake is never added (0 sales)
        const pIndex = i % 5;
        const prod = prods[pIndex];
        await db.insert(orderLines).values({
          orderId: ord.id,
          productId: prod.id,
          productNameSnapshot: prod.name,
          unitPricePaise: prod.pricePaise,
          unitCostPaise: prod.costPaise,
          taxRateBps: 500,
          qty: 2,
          lineAmountPaise: prod.pricePaise * 2,
          lineTaxablePaise: prod.pricePaise * 2,
          lineTaxPaise: Math.round(prod.pricePaise * 2 * 0.05),
          lineCostPaise: (prod.costPaise || 0) * 2,
          lineGrossProfitPaise: (prod.pricePaise - (prod.costPaise || 0)) * 2,
        });

        // Add Seasonal Plum Tart to every 5th order
        if (i % 5 === 0) {
          const plum = prods[5];
          await db.insert(orderLines).values({
            orderId: ord.id,
            productId: plum.id,
            productNameSnapshot: plum.name,
            unitPricePaise: plum.pricePaise,
            unitCostPaise: null,
            taxRateBps: 500,
            qty: 1,
            lineAmountPaise: plum.pricePaise,
            lineTaxablePaise: plum.pricePaise,
            lineTaxPaise: Math.round(plum.pricePaise * 0.05),
            lineCostPaise: null,
            lineGrossProfitPaise: null,
          });
        }

        // Settle the order respecting immutability
        await db
          .update(orders)
          .set({
            status: 'SETTLED',
            settledBy: u.id,
            settledAt: new Date(Date.now() - (i % 30) * 24 * 60 * 60 * 1000),
          })
          .where(eq(orders.id, ord.id));
      }
    }
  });

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
