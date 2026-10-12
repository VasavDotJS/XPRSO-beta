import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { products, priceHistory } from '@/src/server/db/schema';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq } from 'drizzle-orm';

const productUpdateSchema = z.object({
  categoryId: z.string().uuid().optional().nullable().or(z.literal('')),
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(500).optional().nullable(),
  dietTag: z.enum(['VEG', 'NON_VEG', 'VEGAN']).optional().nullable(),
  pricePaise: z.number().int().min(0).optional(),
  costPaise: z.number().int().min(0).optional().nullable(),
  taxRateBpsOverride: z.number().int().min(0).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  isAvailable: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const parsed = productUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const updates: any = { ...parsed.data, updatedAt: new Date() };
  if ('categoryId' in updates) {
    updates.categoryId = updates.categoryId && updates.categoryId.trim() !== '' ? updates.categoryId : null;
  }

  // Check price change
  if (updates.pricePaise !== undefined && updates.pricePaise !== existing.pricePaise) {
    await db.insert(priceHistory).values({
      productId: id,
      field: 'price',
      oldPaise: existing.pricePaise,
      newPaise: updates.pricePaise,
      changedBy: auth.session!.user.id,
    });
  }

  // Check cost price change
  if (updates.costPaise !== undefined && updates.costPaise !== existing.costPaise) {
    await db.insert(priceHistory).values({
      productId: id,
      field: 'cost',
      oldPaise: existing.costPaise,
      newPaise: updates.costPaise,
      changedBy: auth.session!.user.id,
    });
  }

  const [updated] = await db
    .update(products)
    .set(updates)
    .where(eq(products.id, id))
    .returning();

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'UPDATE_PRODUCT',
    entity: 'products',
    entityId: id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ product: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(products)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'ARCHIVE_PRODUCT',
    entity: 'products',
    entityId: id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ success: true, product: updated });
}
