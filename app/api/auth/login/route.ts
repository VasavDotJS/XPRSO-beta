import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/server/db/client';
import { users } from '@/src/server/db/schema';
import { verifyPassword } from '@/src/server/auth/password';
import { checkRateLimit, recordAuthAttempt } from '@/src/server/auth/rateLimit';
import { createSession, SESSION_COOKIE_NAME } from '@/src/server/auth/sessions';
import { logAuditEvent } from '@/src/server/auth/audit';
import { eq } from 'drizzle-orm';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 400 });
    }

    const { username, password } = parsed.data;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = req.headers.get('user-agent');

    // 1. Check rate limit on username and IP
    const userLimit = await checkRateLimit(username, 'password');
    const ipLimit = await checkRateLimit(ip, 'password');

    if (!userLimit.allowed || !ipLimit.allowed) {
      const retryAfter = Math.max(
        userLimit.retryAfterSeconds || 60,
        ipLimit.retryAfterSeconds || 60
      );
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Please wait ${retryAfter} seconds before trying again.`,
          retryAfter,
        },
        { status: 429 }
      );
    }

    // 2. Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);

    if (!user || !user.isActive) {
      await recordAuthAttempt(username, 'password', false);
      await recordAuthAttempt(ip, 'password', false);
      await logAuditEvent({
        action: 'LOGIN_FAILURE',
        entity: 'auth',
        after: { username, ip, reason: 'user_not_found_or_inactive' },
      });
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // 3. Verify Argon2id password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await recordAuthAttempt(username, 'password', false);
      await recordAuthAttempt(ip, 'password', false);
      await logAuditEvent({
        actorId: user.id,
        action: 'LOGIN_FAILURE',
        entity: 'auth',
        after: { username, ip, reason: 'invalid_password' },
      });
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Record success
    await recordAuthAttempt(username, 'password', true);
    await recordAuthAttempt(ip, 'password', true);

    // Create session
    const token = await createSession(user.id, ip, userAgent);

    await logAuditEvent({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      entity: 'auth',
      after: { username: user.username, ip },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        roles: user.roles,
        mustChangePassword: user.mustChangePassword,
      },
    });

    const host = req.headers.get('host') || '';
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const isHttps = req.headers.get('x-forwarded-proto') === 'https';
    const isSecure = isHttps || (!isLocal && process.env.NODE_ENV === 'production');

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
