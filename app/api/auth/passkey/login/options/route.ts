import { NextRequest, NextResponse } from 'next/server';
import { getPasskeyLoginOptions } from '@/src/server/auth/passkeys';

export async function POST(req: NextRequest) {
  try {
    let username: string | undefined = undefined;
    try {
      const body = await req.json();
      if (body?.username && typeof body.username === 'string' && body.username.trim()) {
        username = body.username.trim();
      }
    } catch {
      // Body is optional for discoverable passkey login
    }

    const { options } = await getPasskeyLoginOptions(username, req);
    return NextResponse.json(options);
  } catch (err: any) {
    console.error('Passkey login options error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate authentication challenge' },
      { status: 400 }
    );
  }
}
