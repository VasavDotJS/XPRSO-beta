import { NextResponse } from 'next/server';
import { getPasskeyLoginOptions } from '@/src/server/auth/passkeys';

export async function POST() {
  try {
    const { options } = await getPasskeyLoginOptions();
    return NextResponse.json(options);
  } catch (err: any) {
    console.error('Passkey login options error:', err);
    return NextResponse.json({ error: 'Failed to generate authentication challenge' }, { status: 500 });
  }
}
