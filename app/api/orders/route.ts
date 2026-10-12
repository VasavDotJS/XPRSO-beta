import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { orders, orderLines, products, categories, settings } from '@/src/server/db/schema';
import { requireWaiter } from '@/src/server/auth/rbac';
import { computeOrderTotals, TaxConfig, OrderLineInput } from '@/src/domain/tax';
import { eq, inArray, and, desc, asc } from 'drizzle-orm';

const createOrderSchema = z.object({
  orderType: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  tableLabel: z.string().max(50).optional().nullable(),
  note: z.string().max(255).optional().nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1),
        note: z.string().max(100).optional(),
      })
    )
    .default([]),
});

export async function GET(req: NextRequest) {
  const auth = await requireWaiter(req);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status') || 'OPEN';
  const sort = url.searchParams.get('sort') || 'time'; // 'time' | 'table' | 'amount'

  let query = db.select().from(orders);

  // Status condition
  const conditions = [];
  if (statusFilter !== 'ALL') {
    conditions.push(eq(orders.status, statusFilter));
  }

  const orderList = await db
    .select({
      id: orders.id,
      status: orders.status,
      orderType: orders.orderType,
      tableLabel: orders.tableLabel,
      note: orders.note,
      invoiceNo: orders.invoiceNo,
      subtotalPaise: orders.subtotalPaise,
      grandTotalPaise: orders.grandTotalPaise,
      totalTaxPaise: orders.cgstPaise, // or computed sum
      version: orders.version,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      settledAt: orders.settledAt,
    })
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      sort === 'table'
        ? asc(orders.tableLabel)
        : sort === 'amount'
        ? desc(orders.grandTotalPaise)
        : desc(orders.createdAt)
    );

  return NextResponse.json({ orders: orderList });
}

export async function POST(req: NextRequest) {
  const auth = await requireWaiter(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const { orderType, tableLabel, note, lines: lineInputs } = parsed.data;

  // 1. Fetch current tax settings
  const [appSettings] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const taxConfig: TaxConfig = {
    tax_mode: (appSettings?.taxMode as any) || 'GST_INTRA',
    tax_rate_bps: appSettings?.taxRateBps || 500,
    prices_include_tax: appSettings?.pricesIncludeTax || false,
    service_charge_enabled: appSettings?.serviceChargeEnabled || false,
    service_charge_bps: appSettings?.serviceChargeBps || 500,
    round_grand_total: appSettings?.roundGrandTotal ?? true,
  };

  // 2. Fetch current product information from DB (Source of Truth for price & cost)
  const productIds = lineInputs.map((l) => l.productId);
  const dbProducts = productIds.length > 0
    ? await db
        .select({
          id: products.id,
          name: products.name,
          categoryName: categories.name,
          pricePaise: products.pricePaise,
          costPaise: products.costPaise,
          taxRateBpsOverride: products.taxRateBpsOverride,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(inArray(products.id, productIds))
    : [];

  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  // 3. Prepare inputs for pure tax engine
  const taxEngineInputs: OrderLineInput[] = lineInputs.map((line) => {
    const p = productMap.get(line.productId);
    if (!p) throw new Error(`Product ${line.productId} not found`);
    return {
      product_id: p.id,
      product_name: p.name,
      category_name: p.categoryName || 'General',
      unit_price_paise: p.pricePaise,
      unit_cost_paise: p.costPaise,
      tax_rate_bps_override: p.taxRateBpsOverride,
      qty: line.qty,
      note: line.note,
    };
  });

  // 4. Compute exact server totals
  const computedTotals = computeOrderTotals(taxEngineInputs, taxConfig);

  // 5. Insert order and lines within a transaction
  const [newOrder] = await db
    .insert(orders)
    .values({
      status: 'OPEN',
      orderType,
      tableLabel,
      note,
      createdBy: auth.session!.user.id,
      subtotalPaise: computedTotals.subtotal_paise,
      serviceChargePaise: computedTotals.service_charge_paise,
      taxablePaise: computedTotals.taxable_paise,
      cgstPaise: computedTotals.cgst_paise,
      sgstPaise: computedTotals.sgst_paise,
      igstOrGstPaise: computedTotals.igst_or_gst_paise,
      roundOffPaise: computedTotals.round_off_paise,
      grandTotalPaise: computedTotals.grand_total_paise,
      taxMode: computedTotals.tax_mode,
      taxRateBps: computedTotals.tax_rate_bps,
      pricesIncludeTax: computedTotals.prices_include_tax,
      serviceChargeBps: computedTotals.service_charge_bps,
      version: 1,
    })
    .returning();

  if (computedTotals.lines.length > 0) {
    await db.insert(orderLines).values(
      computedTotals.lines.map((l) => ({
        orderId: newOrder.id,
        productId: l.product_id,
        productNameSnapshot: l.product_name || 'Item',
        categoryNameSnapshot: l.category_name || 'General',
        unitPricePaise: l.unit_price_paise,
        unitCostPaise: l.unit_cost_paise,
        taxRateBps: l.tax_rate_bps,
        qty: l.qty,
        note: l.note,
        lineAmountPaise: l.line_amount_paise,
        lineTaxablePaise: l.line_taxable_paise,
        lineTaxPaise: l.line_tax_paise,
        lineCostPaise: l.line_cost_paise,
        lineGrossProfitPaise: l.line_gross_profit_paise,
      }))
    );
  }

  return NextResponse.json({ order: newOrder, totals: computedTotals });
}
