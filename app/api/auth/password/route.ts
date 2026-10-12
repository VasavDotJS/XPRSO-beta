import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { verifyPassword, hashPassword } from '@/src/server/auth/password';
import { requireAuth } from '@/src/server/auth/rbac';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq } from 'drizzle-orm';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.id, auth.session!.user.id))
    .limit(1);

  if (!userRecord) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isCurrentValid = await verifyPassword(currentPassword, userRecord.passwordHash);
  if (!isCurrentValid) {
    return NextResponse.json({ error: 'Incorrect current password' }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userRecord.id));

  await logAuditEvent({
    actorId: userRecord.id,
    action: 'CHANGE_PASSWORD',
    entity: 'users',
    entityId: userRecord.id,
  });

  return NextResponse.json({ success: true, message: 'Password updated successfully' });
}
