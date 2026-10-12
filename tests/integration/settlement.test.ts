import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, pool } from '@/src/server/db/client';
import { users, categories, products, orders, orderLines, invoiceCounters, settings } from '@/src/server/db/schema';
import { hashPassword, hashPin } from '@/src/server/auth/password';
import { createSession, elevateSession } from '@/src/server/auth/sessions';
import { getFinancialYearShort, formatInvoiceNumber } from '@/src/domain/orders/invoice';
import { generateSingleOrderExcel } from '@/src/server/export/excel';
import { generateOrderPdf } from '@/src/server/export/pdf';
import { eq } from 'drizzle-orm';

describe('Integration: Settlement, Immutability & Exports', () => {
  let waiterUserId: string;
  let adminUserId: string;
  let testProductId: string;
  let testOrderId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    // 1. Create waiter and admin
    const [w] = await db
      .insert(users)
      .values({
        username: `waiter_settle_${Date.now()}`,
        displayName: 'Waiter Settle',
        passwordHash: await hashPassword('Pass@123'),
        roles: ['WAITER'],
      })
      .returning();
    waiterUserId = w.id;

    const [a] = await db
      .insert(users)
      .values({
        username: `admin_settle_${Date.now()}`,
        displayName: 'Admin Settle',
        passwordHash: await hashPassword('Pass@123'),
        adminPinHash: await hashPin('1122'),
        roles: ['ADMIN'],
      })
      .returning();
    adminUserId = a.id;

    // 2. Create category and product
    const [c] = await db
      .insert(categories)
      .values({ name: 'Hot Brews', sortOrder: 1 })
      .returning();
    testCategoryId = c.id;

    const [p] = await db
      .insert(products)
      .values({
        categoryId: c.id,
        name: 'Cappuccino Test',
        pricePaise: 20000, // ₹200
        costPaise: 7000, // ₹70
      })
      .returning();
    testProductId = p.id;
  });

  afterAll(async () => {
    try {
      if (testProductId) await db.delete(products).where(eq(products.id, testProductId));
      if (testCategoryId) await db.delete(categories).where(eq(categories.id, testCategoryId));
    } catch {
      // Ignore cleanup errors on test database
    }
  });

  it('determines the correct Indian Financial Year string', () => {
    // October 2026 -> 26-27
    const octDate = new Date(2026, 9, 15);
    expect(getFinancialYearShort(octDate)).toBe('26-27');

    // January 2027 -> 26-27 (runs till March 31)
    const janDate = new Date(2027, 0, 10);
    expect(getFinancialYearShort(janDate)).toBe('26-27');

    // April 2027 -> 27-28
    const aprDate = new Date(2027, 3, 1);
    expect(getFinancialYearShort(aprDate)).toBe('27-28');
  });

  it('formats consecutive 6-digit invoice numbers under 16 characters', () => {
    const inv = formatInvoiceNumber('ORD', '26-27', 1);
    expect(inv).toBe('ORD/26-27/000001');
    expect(inv.length).toBeLessThanOrEqual(16);

    const invBig = formatInvoiceNumber('ORD', '26-27', 123456);
    expect(invBig).toBe('ORD/26-27/123456');
    expect(invBig.length).toBeLessThanOrEqual(16);
  });

  it('settles an order and enforces PostgreSQL immutability trigger against updates', async () => {
    // Create an OPEN order
    const [order] = await db
      .insert(orders)
      .values({
        status: 'OPEN',
        orderType: 'DINE_IN',
        tableLabel: 'Table 99',
        createdBy: waiterUserId,
        subtotalPaise: 20000,
        grandTotalPaise: 21000,
      })
      .returning();
    testOrderId = order.id;

    // Settle order inside transaction
    const client = await pool.connect();
    let settledOrder: any;
    try {
      await client.query('BEGIN');
      const fy = getFinancialYearShort(new Date());
      await client.query(
        'INSERT INTO invoice_counters (financial_year, last_number) VALUES ($1, 0) ON CONFLICT DO NOTHING',
        [fy]
      );
      const counterRes = await client.query(
        'SELECT last_number FROM invoice_counters WHERE financial_year = $1 FOR UPDATE',
        [fy]
      );
      const nextNum = Number(counterRes.rows[0].last_number) + 1;
      await client.query('UPDATE invoice_counters SET last_number = $1 WHERE financial_year = $2', [
        nextNum,
        fy,
      ]);
      const invoiceNo = formatInvoiceNumber('ORD', fy, nextNum);

      const updateRes = await client.query(
        `UPDATE orders
         SET status = 'SETTLED', payment_mode = 'UPI', settled_by = $1, settled_at = NOW(), invoice_no = $2
         WHERE id = $3 RETURNING *`,
        [waiterUserId, invoiceNo, order.id]
      );
      settledOrder = updateRes.rows[0];
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    expect(settledOrder.status).toBe('SETTLED');
    expect(settledOrder.invoice_no).toContain('ORD/');

    // Assert DB Trigger rejects updating settled order price or table
    let triggerBlocked = false;
    try {
      await db
        .update(orders)
        .set({ tableLabel: 'Hacked Table' })
        .where(eq(orders.id, order.id));
    } catch (err: any) {
      triggerBlocked = true;
      expect(err.message).toContain('Cannot modify a settled order');
    }
    expect(triggerBlocked).toBe(true);
  });

  it('generates valid Excel and PDF export buffers without errors', async () => {
    const [order] = await db.select().from(orders).where(eq(orders.id, testOrderId));
    const lines = [
      {
        productNameSnapshot: 'Cappuccino Test',
        categoryNameSnapshot: 'Hot Brews',
        qty: 1,
        unitPricePaise: 20000,
        lineAmountPaise: 20000,
        lineTaxablePaise: 20000,
        lineTaxPaise: 1000,
      },
    ];
    const [cafeSettings] = await db.select().from(settings).where(eq(settings.id, 1));

    // Test Excel generator
    const excelBuffer = await generateSingleOrderExcel(order, lines, cafeSettings);
    expect(excelBuffer).toBeInstanceOf(Buffer);
    expect(excelBuffer.length).toBeGreaterThan(1000);

    // Test PDF generator (A4 and receipt)
    const pdfA4Buffer = await generateOrderPdf(order, lines, cafeSettings, 'a4');
    expect(pdfA4Buffer).toBeInstanceOf(Buffer);
    expect(pdfA4Buffer.length).toBeGreaterThan(1000);

    const pdfReceiptBuffer = await generateOrderPdf(order, lines, cafeSettings, 'receipt');
    expect(pdfReceiptBuffer).toBeInstanceOf(Buffer);
    expect(pdfReceiptBuffer.length).toBeGreaterThan(1000);
  });
});
