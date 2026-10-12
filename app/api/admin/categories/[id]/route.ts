import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { categories } from '@/src/server/db/schema';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq } from 'drizzle-orm';

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isArchived: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(categories)
    .set(parsed.data)
    .where(eq(categories.id, id))
    .returning();

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'UPDATE_CATEGORY',
    entity: 'categories',
    entityId: id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ category: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const [existing] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // Soft delete / archive
  const [updated] = await db
    .update(categories)
    .set({ isArchived: true })
    .where(eq(categories.id, id))
    .returning();

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'ARCHIVE_CATEGORY',
    entity: 'categories',
    entityId: id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ success: true, category: updated });
}
