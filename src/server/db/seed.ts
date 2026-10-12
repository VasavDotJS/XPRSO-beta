import { db, pool } from './client';
import {
  users,
  categories,
  products,
  orders,
  orderLines,
  invoiceCounters,
  settings,
} from './schema';
import { hashPassword, hashPin } from '../auth/password';
import { computeOrderTotals, TaxConfig } from '@/src/domain/tax';
import { getFinancialYearShort, formatInvoiceNumber } from '@/src/domain/orders/invoice';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

export async function seedDatabase() {
  console.log('Seeding demo café menu, staff users, and 60 days of settled orders...');

  // Reset demo catalog and order data idempotently
  const client = await pool.connect();
  try {
    await client.query(
      'TRUNCATE TABLE order_lines, orders, invoice_counters, products, categories RESTART IDENTITY CASCADE;'
    );
  } finally {
    client.release();
  }

  // 1. Create Staff Accounts
  const waiterPasswordHash = await hashPassword('Waiter@123');
  const adminPasswordHash = await hashPassword('Admin@123');
  const adminPinHash = await hashPin('1234');

  const [waiterUser] = await db
    .insert(users)
    .values({
      username: 'waiter',
      displayName: 'Karan Sharma',
      passwordHash: waiterPasswordHash,
      roles: ['WAITER'],
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: { displayName: 'Karan Sharma', roles: ['WAITER'] },
    })
    .returning();

  const [adminUser] = await db
    .insert(users)
    .values({
      username: 'admin',
      displayName: 'Aditi Roy (Owner)',
      passwordHash: adminPasswordHash,
      adminPinHash,
      roles: ['ADMIN', 'WAITER'],
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.username,
      set: { displayName: 'Aditi Roy (Owner)', roles: ['ADMIN', 'WAITER'], adminPinHash },
    })
    .returning();

  // 2. Categories
  const categoryDefs = [
    { name: 'Artisan Coffee', sortOrder: 1 },
    { name: 'Organic Teas', sortOrder: 2 },
    { name: 'Cold Beverages', sortOrder: 3 },
    { name: 'Artisanal Bakery & Snacks', sortOrder: 4 },
    { name: 'Desserts & Sweets', sortOrder: 5 },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoryDefs) {
    const [c] = await db
      .insert(categories)
      .values(cat)
      .returning();
    categoryMap.set(cat.name, c.id);
  }

  // 3. Products (~30 items with cost prices and selling prices in paise)
  const productDefs = [
    // Coffee
    { name: 'Espresso (Double Shot)', cat: 'Artisan Coffee', price: 16000, cost: 4500, diet: 'VEG' },
    { name: 'Americano', cat: 'Artisan Coffee', price: 18000, cost: 4800, diet: 'VEG' },
    { name: 'Cappuccino', cat: 'Artisan Coffee', price: 22000, cost: 6500, diet: 'VEG' },
    { name: 'Vanilla Latte', cat: 'Artisan Coffee', price: 26000, cost: 7500, diet: 'VEG' },
    { name: 'Cold Brew on Tap', cat: 'Artisan Coffee', price: 24000, cost: 6000, diet: 'VEG' },
    { name: 'Spanish Iced Latte', cat: 'Artisan Coffee', price: 28000, cost: 8500, diet: 'VEG' },
    { name: 'Mocha Supreme', cat: 'Artisan Coffee', price: 29000, cost: 9000, diet: 'VEG' },

    // Teas
    { name: 'Masala Chai', cat: 'Organic Teas', price: 12000, cost: 3000, diet: 'VEG' },
    { name: 'Earl Grey Lavender', cat: 'Organic Teas', price: 18000, cost: 4000, diet: 'VEG' },
    { name: 'Jasmine Green Tea', cat: 'Organic Teas', price: 19000, cost: 4500, diet: 'VEG' },
    { name: 'Kashmiri Kahwa', cat: 'Organic Teas', price: 22000, cost: 5500, diet: 'VEG' },

    // Cold Beverages
    { name: 'Classic Lemon Iced Tea', cat: 'Cold Beverages', price: 19000, cost: 4000, diet: 'VEG' },
    { name: 'Peach Passion Cooler', cat: 'Cold Beverages', price: 24000, cost: 5500, diet: 'VEG' },
    { name: 'Fresh Mint Mojito', cat: 'Cold Beverages', price: 23000, cost: 5000, diet: 'VEG' },
    { name: 'Mango Bingsu Shake', cat: 'Cold Beverages', price: 29000, cost: 8500, diet: 'VEG' },
    { name: 'Berry Antioxidant Smoothie', cat: 'Cold Beverages', price: 31000, cost: 9500, diet: 'VEG' },

    // Snacks
    { name: 'Butter Croissant', cat: 'Artisanal Bakery & Snacks', price: 17000, cost: 5500, diet: 'VEG' },
    { name: 'Paneer Tikka Sourdough Toast', cat: 'Artisanal Bakery & Snacks', price: 28000, cost: 9000, diet: 'VEG' },
    { name: 'Smoked Chicken & Pesto Panini', cat: 'Artisanal Bakery & Snacks', price: 34000, cost: 12000, diet: 'NON_VEG' },
    { name: 'Truffle Mushroom Melt', cat: 'Artisanal Bakery & Snacks', price: 32000, cost: 10500, diet: 'VEG' },
    { name: 'Garlic Herb Fries with Dip', cat: 'Artisanal Bakery & Snacks', price: 19000, cost: 5000, diet: 'VEG' },
    { name: 'Hummus & Warm Pita Platter', cat: 'Artisanal Bakery & Snacks', price: 29000, cost: 8500, diet: 'VEGAN' },

    // Desserts
    { name: 'Dark Chocolate Fudge Brownie', cat: 'Desserts & Sweets', price: 22000, cost: 6500, diet: 'VEG' },
    { name: 'Basque Burnt Cheesecake', cat: 'Desserts & Sweets', price: 32000, cost: 11000, diet: 'VEG' },
    { name: 'Classic Tiramisu', cat: 'Desserts & Sweets', price: 34000, cost: 12500, diet: 'VEG' },
    { name: 'Almond Biscotti (2 pcs)', cat: 'Desserts & Sweets', price: 12000, cost: 3500, diet: 'VEG' },

    // Intentionally 2 zero-sale or missing cost items to test analytics rules!
    { name: 'Matcha Opera Cake (Rare)', cat: 'Desserts & Sweets', price: 42000, cost: 18000, diet: 'VEG' }, // zero sales
    { name: 'Seasonal Plum Tart', cat: 'Desserts & Sweets', price: 27000, cost: null, diet: 'VEG' }, // missing cost!
  ];

  const createdProducts = [];
  for (const p of productDefs) {
    const catId = categoryMap.get(p.cat)!;
    const [prod] = await db
      .insert(products)
      .values({
        categoryId: catId,
        name: p.name,
        pricePaise: p.price,
        costPaise: p.cost,
        dietTag: p.diet,
        isAvailable: true,
      })
      .returning();
    createdProducts.push(prod);
  }

  // 4. Generate 60 Days of Realistic Settled Orders
  console.log('Generating 60 days of settled orders with realistic hourly patterns...');

  const taxConfig: TaxConfig = {
    tax_mode: 'GST_INTRA',
    tax_rate_bps: 500,
    prices_include_tax: false,
    service_charge_enabled: false,
    service_charge_bps: 0,
    round_grand_total: true,
  };

  const now = new Date();
  const currentFy = getFinancialYearShort(now);
  const maxInvRes = await pool.query(
    "SELECT COALESCE(MAX(SUBSTRING(invoice_no FROM '[0-9]+$')::bigint), 0) as max_num FROM orders"
  );
  let invoiceSequence = Number(maxInvRes.rows[0].max_num || 0) + 1;

  const activeSellingProducts = createdProducts.filter((p) => p.name !== 'Matcha Opera Cake (Rare)');

  for (let dayOffset = 59; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
    const ordersToday = isWeekend ? 8 : 5; // Realistic volume

    for (let ordIndex = 0; ordIndex < ordersToday; ordIndex++) {
      // Pick realistic hours: 9am (breakfast), 1pm (lunch), 5-7pm (evening rush)
      const hours = [9, 10, 13, 14, 17, 18, 19, 20];
      const hour = hours[ordIndex % hours.length];
      const minute = Math.floor(Math.random() * 55);

      const settledAt = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), hour, minute);

      // Pick 2 to 4 products
      const lineCount = Math.floor(Math.random() * 3) + 2;
      const chosenLines = [];

      for (let l = 0; l < lineCount; l++) {
        const prod = activeSellingProducts[Math.floor(Math.random() * activeSellingProducts.length)];
        chosenLines.push({
          product_id: prod.id,
          product_name: prod.name,
          category_name: 'Menu',
          unit_price_paise: prod.pricePaise,
          unit_cost_paise: prod.costPaise,
          qty: Math.floor(Math.random() * 2) + 1,
        });
      }

      const computedTotals = computeOrderTotals(chosenLines, taxConfig);
      const invoiceNo = formatInvoiceNumber('ORD', currentFy, invoiceSequence++);
      const paymentMode = ['UPI', 'UPI', 'CARD', 'CASH'][ordIndex % 4];

      // 1. Insert as OPEN
      const [orderRecord] = await db
        .insert(orders)
        .values({
          status: 'OPEN',
          orderType: ordIndex % 3 === 0 ? 'TAKEAWAY' : 'DINE_IN',
          tableLabel: ordIndex % 3 === 0 ? null : `T${(ordIndex % 6) + 1}`,
          createdBy: waiterUser.id,
          subtotalPaise: computedTotals.subtotal_paise,
          serviceChargePaise: computedTotals.service_charge_paise,
          taxablePaise: computedTotals.taxable_paise,
          cgstPaise: computedTotals.cgst_paise,
          sgstPaise: computedTotals.sgst_paise,
          igstOrGstPaise: computedTotals.igst_or_gst_paise,
          roundOffPaise: computedTotals.round_off_paise,
          grandTotalPaise: computedTotals.grand_total_paise,
          taxMode: 'GST_INTRA',
          taxRateBps: 500,
          pricesIncludeTax: false,
          version: 1,
          createdAt: new Date(settledAt.getTime() - 15 * 60 * 1000),
        })
        .returning();

      // 2. Insert snapshot lines while OPEN
      await db.insert(orderLines).values(
        computedTotals.lines.map((cl) => ({
          orderId: orderRecord.id,
          productId: cl.product_id,
          productNameSnapshot: cl.product_name || 'Item',
          categoryNameSnapshot: cl.category_name || 'General',
          unitPricePaise: cl.unit_price_paise,
          unitCostPaise: cl.unit_cost_paise,
          taxRateBps: cl.tax_rate_bps,
          qty: cl.qty,
          lineAmountPaise: cl.line_amount_paise,
          lineTaxablePaise: cl.line_taxable_paise,
          lineTaxPaise: cl.line_tax_paise,
          lineCostPaise: cl.line_cost_paise,
          lineGrossProfitPaise: cl.line_gross_profit_paise,
          createdAt: settledAt,
        }))
      );

      // 3. Settle order
      await db
        .update(orders)
        .set({
          status: 'SETTLED',
          settledBy: waiterUser.id,
          paymentMode,
          invoiceNo,
          financialYear: currentFy,
          version: 2,
          settledAt,
          updatedAt: settledAt,
        })
        .where(eq(orders.id, orderRecord.id));
    }
  }

  // Update invoice counter
  await db
    .insert(invoiceCounters)
    .values({ financialYear: currentFy, lastNumber: invoiceSequence - 1 })
    .onConflictDoUpdate({
      target: invoiceCounters.financialYear,
      set: { lastNumber: invoiceSequence - 1 },
    });

  console.log(`Seeding finished successfully! Generated ${invoiceSequence - 1} settled orders across 60 days.`);
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed error:', err);
      await pool.end();
      process.exit(1);
    });
}
