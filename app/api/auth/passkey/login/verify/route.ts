import { NextRequest, NextResponse } from 'next/server';
import { verifyPasskeyLogin } from '@/src/server/auth/passkeys';
import { createSession, SESSION_COOKIE_NAME } from '@/src/server/auth/sessions';
import { logAuditEvent } from '@/src/server/auth/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await verifyPasskeyLogin(body, req);

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const userAgent = req.headers.get('user-agent');
    const token = await createSession(user.id, ip, userAgent);

    await logAuditEvent({
      actorId: user.id,
      action: 'LOGIN_PASSKEY_SUCCESS',
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
  } catch (err: any) {
    console.error('Passkey login verify error:', err);
    return NextResponse.json({ error: err.message || 'Biometric authentication failed' }, { status: 401 });
  }
}
