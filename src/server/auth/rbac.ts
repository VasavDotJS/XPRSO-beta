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

  // 1. W3C Sec-Fetch-Site header: set by all modern browsers (Chrome, Firefox, Safari, Edge)
  // and cannot be modified by JavaScript. "same-origin" or "none" are guaranteed safe.
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'same-origin' || secFetchSite === 'none') {
    return true;
  }

  const originHeader = req.headers.get('origin') || req.headers.get('referer');
  if (!originHeader || originHeader === 'null') {
    // Direct server-to-server, curl, local scripts, or browsers omitting origin on same-origin
    return true;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(originHeader);
  } catch {
    return false;
  }

  const originHost = originUrl.host.toLowerCase();
  const originHostname = originUrl.hostname.toLowerCase();

  // Build candidate allowed hosts
  const candidateHosts = new Set<string>();

  const hostHeader = req.headers.get('host');
  if (hostHeader) candidateHosts.add(hostHeader.toLowerCase());

  const forwardedHost = req.headers.get('x-forwarded-host');
  if (forwardedHost) candidateHosts.add(forwardedHost.toLowerCase());

  try {
    if (req.nextUrl?.host) candidateHosts.add(req.nextUrl.host.toLowerCase());
  } catch {
    // ignore
  }

  if (process.env.APP_DOMAIN) {
    candidateHosts.add(process.env.APP_DOMAIN.toLowerCase());
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    candidateHosts.add(process.env.VERCEL_PROJECT_PRODUCTION_URL.toLowerCase());
  }

  if (process.env.VERCEL_URL) {
    candidateHosts.add(process.env.VERCEL_URL.toLowerCase());
  }

  if (process.env.URL) {
    candidateHosts.add(process.env.URL.replace(/^https?:\/\//, '').toLowerCase());
  }

  // Check direct matches (with or without port)
  for (const cand of candidateHosts) {
    const candHostname = cand.split(':')[0];
    if (originHost === cand || originHostname === candHostname) {
      return true;
    }
  }

  // Allow local loopback / private network addresses (localhost, 127.0.0.1, LAN IPs)
  const isLocalOrPrivate = (h: string) => {
    return (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h === '::1' ||
      h.startsWith('192.168.') ||
      h.startsWith('10.') ||
      h.startsWith('172.16.') ||
      h.startsWith('172.17.') ||
      h.startsWith('172.18.') ||
      h.startsWith('172.19.') ||
      h.startsWith('172.20.') ||
      h.startsWith('172.21.') ||
      h.startsWith('172.22.') ||
      h.startsWith('172.23.') ||
      h.startsWith('172.24.') ||
      h.startsWith('172.25.') ||
      h.startsWith('172.26.') ||
      h.startsWith('172.27.') ||
      h.startsWith('172.28.') ||
      h.startsWith('172.29.') ||
      h.startsWith('172.30.') ||
      h.startsWith('172.31.')
    );
  };

  if (isLocalOrPrivate(originHostname)) {
    return true;
  }

  return false;
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
