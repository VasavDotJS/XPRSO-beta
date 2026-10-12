import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { users, settings } from '@/src/server/db/schema';
import { hashPassword, hashPin } from '@/src/server/auth/password';
import { createSession, elevateSession, SESSION_COOKIE_NAME } from '@/src/server/auth/sessions';
import { logAuditEvent } from '@/src/server/auth/audit';
import { sql, eq } from 'drizzle-orm';

const setupSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(6).max(100),
  adminPin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
  displayName: z.string().min(1).max(100),
  cafeName: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const adminCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`'ADMIN' = ANY(${users.roles}) AND ${users.isActive} = true`);

    const count = Number(adminCountResult[0]?.count || 0);
    if (count > 0) {
      return NextResponse.json(
        { error: 'Setup already completed. An active administrator already exists.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { username, password, adminPin, displayName, cafeName } = parsed.data;

    const passwordHash = await hashPassword(password);
    const adminPinHash = await hashPin(adminPin);

    // Create admin user
    const [createdUser] = await db
      .insert(users)
      .values({
        username: username.toLowerCase(),
        displayName,
        passwordHash,
        adminPinHash,
        roles: ['ADMIN', 'WAITER'],
        isActive: true,
      })
      .returning();

    // Upsert cafe name in settings
    await db
      .insert(settings)
      .values({
        id: 1,
        cafeName,
      })
      .onConflictDoUpdate({
        target: settings.id,
        set: {
          cafeName,
          updatedAt: new Date(),
        },
      });

    // Audit log
    await logAuditEvent({
      actorId: createdUser.id,
      action: 'SYSTEM_SETUP',
      entity: 'users',
      entityId: createdUser.id,
      after: { username: createdUser.username, cafeName },
    });

    // Create session and immediately elevate it
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = req.headers.get('user-agent');
    const token = await createSession(createdUser.id, ip, userAgent);
    await elevateSession(token);

    const response = NextResponse.json({
      success: true,
      user: {
        id: createdUser.id,
        username: createdUser.username,
        displayName: createdUser.displayName,
        roles: createdUser.roles,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error('Setup error:', err);
    return NextResponse.json({ error: 'Failed to complete setup' }, { status: 500 });
  }
}
