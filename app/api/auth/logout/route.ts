import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { invalidateSession, SESSION_COOKIE_NAME } from '@/src/server/auth/sessions';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await invalidateSession(token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (err) {
    console.error('Logout error:', err);
    return NextResponse.json({ success: true });
  }
}
