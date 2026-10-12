import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { products, categories, priceHistory } from '@/src/server/db/schema';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { asc, eq } from 'drizzle-orm';

const productCreateSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  dietTag: z.enum(['VEG', 'NON_VEG', 'VEGAN']).optional().nullable(),
  pricePaise: z.number().int().min(0),
  costPaise: z.number().int().min(0).optional().nullable(),
  taxRateBpsOverride: z.number().int().min(0).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const list = await db
    .select({
      id: products.id,
      categoryId: products.categoryId,
      categoryName: categories.name,
      name: products.name,
      description: products.description,
      dietTag: products.dietTag,
      pricePaise: products.pricePaise,
      costPaise: products.costPaise,
      taxRateBpsOverride: products.taxRateBpsOverride,
      imageUrl: products.imageUrl,
      isAvailable: products.isAvailable,
      isArchived: products.isArchived,
      sortOrder: products.sortOrder,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(products.sortOrder), asc(products.name));

  return NextResponse.json({ products: list });
}

export async function POST(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const [product] = await db
    .insert(products)
    .values(parsed.data)
    .returning();

  // Record initial price history
  await db.insert(priceHistory).values({
    productId: product.id,
    field: 'price',
    oldPaise: null,
    newPaise: product.pricePaise,
    changedBy: auth.session!.user.id,
  });

  if (product.costPaise !== null && product.costPaise !== undefined) {
    await db.insert(priceHistory).values({
      productId: product.id,
      field: 'cost',
      oldPaise: null,
      newPaise: product.costPaise,
      changedBy: auth.session!.user.id,
    });
  }

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'CREATE_PRODUCT',
    entity: 'products',
    entityId: product.id,
    after: product,
  });

  return NextResponse.json({ product });
}
