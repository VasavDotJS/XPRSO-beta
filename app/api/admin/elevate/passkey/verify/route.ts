import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/src/server/auth/rbac';
import { verifyPasskeyLogin } from '@/src/server/auth/passkeys';
import { elevateSession, SESSION_COOKIE_NAME } from '@/src/server/auth/sessions';
import { logAuditEvent } from '@/src/server/auth/audit';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const verifiedUser = await verifyPasskeyLogin(body);

    // Verify it matches the logged in admin
    if (verifiedUser.id !== auth.session!.user.id) {
      return NextResponse.json(
        { error: 'Biometric credential belongs to a different user' },
        { status: 403 }
      );
    }

    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (rawToken) {
      await elevateSession(rawToken);
    }

    await logAuditEvent({
      actorId: auth.session!.user.id,
      action: 'ADMIN_STEPUP_SUCCESS',
      entity: 'auth',
      after: { method: 'passkey_biometric' },
    });

    return NextResponse.json({ success: true, message: 'Admin elevation granted' });
  } catch (err: any) {
    console.error('Biometric elevation verify error:', err);
    return NextResponse.json({ error: err.message || 'Biometric verification failed' }, { status: 401 });
  }
}
