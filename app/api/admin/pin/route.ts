import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { verifyPassword, hashPin } from '@/src/server/auth/password';
import { requireAdmin } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq } from 'drizzle-orm';

const changePinSchema = z.object({
  currentPassword: z.string().min(1),
  newPin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = changePinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const { currentPassword, newPin } = parsed.data;

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.session!.user.id))
    .limit(1);

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify current password
  const isPasswordValid = await verifyPassword(currentPassword, userRecord.passwordHash);
  if (!isPasswordValid) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const pinHash = await hashPin(newPin);
  await db
    .update(users)
    .set({ adminPinHash: pinHash, updatedAt: new Date() })
    .where(eq(users.id, userRecord.id));

  await logAuditEvent({
    actorId: userRecord.id,
    action: 'CHANGE_ADMIN_PIN',
    entity: 'users',
    entityId: userRecord.id,
  });

  return NextResponse.json({ success: true, message: 'Admin PIN updated successfully' });
}
