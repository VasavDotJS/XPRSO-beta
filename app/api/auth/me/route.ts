import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/server/auth/sessions';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.user,
    isElevated: session.isElevated,
    elevatedUntil: session.elevatedUntil,
  });
}
