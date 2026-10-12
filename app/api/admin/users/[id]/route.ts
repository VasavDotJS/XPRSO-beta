import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { users, sessions } from '@/src/server/db/schema';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { hashPassword, hashPin } from '@/src/server/auth/password';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq, sql, and, ne } from 'drizzle-orm';

const userUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  roles: z.array(z.enum(['WAITER', 'ADMIN'])).min(1).optional(),
  password: z.string().min(6).max(100).optional(),
  adminPin: z.string().regex(/^\d{4,6}$/).optional().nullable(),
  mustChangePassword: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Guard: There must always be at least one active ADMIN!
  if (
    (parsed.data.isActive === false && existing.roles.includes('ADMIN')) ||
    (parsed.data.roles && !parsed.data.roles.includes('ADMIN') && existing.roles.includes('ADMIN'))
  ) {
    // Count other active admins
    const otherAdmins = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          ne(users.id, id),
          eq(users.isActive, true),
          sql`'ADMIN' = ANY(${users.roles})`
        )
      );

    const otherAdminCount = Number(otherAdmins[0]?.count || 0);
    if (otherAdminCount < 1) {
      return NextResponse.json(
        { error: 'Cannot deactivate or remove admin role: there must be at least one active admin.' },
        { status: 400 }
      );
    }
  }

  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.roles !== undefined) updates.roles = parsed.data.roles;
  if (parsed.data.mustChangePassword !== undefined) updates.mustChangePassword = parsed.data.mustChangePassword;
  if (parsed.data.isActive !== undefined) {
    updates.isActive = parsed.data.isActive;
    if (!parsed.data.isActive) {
      // Deactivating user revokes all active sessions!
      await db.delete(sessions).where(eq(sessions.userId, id));
    }
  }

  if (parsed.data.password) {
    updates.passwordHash = await hashPassword(parsed.data.password);
    // When password is reset by admin, force change at next login if specified
    updates.mustChangePassword = true;
  }

  if (parsed.data.adminPin !== undefined) {
    updates.adminPinHash = parsed.data.adminPin ? await hashPin(parsed.data.adminPin) : null;
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();

  await logAuditEvent({
    actorId: auth.session!.user.id,
    action: 'UPDATE_USER',
    entity: 'users',
    entityId: id,
    before: { username: existing.username, roles: existing.roles, isActive: existing.isActive },
    after: { username: updated.username, roles: updated.roles, isActive: updated.isActive },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      roles: updated.roles,
      isActive: updated.isActive,
    },
  });
}
