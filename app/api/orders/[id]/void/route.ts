import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { orders } from '@/src/server/db/schema';
import { requireWaiter, requireElevatedAdmin } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq } from 'drizzle-orm';

const voidSchema = z.object({
  reason: z.string().min(1).max(255),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = voidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Void reason is required' }, { status: 400 });
  }

  const [orderRecord] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!orderRecord) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (orderRecord.status === 'VOID') {
    return NextResponse.json({ error: 'Order is already voided' }, { status: 400 });
  }

  let actorId: string;

  if (orderRecord.status === 'SETTLED') {
    // Settled orders can only be voided by an elevated admin!
    const auth = await requireElevatedAdmin(req);
    if (auth.error) return auth.error;
    actorId = auth.session!.user.id;
  } else {
    // OPEN orders can be voided by any waiter
    const auth = await requireWaiter(req);
    if (auth.error) return auth.error;
    actorId = auth.session!.user.id;
  }

  const [voidedOrder] = await db
    .update(orders)
    .set({
      status: 'VOID',
      voidedBy: actorId,
      voidReason: parsed.data.reason,
      voidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id))
    .returning();

  await logAuditEvent({
    actorId,
    action: 'VOID_ORDER',
    entity: 'orders',
    entityId: id,
    before: { status: orderRecord.status },
    after: { status: 'VOID', reason: parsed.data.reason },
  });

  return NextResponse.json({ success: true, order: voidedOrder });
}
