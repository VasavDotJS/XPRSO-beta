import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, slideSessionElevation, SessionData } from './sessions';

export interface AuthContext {
  session: SessionData;
}

/**
 * Validate CSRF by checking Origin/Host on state-changing methods (POST, PUT, PATCH, DELETE).
 */
export function validateCsrf(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  const origin = req.headers.get('origin');
  const host = req.headers.get('host');

  if (!origin || !host) {
    // In local dev/testing without origin header, allow if host matches
    return true;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

/**
 * Require an authenticated session (any valid role).
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ error?: NextResponse; session?: SessionData }> {
  if (!validateCsrf(req)) {
    return {
      error: NextResponse.json({ error: 'Invalid CSRF origin' }, { status: 403 }),
    };
  }

  const session = await getCurrentSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { session };
}

/**
 * Require waiter role (waiter or admin).
 */
export async function requireWaiter(
  req: NextRequest
): Promise<{ error?: NextResponse; session?: SessionData }> {
  const auth = await requireAuth(req);
  if (auth.error || !auth.session) return auth;

  const roles = auth.session.user.roles;
  if (!roles.includes('WAITER') && !roles.includes('ADMIN')) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return auth;
}

/**
 * Require admin role.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ error?: NextResponse; session?: SessionData }> {
  const auth = await requireAuth(req);
  if (auth.error || !auth.session) return auth;

  if (!auth.session.user.roles.includes('ADMIN')) {
    return {
      error: NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 }),
    };
  }

  return auth;
}

/**
 * Require elevated admin session (passed PIN or biometric step-up within elevation window).
 * Automatically slides the elevation window.
 */
export async function requireElevatedAdmin(
  req: NextRequest
): Promise<{ error?: NextResponse; session?: SessionData }> {
  const adminAuth = await requireAdmin(req);
  if (adminAuth.error || !adminAuth.session) return adminAuth;

  if (!adminAuth.session.isElevated) {
    return {
      error: NextResponse.json(
        { error: 'Admin step-up required (elevation expired or not verified)' },
        { status: 403 }
      ),
    };
  }

  // Slide elevation window on active admin request
  await slideSessionElevation(adminAuth.session.sessionId);

  return adminAuth;
}
