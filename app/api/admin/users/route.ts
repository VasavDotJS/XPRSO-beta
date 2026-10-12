import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { requireElevatedAdmin } from '@/src/server/auth/rbac';
import { hashPassword, hashPin } from '@/src/server/auth/password';
import { logAuditEvent } from '@/src/server/auth/audit';
import { asc } from 'drizzle-orm';

const userCreateSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
  displayName: z.string().min(1).max(100),
  password: z.string().min(6).max(100),
  adminPin: z.string().regex(/^\d{4,6}$/).optional(),
  roles: z.array(z.enum(['WAITER', 'ADMIN'])).min(1),
  mustChangePassword: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const userList = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      roles: users.roles,
      mustChangePassword: users.mustChangePassword,
      isActive: users.isActive,
      hasAdminPin: users.adminPinHash,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(asc(users.displayName));

  const safeList = userList.map((u) => ({
    ...u,
    hasAdminPin: Boolean(u.hasAdminPin),
  }));

  return NextResponse.json({ users: safeList });
}

export async function POST(req: NextRequest) {
  const auth = await requireElevatedAdmin(req);
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
  }

  const { username, displayName, password, adminPin, roles, mustChangePassword } = parsed.data;

  const passwordHash = await hashPassword(password);
  const adminPinHash = adminPin ? await hashPin(adminPin) : null;

  try {
    const [created] = await db
      .insert(users)
      .values({
        username: username.toLowerCase(),
        displayName,
        passwordHash,
        adminPinHash,
        roles,
        mustChangePassword,
        isActive: true,
      })
      .returning();

    await logAuditEvent({
      actorId: auth.session!.user.id,
      action: 'CREATE_USER',
      entity: 'users',
      entityId: created.id,
      after: { username: created.username, roles: created.roles },
    });

    return NextResponse.json({
      user: {
        id: created.id,
        username: created.username,
        displayName: created.displayName,
        roles: created.roles,
        isActive: created.isActive,
      },
    });
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    throw err;
  }
}
