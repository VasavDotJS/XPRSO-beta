import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { verifyPin } from '@/src/server/auth/password';
import { checkRateLimit, recordAuthAttempt } from '@/src/server/auth/rateLimit';
import {
  getCurrentSession,
  elevateSession,
  SESSION_COOKIE_NAME,
} from '@/src/server/auth/sessions';
import { logAuditEvent } from '@/src/server/auth/audit';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user.roles.includes('ADMIN')) {
      return NextResponse.json(
        { error: 'Forbidden: Admin role required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = pinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid PIN format' }, { status: 400 });
    }

    const { pin } = parsed.data;
    const rateLimitKey = `${session.user.id}:pin`;

    // Rate limit: 5 attempts per 5 minutes
    const limitStatus = await checkRateLimit(rateLimitKey, 'pin', 5, 5);
    if (!limitStatus.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed PIN attempts. Locked out for ${limitStatus.retryAfterSeconds} seconds.`,
          retryAfter: limitStatus.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!userRecord || !userRecord.adminPinHash) {
      return NextResponse.json(
        { error: 'No admin PIN configured for this account' },
        { status: 400 }
      );
    }

    const isMatch = await verifyPin(pin, userRecord.adminPinHash);
    if (!isMatch) {
      await recordAuthAttempt(rateLimitKey, 'pin', false);
      await logAuditEvent({
        actorId: session.user.id,
        action: 'ADMIN_STEPUP_FAILED',
        entity: 'auth',
        after: { reason: 'invalid_pin' },
      });

      return NextResponse.json(
        {
          error: 'Incorrect PIN',
          remainingAttempts: limitStatus.remainingAttempts - 1,
        },
        { status: 401 }
      );
    }

    // PIN is verified!
    await recordAuthAttempt(rateLimitKey, 'pin', true);

    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (rawToken) {
      await elevateSession(rawToken);
    }

    await logAuditEvent({
      actorId: session.user.id,
      action: 'ADMIN_STEPUP_SUCCESS',
      entity: 'auth',
      after: { method: 'pin' },
    });

    return NextResponse.json({
      success: true,
      message: 'Admin elevation granted',
    });
  } catch (err) {
    console.error('Elevation error:', err);
    return NextResponse.json({ error: 'Failed to verify PIN' }, { status: 500 });
  }
}
