import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { orders, orderLines, products, categories, settings } from '@/src/server/db/schema';
import { requireWaiter } from '@/src/server/auth/rbac';
import { computeOrderTotals, TaxConfig, OrderLineInput } from '@/src/domain/tax';
import { eq, inArray } from 'drizzle-orm';

const updateOrderSchema = z.object({
  version: z.number().int(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY']).optional(),
  tableLabel: z.string().max(50).optional().nullable(),
  note: z.string().max(255).optional().nullable(),
  serviceChargeOptOut: z.boolean().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1),
        note: z.string().max(100).optional().nullable(),
      })
    )
    .optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWaiter(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const isElevatedAdmin = Boolean(auth.session?.isElevated);

  const [orderRecord] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!orderRecord) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));

  // Security: Sanitize cost and profit fields for regular staff/waiters
  const sanitizedLines = lines.map((l) => {
    if (isElevatedAdmin) {
      return l;
    }
    const { unitCostPaise, lineCostPaise, lineGrossProfitPaise, ...safeLine } = l;
    return safeLine;
  });

  return NextResponse.json({
    order: orderRecord,
    lines: sanitizedLines,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWaiter(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid or empty JSON body' }, { status: 400 });
  }

  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const { version: clientVersion, orderType, tableLabel, note, lines: lineInputs, serviceChargeOptOut } =
    parsed.data;

  // 1. Fetch current order
  const [currentOrder] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!currentOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (currentOrder.status !== 'OPEN') {
    return NextResponse.json(
      { error: `Cannot modify ${currentOrder.status} order. Only OPEN orders are editable.` },
      { status: 400 }
    );
  }

  // 2. Optimistic Concurrency Check
  if (currentOrder.version !== clientVersion) {
    const latestLines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));
    return NextResponse.json(
      {
        error: 'Order was updated by another staff member. Please review latest changes.',
        conflict: true,
        currentOrder,
        latestLines,
      },
      { status: 409 }
    );
  }

  // 3. Tax configuration
  const [appSettings] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const taxConfig: TaxConfig = {
    tax_mode: (appSettings?.taxMode as any) || 'GST_INTRA',
    tax_rate_bps: appSettings?.taxRateBps || 500,
    prices_include_tax: appSettings?.pricesIncludeTax || false,
    service_charge_enabled: serviceChargeOptOut ? false : (appSettings?.serviceChargeEnabled || false),
    service_charge_bps: appSettings?.serviceChargeBps || 500,
    round_grand_total: appSettings?.roundGrandTotal ?? true,
  };

  // 4. If lines provided, recompute
  let computedTotals;
  if (lineInputs) {
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
        note: line.note || undefined,
      };
    });

    computedTotals = computeOrderTotals(taxEngineInputs, taxConfig);
  }

  // 5. Update order and order lines
  const nextVersion = currentOrder.version + 1;
  const updateData: Partial<typeof orders.$inferInsert> = {
    version: nextVersion,
    updatedAt: new Date(),
  };

  if (orderType) updateData.orderType = orderType;
  if (tableLabel !== undefined) updateData.tableLabel = tableLabel;
  if (note !== undefined) updateData.note = note;

  if (computedTotals) {
    updateData.subtotalPaise = computedTotals.subtotal_paise;
    updateData.serviceChargePaise = computedTotals.service_charge_paise;
    updateData.taxablePaise = computedTotals.taxable_paise;
    updateData.cgstPaise = computedTotals.cgst_paise;
    updateData.sgstPaise = computedTotals.sgst_paise;
    updateData.igstOrGstPaise = computedTotals.igst_or_gst_paise;
    updateData.roundOffPaise = computedTotals.round_off_paise;
    updateData.grandTotalPaise = computedTotals.grand_total_paise;
    updateData.serviceChargeBps = computedTotals.service_charge_bps;
  }

  const [updatedOrder] = await db
    .update(orders)
    .set(updateData)
    .where(eq(orders.id, id))
    .returning();

  if (computedTotals) {
    await db.delete(orderLines).where(eq(orderLines.orderId, id));
    if (computedTotals.lines.length > 0) {
      await db.insert(orderLines).values(
        computedTotals.lines.map((l) => ({
          orderId: id,
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
  }

  const updatedLines = await db.select().from(orderLines).where(eq(orderLines.orderId, id));

  return NextResponse.json({
    order: updatedOrder,
    lines: updatedLines,
    totals: computedTotals,
  });
}
