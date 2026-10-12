import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { categories } from '@/src/server/db/schema';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { asc } from 'drizzle-orm';

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().default(0),
});

export async function GET(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const list = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return NextResponse.json({ categories: list });
}

export async function POST(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const [category] = await db
    .insert(categories)
    .values({
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
    })
    .returning();

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'CREATE_CATEGORY',
    entity: 'categories',
    entityId: category.id,
    after: category,
  });

  return NextResponse.json({ category });
}
