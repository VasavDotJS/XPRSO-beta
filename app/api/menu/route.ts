import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/server/db/client';
import { categories, products, settings } from '@/src/server/db/schema';
import { requireWaiter } from '@/src/server/auth/rbac';
import { eq, and, asc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await requireWaiter(req);
  if (auth.error) return auth.error;

  // Active categories
  const categoryList = await db
    .select({
      id: categories.id,
      name: categories.name,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(eq(categories.isArchived, false))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  // Non-archived products (costPaise is strictly omitted!)
  const productList = await db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      name: products.name,
      description: products.description,
      dietTag: products.dietTag,
      pricePaise: products.pricePaise,
      taxRateBpsOverride: products.taxRateBpsOverride,
      imageUrl: products.imageUrl,
      isAvailable: products.isAvailable,
      sortOrder: products.sortOrder,
    })
    .from(products)
    .where(eq(products.isArchived, false))
    .orderBy(asc(products.sortOrder), asc(products.name));

  // Current tax configuration for client live calculation
  const [currentSettings] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);

  return NextResponse.json({
    categories: categoryList,
    products: productList,
    taxConfig: {
      tax_mode: currentSettings?.taxMode || 'GST_INTRA',
      tax_rate_bps: currentSettings?.taxRateBps || 500,
      prices_include_tax: currentSettings?.pricesIncludeTax || false,
      service_charge_enabled: currentSettings?.serviceChargeEnabled || false,
      service_charge_bps: currentSettings?.serviceChargeBps || 500,
      round_grand_total: currentSettings?.roundGrandTotal ?? true,
    },
    cafe: {
      name: currentSettings?.cafeName || 'XPRSO Cafe',
      invoicePrefix: currentSettings?.invoicePrefix || 'ORD',
    },
  });
}
