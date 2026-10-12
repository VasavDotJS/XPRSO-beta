import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { products, priceHistory } from '@/src/server/db/schema';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq, inArray } from 'drizzle-orm';

const bulkItemSchema = z.object({
  id: z.string().uuid(),
  pricePaise: z.number().int().min(0).optional(),
  costPaise: z.number().int().min(0).optional().nullable(),
  isAvailable: z.boolean().optional(),
});

const bulkSchema = z.object({
  items: z.array(bulkItemSchema).min(1),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const { items } = parsed.data;
  const itemIds = items.map((i) => i.id);

  const existingProducts = await db
    .select()
    .from(products)
    .where(inArray(products.id, itemIds));

  const existingMap = new Map(existingProducts.map((p) => [p.id, p]));
  const updatedResults = [];

  for (const item of items) {
    const existing = existingMap.get(item.id);
    if (!existing) continue;

    // Track price change
    if (item.pricePaise !== undefined && item.pricePaise !== existing.pricePaise) {
      await db.insert(priceHistory).values({
        productId: item.id,
        field: 'price',
        oldPaise: existing.pricePaise,
        newPaise: item.pricePaise,
        changedBy: auth.session!.user.id,
      });
    }

    // Track cost change
    if (item.costPaise !== undefined && item.costPaise !== existing.costPaise) {
      await db.insert(priceHistory).values({
        productId: item.id,
        field: 'cost',
        oldPaise: existing.costPaise,
        newPaise: item.costPaise,
        changedBy: auth.session!.user.id,
      });
    }

    const updates: Partial<typeof products.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (item.pricePaise !== undefined) updates.pricePaise = item.pricePaise;
    if (item.costPaise !== undefined) updates.costPaise = item.costPaise;
    if (item.isAvailable !== undefined) updates.isAvailable = item.isAvailable;

    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, item.id))
      .returning();

    updatedResults.push(updated);
  }

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'BULK_UPDATE_PRODUCTS',
    entity: 'products',
    after: { count: updatedResults.length, ids: itemIds },
  });

  return NextResponse.json({ success: true, count: updatedResults.length, products: updatedResults });
}
