import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/src/server/auth/rbac';
import { getPasskeyLoginOptions } from '@/src/server/auth/passkeys';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;

  try {
    const { options } = await getPasskeyLoginOptions(auth.session!.user.id, req);
    return NextResponse.json(options);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate step-up options' }, { status: 400 });
  }
}
