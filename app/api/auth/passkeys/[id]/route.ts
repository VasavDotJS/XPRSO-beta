import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/server/db/client';
import { passkeys } from '@/src/server/db/schema';
import { requireAuth } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const isElevatedAdmin = Boolean(auth.session?.isElevated);

  // If elevated admin, can delete any passkey; otherwise only own passkey
  const condition = isElevatedAdmin
    ? eq(passkeys.id, id)
    : and(eq(passkeys.id, id), eq(passkeys.userId, auth.session!.user.id));

  const [existing] = await db.select().from(passkeys).where(condition).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Passkey not found' }, { status: 404 });
  }

  await db.delete(passkeys).where(eq(passkeys.id, id));

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'REVOKE_PASSKEY',
    entity: 'passkeys',
    entityId: id,
    before: { deviceLabel: existing.deviceLabel },
  });

  return NextResponse.json({ success: true, message: 'Passkey revoked' });
}
