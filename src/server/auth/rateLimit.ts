import { db } from '../db/client';
import { authAttempts } from '../db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;

export interface RateLimitCheckResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

/**
 * Check if the key (e.g. username, IP, or user_id:pin) is rate-limited.
 */
export async function checkRateLimit(
  key: string,
  kind: 'password' | 'pin' | 'passkey',
  maxAttempts: number = MAX_FAILED_ATTEMPTS,
  windowMinutes: number = RATE_LIMIT_WINDOW_MINUTES
): Promise<RateLimitCheckResult> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const failedCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(authAttempts)
    .where(
      and(
        eq(authAttempts.key, key.toLowerCase()),
        eq(authAttempts.kind, kind),
        eq(authAttempts.success, false),
        gte(authAttempts.createdAt, windowStart)
      )
    );

  const failedCount = Number(failedCountResult[0]?.count || 0);

  if (failedCount >= maxAttempts) {
    // Find the oldest failed attempt in the current window to calculate cooldown
    const oldest = await db
      .select({ createdAt: authAttempts.createdAt })
      .from(authAttempts)
      .where(
        and(
          eq(authAttempts.key, key.toLowerCase()),
          eq(authAttempts.kind, kind),
          eq(authAttempts.success, false),
          gte(authAttempts.createdAt, windowStart)
        )
      )
      .orderBy(authAttempts.createdAt)
      .limit(1);

    const oldestTime = oldest[0]?.createdAt ? new Date(oldest[0].createdAt).getTime() : Date.now();
    const expiryTime = oldestTime + windowMinutes * 60 * 1000;
    const retryAfterSeconds = Math.max(1, Math.ceil((expiryTime - Date.now()) / 1000));

    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - failedCount,
  };
}

/**
 * Record an authentication attempt (success or failure).
 */
export async function recordAuthAttempt(
  key: string,
  kind: 'password' | 'pin' | 'passkey',
  success: boolean
): Promise<void> {
  await db.insert(authAttempts).values({
    key: key.toLowerCase(),
    kind,
    success,
  });
}
