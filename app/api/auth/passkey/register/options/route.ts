import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/src/server/auth/rbac';
import { getPasskeyRegistrationOptions } from '@/src/server/auth/passkeys';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const options = await getPasskeyRegistrationOptions(auth.session!.user);
    return NextResponse.json(options);
  } catch (err: any) {
    console.error('Registration options error:', err);
    return NextResponse.json({ error: err.message || 'Failed to initialize passkey registration' }, { status: 500 });
  }
}
