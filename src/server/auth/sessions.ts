import crypto from 'crypto';
import { db } from '../db/client';
import { sessions, users, settings } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'xprso_session';
export const ABSOLUTE_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  mustChangePassword: boolean;
  isActive: boolean;
}

export interface SessionData {
  sessionId: string;
  user: AuthenticatedUser;
  isElevated: boolean;
  elevatedUntil: Date | null;
}

/**
 * Hash session token using SHA-256 for secure database storage.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new database session and return the raw session token.
 */
export async function createSession(
  userId: string,
  ip?: string | null,
  userAgent?: string | null
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedId = hashSessionToken(rawToken);

  const expiresAt = new Date(Date.now() + ABSOLUTE_SESSION_LIFETIME_MS);

  await db.insert(sessions).values({
    id: hashedId,
    userId,
    expiresAt,
    ip: ip ?? null,
    userAgent: userAgent ?? null,
  });

  return rawToken;
}

/**
 * Validate session token, enforce idle timeout, and update lastSeenAt.
 */
export async function validateSessionToken(rawToken: string): Promise<SessionData | null> {
  if (!rawToken) return null;

  const hashedId = hashSessionToken(rawToken);
  const now = new Date();

  // Load session and user
  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashedId), gt(sessions.expiresAt, now)))
    .limit(1);

  if (result.length === 0) return null;

  const { session, user } = result[0];

  if (!user.isActive) return null;

  // Check idle timeout (default 12 hours)
  const appSettings = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const idleHours = appSettings[0]?.sessionIdleHours ?? 12;
  const idleTimeoutMs = idleHours * 60 * 60 * 1000;

  const lastSeenMs = new Date(session.lastSeenAt).getTime();
  if (now.getTime() - lastSeenMs > idleTimeoutMs) {
    // Idle timeout exceeded: invalidate session
    await db.delete(sessions).where(eq(sessions.id, hashedId));
    return null;
  }

  // Update last seen
  await db
    .update(sessions)
    .set({ lastSeenAt: now })
    .where(eq(sessions.id, hashedId));

  const isElevated = Boolean(session.elevatedUntil && new Date(session.elevatedUntil) > now);

  return {
    sessionId: session.id,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles,
      mustChangePassword: user.mustChangePassword,
      isActive: user.isActive,
    },
    isElevated,
    elevatedUntil: session.elevatedUntil ? new Date(session.elevatedUntil) : null,
  };
}

/**
 * Elevate a session for admin access.
 */
export async function elevateSession(
  rawToken: string,
  elevationMinutes?: number
): Promise<void> {
  const hashedId = hashSessionToken(rawToken);

  let minutes = elevationMinutes;
  if (!minutes) {
    const appSettings = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    minutes = appSettings[0]?.elevationMinutes ?? 10;
  }

  const elevatedUntil = new Date(Date.now() + minutes * 60 * 1000);

  await db
    .update(sessions)
    .set({ elevatedUntil })
    .where(eq(sessions.id, hashedId));
}

/**
 * Slide elevation window on admin activity.
 */
export async function slideSessionElevation(
  sessionId: string,
  elevationMinutes: number = 10
): Promise<void> {
  const elevatedUntil = new Date(Date.now() + elevationMinutes * 60 * 1000);
  await db
    .update(sessions)
    .set({ elevatedUntil })
    .where(eq(sessions.id, sessionId));
}

/**
 * Invalidate a session (logout).
 */
export async function invalidateSession(rawToken: string): Promise<void> {
  const hashedId = hashSessionToken(rawToken);
  await db.delete(sessions).where(eq(sessions.id, hashedId));
}

/**
 * Helper to get current session from cookies in Next.js Server Components or Route Handlers.
 */
export async function getCurrentSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await validateSessionToken(token);
  } catch {
    return null;
  }
}
