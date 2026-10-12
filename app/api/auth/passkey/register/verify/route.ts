import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/server/auth/rbac';
import { verifyPasskeyRegistration } from '@/src/server/auth/passkeys';
import { logAuditEvent } from '@/src/server/auth/audit';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const saved = await verifyPasskeyRegistration(
      auth.session!.user.id,
      body,
      body.deviceLabel || 'My Device'
    );

    await logAuditEvent({
      actorId: auth.session!.user.id,
      action: 'REGISTER_PASSKEY',
      entity: 'passkeys',
      entityId: saved.id,
      after: { deviceLabel: saved.deviceLabel },
    });

    return NextResponse.json({ success: true, passkey: saved });
  } catch (err: any) {
    console.error('Passkey verification error:', err);
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 400 });
  }
}
